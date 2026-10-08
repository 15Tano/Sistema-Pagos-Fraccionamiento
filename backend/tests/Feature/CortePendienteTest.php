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
        DB::table('tag_sales')->update(['sold_at' => '2026-10-07 19:00:00']);
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
}
