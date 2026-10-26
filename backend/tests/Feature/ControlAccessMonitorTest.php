<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ControlAcceso\IngestionService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ControlAccessMonitorTest extends TestCase
{
    private string $agent = '10000000-0000-4000-8000-000000000001';
    private string $other = '10000000-0000-4000-8000-000000000002';
    private string $session = '20000000-0000-4000-8000-000000000001';
    private string $hash;
    private string $now = '2026-10-26T07:00:00Z';

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepareDatabase();
        config(['cache.default' => 'array', 'control_acceso.monitor_enabled' => true]);
        (require database_path('migrations/2026_10_23_210000_create_control_acceso_ingestion_tables.php'))->up();
        (require database_path('migrations/2026_10_26_070000_add_control_acceso_monitor_indexes.php'))->up();
        Schema::create('personal_access_tokens', function ($table) {
            $table->id();
            $table->string('token', 64)->unique();
        });
        $this->hash = hash('sha256', 'sica_'.str_repeat('f', 64));
        foreach ([$this->agent, $this->other] as $index => $id) {
            DB::table('control_acceso_agentes')->insert(['id' => $id, 'nombre' => 'Caseta '.($index + 1),
                'device_serial' => $index === 0 ? 'CO2K225060027' : 'UNKNOWN-C3',
                'token_hash' => $index === 0 ? $this->hash : hash('sha256', 'other'),
                'created_at' => CarbonImmutable::parse($this->now)->format('Y-m-d H:i:s.u'),
                'updated_at' => CarbonImmutable::parse($this->now)->format('Y-m-d H:i:s.u')]);
        }
        CarbonImmutable::setTestNow($this->now);
    }

    protected function prepareDatabase(): void
    {
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        DB::purge('sqlite');
        DB::statement('PRAGMA foreign_keys = ON');
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function login(string $role = 'admin'): void
    {
        $user = new User(['name' => 'Fixture', 'role' => $role]);
        $user->id = 1;
        Sanctum::actingAs($user);
    }

    private function envelope(int $sequence = 0): array
    {
        return ['protocol_version' => 1, 'agent_id' => $this->agent, 'device_serial' => 'CO2K225060027',
            'session_id' => $this->session, 'sequence' => $sequence];
    }

    private function state(array $replace = [], int $sequence = 0): array
    {
        $payload = $this->envelope($sequence) + ['reported_at_utc' => $this->now,
            'agent_version' => 'fixture', 'pid' => 100,
            'vigencias' => ['protocol' => 2, 'pid' => 100, 'phase' => 'idle', 'consecutive_errors' => 0,
                'heartbeat_utc' => $this->now, 'last_ok_utc' => $this->now],
            'sdk' => ['last_ok_utc' => $this->now, 'last_error_code' => null],
            'reader' => ['state' => 'status_observed', 'checked_at_utc' => $this->now],
            'sender' => ['pending_count' => 0]];
        $payload = array_replace_recursive($payload, $replace);
        app(IngestionService::class)->state($this->agent, $this->hash, $payload);
        return $payload;
    }

    private function events(array $lines, string $source = 'rt', int $sequence = 0): array
    {
        $raw = implode("\r\n", $lines)."\r\n";
        $payload = $this->envelope($sequence) + ['batch_id' => (string) Str::uuid(), 'responses' => [[
            'response_id' => (string) Str::uuid(), 'source' => $source, 'sdk_return_code' => count($lines),
            'raw_payload_base64' => base64_encode($raw), 'sha256' => hash('sha256', $raw),
            'captured_started_utc' => $this->now, 'captured_ended_utc' => $this->now,
        ]]];
        app(IngestionService::class)->batch($this->agent, $this->hash, $payload);
        return $payload;
    }

    private function states(): string { return '/api/control-acceso/monitor/estado?agent_id='.$this->agent; }
    private function feed(string $query = ''): string { return '/api/control-acceso/monitor/eventos?agent_id='.$this->agent.$query; }

    public function test_monitor_requires_human_auth_and_agent_token_is_not_a_human(): void
    {
        foreach ([$this->states(), $this->feed()] as $url) {
            $this->getJson($url)->assertUnauthorized();
            $this->withHeaders(['Authorization' => 'Bearer sica_'.str_repeat('f', 64)])->getJson($url)->assertUnauthorized();
        }
    }

    public function test_only_admin_and_vigilancia_can_read_and_feature_is_explicitly_enabled(): void
    {
        foreach (['residente', 'capturista', 'vecino', 'unknown'] as $role) {
            $this->login($role);
            $this->getJson($this->states())->assertForbidden();
            $this->getJson($this->feed())->assertForbidden();
        }
        foreach (['admin', 'vigilancia'] as $role) {
            $this->login($role);
            $this->getJson($this->states())->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        }
        config(['control_acceso.monitor_enabled' => false]);
        $this->getJson($this->states())->assertNotFound();
        $this->getJson($this->feed())->assertNotFound();
    }

    public function test_no_report_does_not_mean_controller_is_online_and_secrets_are_never_returned(): void
    {
        $this->login();
        $response = $this->getJson($this->states())->assertOk()->assertJsonPath('data.0.reporting_status', 'sin_reporte')
            ->assertJsonPath('data.0.vigencias_status', 'sin_datos')->assertJsonPath('data.0.vigencias', null);
        $this->assertStringNotContainsString('token_hash', $response->getContent());
        $this->assertStringNotContainsString($this->hash, $response->getContent());
    }

    public function test_delayed_report_received_later_does_not_replace_newer_report(): void
    {
        $this->state();
        $this->state(['reported_at_utc' => '2026-10-26T06:30:00Z', 'reader' => ['state' => 'paused']], 1);
        $this->login();
        $this->getJson($this->states())->assertOk()->assertJsonPath('data.0.reader.state', 'status_observed')
            ->assertJsonPath('data.0.reporting_status', 'reciente')->assertJsonPath('data.0.vigencias_status', 'correcto');
    }

    public function test_fresh_receipt_of_old_payload_does_not_show_healthy_vigencias(): void
    {
        $this->state(['reported_at_utc' => '2026-10-26T06:30:00Z']);
        $this->login();
        $this->getJson($this->states())->assertOk()->assertJsonPath('data.0.reporting_status', 'reporte_atrasado')
            ->assertJsonPath('data.0.vigencias_status', 'sin_confirmar');
    }

    public function test_rt_success_and_recent_report_do_not_mask_stale_or_failed_vigencias(): void
    {
        $this->state(['vigencias' => ['last_ok_utc' => '2026-10-26T06:00:00Z']]);
        $this->login();
        $this->getJson($this->states())->assertOk()->assertJsonPath('data.0.vigencias_status', 'atrasado');
        $this->state(['vigencias' => ['consecutive_errors' => 1]], 1);
        $this->getJson($this->states())->assertOk()->assertJsonPath('data.0.vigencias_status', 'error');
    }

    public function test_stopped_and_future_clock_are_explicit(): void
    {
        $this->state(['vigencias' => ['phase' => 'stopped']]);
        $this->login();
        $this->getJson($this->states())->assertOk()->assertJsonPath('data.0.vigencias_status', 'detenido');
        $this->state(['reported_at_utc' => '2026-10-26T08:00:00Z'], 1);
        $this->getJson($this->states())->assertOk()->assertJsonPath('data.0.reporting_status', 'reloj_por_revisar')
            ->assertJsonPath('data.0.vigencias_status', 'sin_confirmar');
    }

    public function test_old_server_receipt_and_revoked_agent_never_appear_current(): void
    {
        $this->state();
        CarbonImmutable::setTestNow('2026-10-26T07:05:00Z');
        $this->login();
        $this->getJson($this->states())->assertOk()->assertJsonPath('data.0.reporting_status', 'sin_reporte_reciente');
        DB::table('control_acceso_agentes')->where('id', $this->agent)
            ->update(['revoked_at' => CarbonImmutable::parse($this->now)->format('Y-m-d H:i:s.u')]);
        $this->getJson($this->states())->assertOk()->assertJsonPath('data.0.reporting_status', 'revocado');
    }

    public function test_feed_uses_server_ids_preserves_duplicate_observations_and_excludes_status255(): void
    {
        $line = '2026-10-24 18:54:41,693,12230693,2,0,1,4';
        $this->events([$line, $line, '2026-10-24 18:54:42,0,0,0,255,0,0']);
        $this->login('vigilancia');
        $response = $this->getJson($this->feed())->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.door_label', 'Salida')->assertJsonPath('meta.physical_passage_confirmed', false);
        $data = $response->json('data');
        $this->assertNotSame($data[0]['id'], $data[1]['id']);
        $this->assertIsString($data[0]['id']);
        foreach (['raw_fields', 'raw_payload_base64', 'token_hash', 'ack'] as $private) {
            $this->assertStringNotContainsString('"'.$private.'"', $response->getContent());
        }
    }

    public function test_incremental_pagination_does_not_skip_backlog_or_depend_on_device_clock(): void
    {
        $this->events(['2026-10-26 10:00:00,1,111,1,0,0,4', '2026-10-24 10:00:00,2,222,2,20,1,4',
            '2026-10-25 10:00:00,3,333,1,99,0,4']);
        $this->login();
        $first = $this->getJson($this->feed('&after_id=0&limit=2'))->assertOk()
            ->assertJsonPath('meta.has_more', true)->assertJsonPath('data.0.card_no', '111')->json();
        $last = $first['meta']['last_id'];
        $this->getJson($this->feed('&after_id='.$last.'&limit=2'))->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.card_no', '333')->assertJsonPath('meta.has_more', false);
        $this->getJson($this->feed('&limit=1'))->assertOk()->assertJsonPath('data.0.card_no', '333')
            ->assertJsonPath('meta.initial_latest', true);
        $this->getJson($this->feed('&before_id='.$last.'&limit=1'))->assertOk()->assertJsonPath('data.0.card_no', '111');
    }

    public function test_filtering_by_gate_and_exact_card_keeps_leading_zeroes(): void
    {
        $this->events(['2026-10-26 10:00:00,1,00111,1,0,0,4', '2026-10-26 10:00:00,2,111,2,0,1,4']);
        $this->login();
        $this->getJson($this->feed('&door_id=1&card_no=00111'))->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.door_label', 'Entrada')->assertJsonPath('data.0.card_no', '00111');
        $this->getJson('/api/control-acceso/monitor/eventos?agent_id='.$this->other)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_empty_incremental_page_keeps_client_cursor_and_invalid_filters_are_rejected(): void
    {
        $this->login();
        $this->getJson($this->feed('&after_id=123'))->assertOk()->assertJsonPath('meta.last_id', '123');
        foreach (['&after_id=1&before_id=2', '&after_id=-1', '&after_id=1e5', '&after_id=9223372036854775808',
            '&limit=101', '&limit=0', '&source=unknown', '&card_no=abc', '&door_id[]=1', '&unknown=1'] as $query) {
            $this->getJson($this->feed($query))->assertUnprocessable();
        }
        $this->getJson('/api/control-acceso/monitor/eventos')->assertUnprocessable();
        $this->getJson('/api/control-acceso/monitor/estado?agent_id='.Str::uuid())->assertNotFound();
    }

    public function test_read_endpoints_do_not_change_ingested_data_or_payment_tables(): void
    {
        $this->state();
        $this->events(['2026-10-26 10:00:00,1,111,1,0,0,4']);
        $before = [];
        foreach (['agentes', 'estados', 'lotes', 'respuestas', 'filas'] as $name) {
            $before[$name] = DB::table('control_acceso_'.$name)->get()->toJson();
        }
        $this->login();
        $this->getJson($this->states())->assertOk();
        $this->getJson($this->feed())->assertOk();
        foreach ($before as $name => $rows) {
            $this->assertSame($rows, DB::table('control_acceso_'.$name)->get()->toJson());
        }
    }

    public function test_monitor_index_migration_can_be_reversed_without_losing_ingested_data(): void
    {
        $this->state();
        $this->events(['2026-10-26 10:00:00,1,111,1,0,0,4']);
        $migration = require database_path('migrations/2026_10_26_070000_add_control_acceso_monitor_indexes.php');
        $migration->down();
        $this->assertDatabaseCount('control_acceso_filas', 1);
        $this->assertDatabaseCount('control_acceso_estados', 1);
        $migration->up();
        $this->login();
        $this->getJson($this->feed())->assertOk()->assertJsonCount(1, 'data');
    }
}
