<?php
namespace Tests\Feature;

use App\Http\Controllers\AuditController;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuditSearchTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->integer('user_id')->nullable();
            $t->string('user_name')->nullable();
            $t->string('accion');
            $t->string('modelo');
            $t->integer('modelo_id')->nullable();
            $t->json('datos_anteriores')->nullable();
            $t->json('datos_nuevos')->nullable();
            $t->string('ip')->nullable();
            $t->timestamps();
        });
        Schema::create('vecinos', function (Blueprint $t) {
            $t->id(); $t->string('nombre'); $t->string('calle');
            $t->string('numero_casa'); $t->string('uuid');
        });
        Schema::create('pagos', function (Blueprint $t) {
            $t->id(); $t->integer('vecino_id'); $t->string('mes');
        });
        Schema::create('tags', function (Blueprint $t) {
            $t->id(); $t->string('codigo');
        });
    }

    private function insertLog(array $data = []): int
    {
        return DB::table('audit_logs')->insertGetId(array_merge([
            'user_name' => 'Capturista Ana', 'accion' => 'created',
            'modelo' => 'Otro', 'modelo_id' => 7,
            'created_at' => '2026-10-12 12:00:00', 'updated_at' => '2026-10-12 12:00:00',
        ], $data));
    }

    private function search(array $params): array
    {
        return (new AuditController)->index(Request::create('/api/audit-logs', 'GET', $params))->getData(true);
    }

    public function test_search_filters_entire_history_before_pagination_and_combines_action(): void
    {
        $id = $this->insertLog(['accion' => 'deleted', 'datos_anteriores' => json_encode(['nombre' => 'Beatriz', 'cantidad' => 987.5])]);
        for ($i = 0; $i < 20; $i++) $this->insertLog();
        $result = $this->search(['search' => 'Beatriz 987.5', 'accion' => 'deleted']);
        $this->assertSame(1, $result['total']);
        $this->assertSame($id, $result['data'][0]['id']);
        $this->assertSame(0, $this->search(['search' => 'Beatriz', 'accion' => 'created'])['total']);
        $this->assertSame(21, $this->search([])['total']);
        $this->assertCount(15, $this->search([])['data']);
    }

    public function test_search_matches_related_neighbor_and_deleted_payment_snapshot(): void
    {
        DB::table('vecinos')->insert(['id' => 8, 'nombre' => 'Beatriz Lopez', 'calle' => 'Olivos', 'numero_casa' => '42', 'uuid' => 'vecino-8']);
        DB::table('pagos')->insert(['id' => 4, 'vecino_id' => 8, 'mes' => 'Octubre']);
        $this->insertLog(['modelo' => 'Pago', 'modelo_id' => 4]);
        $this->insertLog(['modelo' => 'Pago', 'modelo_id' => 9, 'accion' => 'deleted', 'datos_anteriores' => json_encode(['vecino_id' => 8, 'mes' => 'Octubre'])]);
        $this->assertSame(2, $this->search(['search' => 'Beatriz Octubre'])['total']);
        $this->assertSame(2, $this->search(['search' => 'Olivos 42'])['total']);
    }

    public function test_search_matches_metadata_aliases_and_literal_special_characters(): void
    {
        $this->insertLog(['user_name' => null, 'ip' => '192.168.1.25', 'datos_nuevos' => json_encode(['codigo' => 'TAG_50% & A'])]);
        $this->insertLog(['datos_nuevos' => json_encode(['codigo' => 'TAGX50X'])]);
        $this->assertSame(1, $this->search(['search' => 'Sistema 192.168.1.25 2026-10-12'])['total']);
        $this->assertSame(2, $this->search(['search' => 'creó'])['total']);
        $this->assertSame(1, $this->search(['search' => 'TAG_50% &'])['total']);
    }
}
