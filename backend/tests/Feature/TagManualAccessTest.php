<?php

namespace Tests\Feature;

use App\Models\Tag;
use App\Models\User;
use App\Models\Vecino;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TagManualAccessTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');

        foreach ([
            '2026_01_01_000000_create_all_tables.php',
            '2026_04_19_195934_add_uuid_to_main_tables.php',
            '2026_04_23_074643_create_audit_logs_table.php',
            '2026_09_17_055555_create_cortes_caja_table.php',
            '2026_10_14_120000_add_asignable_sin_venta_to_tags_table.php',
            '2026_11_19_120000_add_manual_access_state_to_tags_table.php',
        ] as $file) {
            (require database_path("migrations/{$file}"))->up();
        }
    }

    public function test_admin_disables_one_tag_and_reactivation_recalculates_its_vigency(): void
    {
        $this->travelTo(now()->setDateTime(2026, 11, 19, 12, 0));
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $vecino = Vecino::create(['nombre' => 'Ana', 'calle' => 'Plaza', 'numero_casa' => '1']);
        $tag = Tag::create(['codigo' => '12160354', 'activo' => true]);
        $tagSinVenta = Tag::create(['codigo' => '6654315', 'activo' => false, 'asignable_sin_venta' => true]);
        $vecino->tags()->attach([$tag->id, $tagSinVenta->id]);
        $this->pay($vecino, '2026-10');

        $this->assertSame([
            '12160354' => '2026-11-05 23:59:59',
            '6654315' => '2026-11-05 23:59:59',
        ], $this->expirations());

        $this->putJson("/api/tags/{$tag->id}/acceso", ['desactivado' => true])
            ->assertOk()->assertJsonPath('tag.desactivado_manualmente', true);
        $this->putJson("/api/tags/{$tag->id}/acceso", ['desactivado' => true])->assertOk();
        $this->assertDatabaseCount('tag_vecino', 2);
        $this->assertDatabaseCount('tag_sales', 0);
        $this->assertDatabaseHas('audit_logs', ['modelo' => 'Tag', 'modelo_id' => $tag->id, 'accion' => 'updated']);
        $this->assertSame(1, DB::table('audit_logs')->where('modelo', 'Tag')->where('accion', 'updated')->count());

        $this->pay($vecino, '2026-11');
        $this->assertSame([
            '12160354' => '2020-01-02 23:59:59',
            '6654315' => '2026-12-10 23:59:59',
        ], $this->expirations());

        $this->putJson("/api/tags/{$tag->id}/acceso", ['desactivado' => false])
            ->assertOk()->assertJsonPath('tag.desactivado_manualmente', false);
        $this->assertSame([
            '12160354' => '2026-12-10 23:59:59',
            '6654315' => '2026-12-10 23:59:59',
        ], $this->expirations());
    }

    public function test_blocked_tag_keeps_its_expired_date_without_an_association(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $tag = Tag::create(['codigo' => '6000012', 'activo' => false]);
        $this->putJson("/api/tags/{$tag->id}/acceso", ['desactivado' => true])->assertOk();

        $this->putJson("/api/tags/{$tag->id}", ['codigo' => '6000023'])->assertUnprocessable();
        $this->deleteJson("/api/tags/{$tag->id}")->assertUnprocessable();
        $this->getJson('/api/vencimientos?test=true')->assertExactJson([]);
        $this->getJson('/api/vencimientos')->assertExactJson([
            ['card_no' => '6000012', 'expiration' => '2020-01-02 23:59:59'],
        ]);

        $this->putJson("/api/tags/{$tag->id}/acceso", ['desactivado' => false])->assertOk();
        $this->getJson('/api/vencimientos')->assertExactJson([]);
    }

    public function test_only_admin_can_change_manual_access_and_invalid_codes_are_rejected(): void
    {
        $tag = Tag::create(['codigo' => '6300001', 'activo' => true]);
        $this->putJson("/api/tags/{$tag->id}/acceso", ['desactivado' => true])->assertUnauthorized();

        foreach (['capturista', 'vigilancia', 'residente'] as $role) {
            Sanctum::actingAs(User::factory()->create(['role' => $role]));
            $this->putJson("/api/tags/{$tag->id}/acceso", ['desactivado' => true])->assertForbidden();
            $this->patchJson("/api/tags/{$tag->id}/toggle")->assertForbidden();
            $this->putJson("/api/tags/{$tag->id}", ['desactivado_manualmente' => true])->assertOk();
        }
        $this->assertFalse($tag->fresh()->desactivado_manualmente);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $incompatible = Tag::create(['codigo' => 'TAG001', 'activo' => false]);
        $this->putJson("/api/tags/{$incompatible->id}/acceso", ['desactivado' => true])->assertUnprocessable();
        $this->putJson("/api/tags/{$tag->id}/acceso", [])->assertUnprocessable();
    }

    private function pay(Vecino $vecino, string $month): void
    {
        DB::table('pagos')->insert([
            'vecino_id' => $vecino->id,
            'mes' => $month,
            'cantidad' => 280,
            'tipo' => 'ordinario',
        ]);
    }

    private function expirations(): array
    {
        return array_column($this->getJson('/api/vencimientos')->assertOk()->json(), 'expiration', 'card_no');
    }
}
