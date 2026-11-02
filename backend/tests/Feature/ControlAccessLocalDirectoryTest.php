<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ControlAccessLocalDirectoryTest extends TestCase
{
    private string $agent = '54d110e4-313a-45e3-bcc6-7761f3df8721';
    private string $token;
    private string $url = '/api/control-acceso/agente/asociaciones';

    protected function setUp(): void
    {
        parent::setUp();
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:',
            'cache.default' => 'array', 'control_acceso.local_display_directory_enabled' => true]);
        DB::purge('sqlite');
        (require database_path('migrations/2026_10_23_210000_create_control_acceso_ingestion_tables.php'))->up();
        Schema::create('tags', function ($t) { $t->id(); $t->string('codigo'); });
        Schema::create('vecinos', function ($t) { $t->id(); $t->string('nombre'); $t->string('calle')->nullable(); });
        Schema::create('tag_vecino', function ($t) { $t->unsignedBigInteger('tag_id'); $t->unsignedBigInteger('vecino_id'); });
        $this->token = 'sica_'.str_repeat('d', 64);
        DB::table('control_acceso_agentes')->insert(['id' => $this->agent, 'nombre' => 'Fixture',
            'device_serial' => 'CO2K225060027', 'token_hash' => hash('sha256', $this->token),
            'created_at' => now(), 'updated_at' => now()]);
    }

    private function directory()
    {
        return $this->withHeaders(['Authorization' => 'Bearer '.$this->token])->getJson($this->url);
    }

    public function test_requires_current_agent_credential_and_json_header(): void
    {
        $this->getJson($this->url)->assertUnauthorized();
        $this->withHeaders(['Authorization' => 'Bearer human-token'])->getJson($this->url)->assertUnauthorized();
        $this->withHeaders(['Authorization' => 'Bearer '.$this->token])->get($this->url)->assertStatus(415);
    }

    public function test_feature_is_explicitly_enabled_and_revocation_is_enforced(): void
    {
        config(['control_acceso.local_display_directory_enabled' => false]);
        $this->directory()->assertNotFound();
        config(['control_acceso.local_display_directory_enabled' => true]);
        DB::table('control_acceso_agentes')->where('id', $this->agent)->update(['revoked_at' => now()]);
        $this->directory()->assertUnauthorized();
    }

    public function test_another_controller_cannot_download_the_dell_directory(): void
    {
        DB::table('control_acceso_agentes')->where('id', $this->agent)->update(['device_serial' => 'ANOTHER-PANEL']);
        $this->directory()->assertForbidden();
    }

    public function test_names_match_monitor_association_semantics_and_exclude_private_fields(): void
    {
        DB::table('tags')->insert([['id' => 1, 'codigo' => '1234567'], ['id' => 2, 'codigo' => '7654321'], ['id' => 3, 'codigo' => '8888888']]);
        DB::table('vecinos')->insert([['id' => 1, 'nombre' => 'Vecino ficticio', 'calle' => 'PRIVATE_STREET'],
            ['id' => 2, 'nombre' => 'Segundo ficticio', 'calle' => 'PRIVATE_STREET']]);
        DB::table('tag_vecino')->insert([['tag_id' => 1, 'vecino_id' => 1], ['tag_id' => 1, 'vecino_id' => 1],
            ['tag_id' => 2, 'vecino_id' => 1], ['tag_id' => 2, 'vecino_id' => 2]]);
        $result = $this->directory()->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('agent_id', $this->agent)->assertJsonPath('valid_for_seconds', 300)
            ->assertJsonCount(2, 'data')->assertJsonPath('data.0.neighbor_status', 'single')
            ->assertJsonPath('data.0.neighbor_name', 'Vecino ficticio')
            ->assertJsonPath('data.1.neighbor_status', 'multiple')->assertJsonPath('data.1.neighbor_name', null);
        foreach (['PRIVATE_STREET', 'token_hash', $this->token, 'vecino_id', 'saldo', 'pagos'] as $secret) {
            $this->assertStringNotContainsString($secret, $result->getContent());
        }
        $this->assertSame(['card_no', 'neighbor_status', 'neighbor_name'], array_keys($result->json('data.0')));
    }

    public function test_empty_directory_replaces_previous_associations(): void
    {
        $this->directory()->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('valid_for_seconds', 300);
    }
}
