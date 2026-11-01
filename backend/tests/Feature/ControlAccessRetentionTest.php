<?php

namespace Tests\Feature;

use App\Services\ControlAcceso\IngestionService;
use App\Services\ControlAcceso\RetentionService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ControlAccessRetentionTest extends ControlAccessIngestionTest
{
    protected function setUp(): void
    {
        parent::setUp();
        (require database_path('migrations/2026_10_31_230000_add_control_acceso_retention_markers.php'))->up();
        CarbonImmutable::setTestNow('2026-10-31 12:00:00 UTC');
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function ingest(string $raw, int $age, string $source = 'rt'): array
    {
        $payload = $this->batch();
        $payload['sequence'] = DB::table('control_acceso_lotes')->count();
        $payload['responses'][0] = array_replace($payload['responses'][0], [
            'raw_payload_base64' => base64_encode($raw), 'sha256' => hash('sha256', $raw), 'source' => $source,
        ]);
        $ack = app(IngestionService::class)->batch($this->agent, hash('sha256', $this->token), $payload)['ack'];
        DB::table('control_acceso_lotes')->where('batch_id', $payload['batch_id'])->update([
            'received_at_utc' => CarbonImmutable::now('UTC')->subDays($age)->format('Y-m-d H:i:s.u'),
        ]);

        return [$payload, $ack];
    }

    private function event(string $door = '1', int $code = 0): string
    {
        return "2026-10-23 19:49:05,42,12345678,$door,$code,0,4\r\n";
    }

    public function test_plan_does_not_change_any_table_and_command_rejects_invalid_limits(): void
    {
        $this->ingest($this->event('1', 255), 8);
        $before = DB::table('control_acceso_filas')->get()->toJson();
        $this->artisan('control-acceso:retencion')->assertSuccessful();
        $this->assertSame($before, DB::table('control_acceso_filas')->get()->toJson());
        $this->assertNull(DB::table('control_acceso_respuestas')->value('retention_pruned_at_utc'));
        $this->artisan('control-acceso:retencion', ['--size' => '0'])->assertFailed();
        $this->artisan('control-acceso:retencion', ['--batches' => '101'])->assertFailed();
    }

    public function test_technical_pruning_preserves_replay_ack_and_response_conflicts(): void
    {
        [$payload, $ack] = $this->ingest($this->event('1', 255), 8);
        $plan = app(RetentionService::class)->run();
        $result = app(RetentionService::class)->run(true);
        $plan['mode'] = 'apply';
        $this->assertSame($plan, $result);
        $this->assertSame(1, $result['status_rows_deleted']);
        $this->assertSame(1, $result['responses_compacted']);
        $this->assertDatabaseCount('control_acceso_filas', 0);
        $this->assertSame('', DB::table('control_acceso_respuestas')->value('raw_payload_base64'));
        $this->send($payload)->assertOk()->assertExactJson($ack);
        $other = array_replace($payload, ['batch_id' => (string) Str::uuid(), 'sequence' => 100]);
        $this->send($other)->assertConflict();
        $payload['responses'][0]['sdk_return_code'] = 2;
        $this->send($payload)->assertConflict();
        $this->assertSame(0, app(RetentionService::class)->run(true)['responses_compacted']);
    }

    public function test_mixed_response_keeps_event_and_original_until_event_expires(): void
    {
        $raw = $this->event('1', 255).$this->event('1', 27);
        $this->ingest($raw, 8);
        app(RetentionService::class)->run(true);
        $this->assertDatabaseCount('control_acceso_filas', 1);
        $this->assertSame(base64_encode($raw), DB::table('control_acceso_respuestas')->value('raw_payload_base64'));
        $this->assertNull(DB::table('control_acceso_respuestas')->value('retention_pruned_at_utc'));
    }

    public function test_events_expire_after_90_days_but_current_rt_per_door_and_recent_receipts_survive(): void
    {
        $this->ingest($this->event('1', 20), 91);
        $this->ingest($this->event('1', 27), 91);
        $this->ingest($this->event('2'), 91);
        $this->ingest($this->event('1'), 90);
        $this->ingest($this->event('1', 255), config('control_acceso.retention_technical_days'));
        // Captures in fixture are old; receipt age alone determines retention.
        $this->ingest($this->event('2', 20), 0);
        $result = app(RetentionService::class)->run(true);
        $this->assertSame(3, $result['event_rows_deleted']);
        $this->assertSame(0, $result['status_rows_deleted']);
        $this->assertDatabaseCount('control_acceso_filas', 3);
        $this->assertSame([4, 5, 6], DB::table('control_acceso_filas')->orderBy('id')->pluck('id')->all());
    }

    public function test_inactive_controller_keeps_latest_rt_on_both_doors(): void
    {
        Schema::create('tags', function ($table) {
            $table->id();
            $table->string('codigo');
        });
        Schema::create('vecinos', function ($table) {
            $table->id();
            $table->string('nombre');
        });
        Schema::create('tag_vecino', function ($table) {
            $table->unsignedBigInteger('tag_id');
            $table->unsignedBigInteger('vecino_id');
        });
        $this->ingest($this->event('1'), 100);
        $this->ingest($this->event('2'), 100);
        $monitor = app(\App\Services\ControlAcceso\MonitorService::class);
        $before = $monitor->current(['agent_id' => $this->agent]);
        $result = app(RetentionService::class)->run(true);
        $this->assertSame(0, $result['event_rows_deleted']);
        $this->assertSame(0, $result['responses_compacted']);
        $this->assertSame($before, $monitor->current(['agent_id' => $this->agent]));
    }

    public function test_latest_state_by_reported_time_survives_and_old_replay_still_works(): void
    {
        $payload = $this->state();
        $service = app(IngestionService::class);
        $ack = $service->state($this->agent, hash('sha256', $this->token), $payload)['ack'];
        $latest = array_replace($payload, ['sequence' => 1, 'reported_at_utc' => '2026-10-25T00:00:00Z']);
        $service->state($this->agent, hash('sha256', $this->token), $latest);
        $service->state($this->agent, hash('sha256', $this->token), array_replace($payload, ['sequence' => 2]));
        DB::table('control_acceso_estados')->update(['received_at_utc' => '2026-10-01 00:00:00']);
        $monitor = app(\App\Services\ControlAcceso\MonitorService::class);
        $before = $monitor->states($this->agent);
        $result = app(RetentionService::class)->run(true);
        $this->assertSame($before, $monitor->states($this->agent));
        $this->assertSame(2, $result['states_compacted']);
        $this->assertSame('{}', DB::table('control_acceso_estados')->where('sequence', 0)->value('payload'));
        $this->assertNull(DB::table('control_acceso_estados')->where('sequence', 1)->value('retention_pruned_at_utc'));
        $this->send($payload, 'estado')->assertOk()->assertExactJson($ack);
        $payload['pid'] = 999;
        $this->send($payload, 'estado')->assertConflict();
    }

    public function test_batch_budget_bounds_work_and_reruns_complete_it(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->ingest($this->event('1', 255), 8);
        }
        $service = app(RetentionService::class);
        $this->assertSame(1, $service->run(true, 1, 1)['status_rows_deleted']);
        $this->assertDatabaseCount('control_acceso_filas', 2);
        $service->run(true, 1, 5);
        $this->assertDatabaseCount('control_acceso_filas', 0);
    }

    public function test_unused_migration_reverses_and_reapplication_is_safe(): void
    {
        $migration = require database_path('migrations/2026_10_31_230000_add_control_acceso_retention_markers.php');
        $migration->down();
        $this->assertFalse(Schema::hasColumn('control_acceso_estados', 'retention_pruned_at_utc'));
        $migration->up();
        $this->assertTrue(Schema::hasColumn('control_acceso_estados', 'retention_pruned_at_utc'));
    }

    public function test_schema_rollback_refuses_to_erase_pruning_evidence(): void
    {
        $this->ingest($this->event('1', 255), 8);
        app(RetentionService::class)->run(true);
        $migration = require database_path('migrations/2026_10_31_230000_add_control_acceso_retention_markers.php');
        $this->expectException(\RuntimeException::class);
        $migration->down();
    }

    public function test_recently_received_empty_and_unparsed_responses_are_not_pruned_early(): void
    {
        $this->ingest('', 0);
        $this->ingest('unknown format', 8);
        $result = app(RetentionService::class)->run(true);
        $this->assertSame(1, $result['responses_compacted']);
        $this->assertNull(DB::table('control_acceso_respuestas')->orderBy('id')->first()->retention_pruned_at_utc);
        $this->assertNotNull(DB::table('control_acceso_respuestas')->orderByDesc('id')->first()->retention_pruned_at_utc);
    }
}
