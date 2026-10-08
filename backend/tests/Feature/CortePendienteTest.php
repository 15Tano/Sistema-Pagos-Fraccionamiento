<?php

namespace Tests\Feature;

use App\Http\Controllers\CorteCajaController;
use App\Models\CorteCaja;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CortePendienteTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-10-08 12:00:00', 'America/Mexico_City'));
        (require database_path('migrations/2026_09_17_055555_create_cortes_caja_table.php'))->up();
        Schema::create('pagos', function (Blueprint $table) {
            $table->id();
            $table->date('fecha_de_cobro');
            $table->decimal('cantidad', 8, 2);
            $table->string('tipo');
        });
        Schema::create('tag_sales', function (Blueprint $table) {
            $table->id();
            $table->dateTime('sold_at');
            $table->decimal('price', 8, 2);
        });
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_recovers_yesterday_and_closes_with_corrected_payment_and_tag(): void
    {
        $ayer = CorteCaja::create(['fecha' => '2026-10-07']);
        CorteCaja::create(['fecha' => '2026-10-08']);
        DB::table('pagos')->insert(['fecha_de_cobro' => '2026-10-08', 'cantidad' => 280, 'tipo' => 'ordinario']);
        DB::table('tag_sales')->insert(['sold_at' => '2026-10-08 01:00:00', 'price' => 150]);
        $controller = new CorteCajaController();
        $this->assertSame($ayer->uuid, $controller->hoy()->getData()->corte->uuid);
        $request = Request::create('/', 'POST', ['fecha' => '2026-10-07', 'monto_declarado' => 430]);
        $this->assertFalse($controller->intentar($request)->getData()->coincide);
        DB::table('pagos')->update(['fecha_de_cobro' => '2026-10-07']);
        // La venta a las 19:00 de México ya pertenece al día 7 aunque en UTC sea día 8.
        $this->assertTrue($controller->intentar($request)->getData()->coincide);
        $closed = $controller->cerrar(Request::create('/', 'POST', ['fecha' => '2026-10-07', 'firma' => 'Capturista']))->getData();
        $this->assertSame('cuadrado', $closed->corte->estado);
        $this->assertEquals(430, $closed->corte->monto_sistema);
        $this->assertSame('2026-10-08', CorteCaja::activo()->fecha->toDateString());
    }

    public function test_difference_closure_requires_signature_without_note(): void
    {
        CorteCaja::create(['fecha' => '2026-10-07']);
        $controller = new CorteCajaController();
        for ($i = 0; $i < 3; $i++) {
            $controller->intentar(Request::create('/', 'POST', ['fecha' => '2026-10-07', 'monto_declarado' => 100]));
        }
        $response = $controller->cerrarConDiferencia(Request::create('/', 'POST', ['fecha' => '2026-10-07', 'firma' => 'Capturista']))->getData();
        $this->assertSame('cerrado_con_diferencia', $response->corte->estado);
        $this->assertCount(3, $response->corte->intentos);
    }

    public function test_mexico_day_uses_utc_boundaries_in_total_breakdown_and_plazas(): void
    {
        CorteCaja::create(['fecha' => '2026-10-07']);
        DB::table('tag_sales')->insert([
            ['sold_at' => '2026-10-07 05:59:59', 'price' => 900], // Día anterior en México.
            ['sold_at' => '2026-10-07 06:00:00', 'price' => 150], // Inicio del día 7.
            ['sold_at' => '2026-10-08 01:00:00', 'price' => 150], // 19:00 del día 7.
            ['sold_at' => '2026-10-08 05:59:59', 'price' => 150], // Último segundo del día 7.
            ['sold_at' => '2026-10-08 06:00:00', 'price' => 900], // Inicio del día 8.
        ]);
        $controller = new CorteCajaController();
        $hoy = $controller->hoy()->getData();
        $this->assertEquals(450, $hoy->desglose->ventasTags);
        $this->assertSame(3, $hoy->desglose->tagsCount);
        $intento = $controller->intentar(Request::create('/', 'POST', ['fecha' => '2026-10-07', 'monto_declarado' => 450]))->getData();
        $this->assertTrue($intento->coincide);
        $plazas = $controller->plazasDelDia(Request::create('/', 'GET', ['fecha' => '2026-10-07']))->getData();
        $this->assertEquals(450, $plazas->ventas_tags->total);
        $this->assertSame(3, $plazas->ventas_tags->cantidad);
    }

    public function test_cortes_before_october_7_keep_original_utc_date_filter(): void
    {
        $corte = CorteCaja::create(['fecha' => '2026-10-06', 'estado' => 'cuadrado', 'monto_sistema' => 300]);
        DB::table('tag_sales')->insert([
            ['sold_at' => '2026-10-06 01:00:00', 'price' => 150],
            ['sold_at' => '2026-10-06 23:59:59', 'price' => 150],
            ['sold_at' => '2026-10-07 01:00:00', 'price' => 900],
        ]);
        $request = Request::create('/', 'GET');
        $request->setUserResolver(fn () => (object) ['role' => 'admin']);
        $detalle = (new CorteCajaController())->show($request, $corte)->getData();
        $this->assertEquals(300, $detalle->desglose->ventasTags);
        $this->assertSame(2, $detalle->desglose->tagsCount);
        $this->assertEquals(300, $detalle->corte->monto_sistema);
    }
}
