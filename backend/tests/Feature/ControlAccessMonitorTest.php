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
        (require database_path('migrations/2026_10_30_010000_create_control_acceso_monitor_settings.php'))->up();
        Schema::create('personal_access_tokens', function ($table) {
            $table->id();
            $table->string('token', 64)->unique();
        });
        $this->hash = hash('sha256', 'sica_'.str_repeat('f', 64));
        Schema::create('tags', function ($table) { $table->id(); $table->string('codigo')->unique(); });
        Schema::create('vecinos', function ($table) { $table->id(); $table->string('nombre'); $table->string('calle')->nullable(); });
        Schema::create('tag_vecino', function ($table) { $table->unsignedBigInteger('tag_id'); $table->unsignedBigInteger('vecino_id'); });
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
        DB::table('control_acceso_monitor_configuracion')->where('id', 1)->update(['historial_vigilancia' => true]);
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

    public function test_neighbor_name_is_current_exact_and_does_not_expose_address(): void
    {
        DB::table('tags')->insert([['id' => 1, 'codigo' => '00111'], ['id' => 2, 'codigo' => '111']]);
        DB::table('vecinos')->insert([['id' => 1, 'nombre' => 'Nombre Ficticio Completo', 'calle' => 'Domicilio privado'],
            ['id' => 2, 'nombre' => 'Otro Nombre', 'calle' => 'Otra calle']]);
        DB::table('tag_vecino')->insert([['tag_id' => 1, 'vecino_id' => 1], ['tag_id' => 2, 'vecino_id' => 2]]);
        $this->events(['2026-10-26 10:00:00,1,00111,1,0,0,4', '2026-10-26 10:00:01,2,111,1,0,0,4',
            '2026-10-26 10:00:02,3,999,1,0,0,4']);
        $this->login('vigilancia');
        DB::table('control_acceso_monitor_configuracion')->where('id', 1)->update(['historial_vigilancia' => true]);
        $response = $this->getJson($this->feed())->assertOk()->assertJsonPath('data.0.neighbor_name', 'Nombre Ficticio Completo')
            ->assertJsonPath('data.0.neighbor_status', 'single')->assertJsonPath('data.1.neighbor_name', 'Otro Nombre')
            ->assertJsonPath('data.2.neighbor_name', null)->assertJsonPath('data.2.neighbor_status', 'none');
        foreach (['Domicilio privado', 'Otra calle', 'vecino_id', 'user_id'] as $private) {
            $this->assertStringNotContainsString($private, $response->getContent());
        }
        DB::table('vecinos')->where('id', 1)->update(['nombre' => 'Nombre actualizado']);
        $this->getJson($this->feed('&card_no=00111'))->assertJsonPath('data.0.neighbor_name', 'Nombre actualizado');
    }

    public function test_multiple_neighbors_are_not_chosen_and_removed_association_becomes_unknown(): void
    {
        DB::table('tags')->insert(['id' => 1, 'codigo' => '111']);
        DB::table('vecinos')->insert([['id' => 1, 'nombre' => 'Primero'], ['id' => 2, 'nombre' => 'Segundo']]);
        DB::table('tag_vecino')->insert([['tag_id' => 1, 'vecino_id' => 1], ['tag_id' => 1, 'vecino_id' => 2]]);
        $this->events(['2026-10-26 10:00:00,1,111,1,0,0,4']); $this->login();
        $this->getJson($this->feed())->assertOk()->assertJsonPath('data.0.neighbor_status', 'multiple')
            ->assertJsonPath('data.0.neighbor_name', null);
        DB::table('tag_vecino')->delete();
        $this->getJson($this->feed())->assertOk()->assertJsonPath('data.0.neighbor_status', 'none')
            ->assertJsonPath('data.0.neighbor_name', null);
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

    public function test_search_names_and_tag_prefixes_preserves_leading_zeros_and_reading_identity(): void
    {
        DB::table('tags')->insert([['id' => 1, 'codigo' => '00123'], ['id' => 2, 'codigo' => '99123']]);
        DB::table('vecinos')->insert([['id' => 1, 'nombre' => "Ana López"], ['id' => 2, 'nombre' => 'Ana Martínez']]);
        DB::table('tag_vecino')->insert([['tag_id' => 1, 'vecino_id' => 1], ['tag_id' => 1, 'vecino_id' => 2]]);
        $this->events(['2026-10-26 01:00:00,1,00123,1,0,0,4', '2026-10-26 01:00:00,2,99123,2,20,1,4']);
        $this->login('vigilancia');
        DB::table('control_acceso_monitor_configuracion')->where('id', 1)->update(['historial_vigilancia' => true]);
        $this->getJson($this->feed('&q=001'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.card_no', '00123');
        $this->getJson($this->feed('&q=Ana'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.neighbor_status', 'multiple');
        $this->getJson($this->feed('&q=Inexistente'))->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($this->feed('&card_no=00123'))->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_search_treats_sql_wildcards_as_literal_text(): void
    {
        DB::table('tags')->insert([['id' => 1, 'codigo' => '123'], ['id' => 2, 'codigo' => '456']]);
        DB::table('vecinos')->insert([['id' => 1, 'nombre' => 'Ana 100%'], ['id' => 2, 'nombre' => 'Ana normal']]);
        DB::table('tag_vecino')->insert([['tag_id' => 1, 'vecino_id' => 1], ['tag_id' => 2, 'vecino_id' => 2]]);
        $this->events(['2026-10-26 01:00:00,1,123,1,0,0,4', '2026-10-26 01:00:00,2,456,2,0,1,4']);
        $this->login();
        $this->getJson($this->feed('&q=%25'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.card_no', '123');
        $this->getJson($this->feed('&q=_'))->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_date_range_uses_capture_day_in_mexico_with_exclusive_next_midnight(): void
    {
        foreach (['2026-10-26T05:59:59Z', '2026-10-26T06:00:00Z', '2026-10-27T05:59:59.999999Z', '2026-10-27T06:00:00Z'] as $i => $stamp) {
            $this->now = $stamp;
            $this->events(['2020-01-01 00:00:00,1,'.(100 + $i).',1,0,0,4'], 'rt', $i);
        }
        $this->login();
        $this->getJson($this->feed('&date_from=2026-10-26&date_to=2026-10-26'))->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.card_no', '101')->assertJsonPath('data.1.card_no', '102');
        $this->getJson($this->feed('&date_to=2026-10-26'))->assertOk()->assertJsonCount(3, 'data');
        $this->getJson($this->feed('&date_from=2026-10-27'))->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_result_filters_combine_with_door_and_cursor_without_modifying_rows(): void
    {
        $this->events(['2026-10-26 01:00:00,1,123,1,0,0,4', '2026-10-26 01:00:01,1,123,1,20,0,4',
            '2026-10-26 01:00:02,2,456,2,99,1,4', '2026-10-26 01:00:03,2,456,2,255,1,4']);
        $this->login();
        foreach (['authorized' => 0, 'repeated' => 20, 'review' => 99] as $filter => $code) {
            $this->getJson($this->feed('&result='.$filter))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.event_code', $code);
        }
        $first = $this->getJson($this->feed('&q=123&door_id=1&limit=1'))->assertOk()->assertJsonPath('meta.has_more', true)->json('data.0.id');
        $this->getJson($this->feed('&q=123&door_id=1&before_id='.$first))->assertOk()->assertJsonCount(1, 'data');
        $this->assertSame(4, DB::table('control_acceso_filas')->count());
    }

    public function test_new_filters_reject_invalid_dates_values_and_search_arrays(): void
    {
        $this->login();
        foreach (['&date_from=2026-02-30', '&date_from=2026-10-27&date_to=2026-10-26', '&result=paid',
            '&q[]=Ana', '&q='.str_repeat('x', 121)] as $query) {
            $this->getJson($this->feed($query))->assertUnprocessable();
        }
    }

    public function test_guard_history_is_denied_by_default_including_direct_queries_but_current_and_state_work(): void
    {
        $this->events(['2026-10-26 10:00:00,1,00111,1,0,0,4', '2026-10-26 10:01:00,2,222,2,0,1,4',
            '2026-10-26 10:02:00,3,333,1,20,0,4']);
        $this->login('vigilancia');
        $this->getJson($this->states())->assertOk()->assertJsonPath('meta.permissions.can_view_history', false)
            ->assertJsonPath('meta.permissions.can_manage_history', false);
        foreach (['', '&after_id=0', '&before_id=100', '&q=001', '&source=all', '&date_from=2020-01-01'] as $query) {
            $this->getJson($this->feed($query))->assertForbidden()->assertJsonPath('code', 'history_forbidden');
        }
        $this->getJson('/api/control-acceso/monitor/actual?agent_id='.$this->agent)->assertOk()
            ->assertJsonCount(2, 'data')->assertJsonPath('data.0.card_no', '222')->assertJsonPath('data.1.card_no', '333')
            ->assertJsonPath('meta.current_only', true)->assertJsonPath('meta.has_more', false)
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->getJson('/api/control-acceso/monitor/actual?agent_id='.$this->agent.'&door_id=1')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.card_no', '333');
    }

    public function test_current_is_not_a_history_backdoor_and_skips_non_tag_and_other_sources(): void
    {
        $this->events(['2026-10-26 10:00:00,1,00111,1,0,0,4', '2026-10-26 10:01:00,0,0,1,200,0,0',
            '2026-10-26 10:02:00,2,222,3,0,0,4', '2026-10-26 10:03:00,0,0,0,255,0,0']);
        $this->events(['2026-10-26 10:04:00,1,999,1,0,0,4'], 'rt', 1);
        DB::table('control_acceso_respuestas')->orderByDesc('id')->limit(1)->update(['source' => 'transaction']);
        $this->login('vigilancia');
        $url = '/api/control-acceso/monitor/actual?agent_id='.$this->agent;
        $this->getJson($url)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.card_no', '00111');
        foreach (['&after_id=0', '&before_id=999', '&q=00111', '&card_no=00111', '&date_from=2020-01-01',
            '&source=all', '&limit=100', '&door_id=3', '&door_id[]=1'] as $query) {
            $this->getJson($url.$query)->assertUnprocessable();
        }
        $this->getJson('/api/control-acceso/monitor/actual?agent_id='.$this->other)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/control-acceso/monitor/actual?agent_id=90000000-0000-4000-8000-000000000009')->assertNotFound();
    }

    public function test_only_admin_can_change_persistent_history_setting_and_admin_always_has_history(): void
    {
        $url = '/api/control-acceso/monitor/configuracion';
        foreach (['vigilancia', 'capturista', 'residente', 'unknown'] as $role) {
            $this->login($role);
            $this->getJson($url)->assertForbidden();
            $this->patchJson($url, ['history_for_guards' => true, 'revision' => 1])->assertForbidden();
        }
        $this->login();
        $this->getJson($url)->assertOk()->assertJsonPath('data.history_for_guards', false)->assertJsonPath('data.revision', 1);
        $this->getJson($this->feed())->assertOk();
        $this->patchJson($url, ['history_for_guards' => true, 'revision' => 1])->assertOk()
            ->assertJsonPath('data.history_for_guards', true)->assertJsonPath('data.revision', 2);
        $this->assertDatabaseHas('control_acceso_monitor_configuracion', ['id' => 1, 'historial_vigilancia' => true, 'updated_by' => 1]);
        $this->login('vigilancia');
        $this->getJson($this->feed('&after_id=0'))->assertOk();
        $this->getJson($this->states())->assertJsonPath('meta.permissions.can_view_history', true)
            ->assertJsonPath('meta.permissions.can_manage_history', false);
        $this->login();
        $this->patchJson($url, ['history_for_guards' => false, 'revision' => 2])->assertOk()->assertJsonPath('data.revision', 3);
        $this->getJson($this->feed())->assertOk();
        $this->getJson($this->states())->assertJsonPath('meta.permissions.can_view_history', true);
        $this->login('vigilancia');
        $this->getJson($this->feed())->assertForbidden();
        $this->getJson('/api/control-acceso/monitor/actual?agent_id='.$this->agent)->assertOk();
    }

    public function test_setting_rejects_stale_writes_invalid_booleans_and_arbitrary_fields(): void
    {
        $this->login();
        $url = '/api/control-acceso/monitor/configuracion';
        foreach ([['history_for_guards' => 'false', 'revision' => 1], ['history_for_guards' => 1, 'revision' => 1],
            ['history_for_guards' => false, 'revision' => 0], ['history_for_guards' => true],
            ['history_for_guards' => true, 'revision' => 1, 'can_manage_history' => true]] as $input) {
            $this->patchJson($url, $input)->assertUnprocessable();
        }
        $this->patchJson($url.'?revision=1', ['history_for_guards' => true, 'revision' => 1])->assertUnprocessable();
        $this->patchJson($url, ['history_for_guards' => true, 'revision' => 1])->assertOk();
        $this->patchJson($url, ['history_for_guards' => false, 'revision' => 1])->assertConflict()
            ->assertJsonPath('code', 'monitor_settings_conflict')->assertJsonPath('data.history_for_guards', true);
        $this->getJson($url)->assertJsonPath('data.revision', 2);
    }

    public function test_new_routes_require_human_auth_and_feature_flag_and_migration_preserves_events(): void
    {
        $current = '/api/control-acceso/monitor/actual?agent_id='.$this->agent;
        $settings = '/api/control-acceso/monitor/configuracion';
        $this->getJson($current)->assertUnauthorized();
        $this->getJson($settings)->assertUnauthorized();
        $this->patchJson($settings, ['history_for_guards' => true, 'revision' => 1])->assertUnauthorized();
        foreach (['residente', 'capturista', 'unknown'] as $role) {
            $this->login($role); $this->getJson($current)->assertForbidden();
        }
        $this->login();
        config(['control_acceso.monitor_enabled' => false]);
        $this->getJson($current)->assertNotFound();
        $this->patchJson($settings, ['history_for_guards' => true, 'revision' => 1])->assertNotFound();
        config(['control_acceso.monitor_enabled' => true]);
        $this->events(['2026-10-26 10:00:00,1,111,1,0,0,4']);
        $before = DB::table('control_acceso_filas')->get()->toJson();
        $migration = require database_path('migrations/2026_10_30_010000_create_control_acceso_monitor_settings.php');
        $migration->down(); $migration->up();
        $this->assertSame($before, DB::table('control_acceso_filas')->get()->toJson());
        $this->getJson($current)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson($settings)->assertJsonPath('data.history_for_guards', false);
    }

}
