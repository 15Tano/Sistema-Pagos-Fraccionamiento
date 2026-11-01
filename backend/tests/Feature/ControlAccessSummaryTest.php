<?php

namespace Tests\Feature;

use App\Services\ControlAcceso\IngestionSummary;
use App\Services\ControlAcceso\RetentionService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ControlAccessSummaryTest extends ControlAccessRetentionTest
{
    private function enable(): void
    {
        (require database_path('migrations/2026_11_01_000000_create_control_acceso_summaries.php'))->up();
        config(['control_acceso.ingestion_summary_enabled' => true]);
    }

    private function freshBatch(string $raw): array
    {
        $payload = $this->batch();
        $payload['sequence'] = DB::table('control_acceso_lotes')->count();
        $payload['responses'][0] = array_replace($payload['responses'][0], [
            'raw_payload_base64' => base64_encode($raw), 'sha256' => hash('sha256', $raw),
            'captured_started_utc' => CarbonImmutable::now('UTC')->toISOString(),
            'captured_ended_utc' => CarbonImmutable::now('UTC')->toISOString(),
        ]);

        return $payload;
    }

    private function freshState(int $sequence = 0): array
    {
        return array_replace($this->state(), ['sequence' => $sequence,
            'reported_at_utc' => CarbonImmutable::now('UTC')->toISOString()]);
    }

    public function test_100_statuses_produce_one_summary_no_rows_and_no_raw_copies(): void
    {
        $this->enable();
        for ($i = 0; $i < 100; $i++) {
            $this->send($this->freshBatch("2026-10-31 12:00:00,0,0,0,255,0,0\r\n"))->assertCreated()
                ->assertJsonPath('rows_stored', 0)->assertJsonPath('statuses_summarized', 1);
        }
        $this->assertDatabaseCount('control_acceso_filas', 0);
        $this->assertDatabaseCount('control_acceso_resumenes', 1);
        $this->assertSame(100, (int) DB::table('control_acceso_resumenes')->value('statuses'));
        $this->assertSame(0, DB::table('control_acceso_respuestas')->where('raw_payload_base64', '<>', '')->count());
    }

    public function test_mixed_payload_keeps_event_and_original_and_summary_replay_is_idempotent(): void
    {
        $this->enable();
        $raw = "2026-10-31 12:00:00,0,0,0,255,0,0\r\n2026-10-31 12:00:01,42,12345678,1,0,0,4\r\n";
        $payload = $this->freshBatch($raw);
        $ack = $this->send($payload)->assertCreated()->assertJsonPath('events_stored', 1)
            ->assertJsonPath('statuses_stored', 0)->assertJsonPath('rows_stored', 1)->json();
        $this->send($payload)->assertOk()->assertExactJson($ack);
        $this->assertSame(1, (int) DB::table('control_acceso_resumenes')->value('statuses'));
        $this->assertDatabaseCount('control_acceso_filas', 1);
        $this->assertSame(base64_encode($raw), DB::table('control_acceso_respuestas')->value('raw_payload_base64'));
    }

    public function test_health_updates_snapshot_but_does_not_repeat_detail_for_only_timestamp_changes(): void
    {
        $this->enable();
        $one = $this->freshState();
        $this->send($one, 'estado')->assertCreated();
        CarbonImmutable::setTestNow(CarbonImmutable::now('UTC')->addSeconds(30));
        $two = $this->freshState(1);
        $two['sdk']['last_ok_utc'] = CarbonImmutable::now('UTC')->toISOString();
        $ack = $this->send($two, 'estado')->assertCreated()->json();
        $this->assertDatabaseCount('control_acceso_salud_actual', 1);
        $this->assertSame('{}', DB::table('control_acceso_estados')->where('sequence', 1)->value('payload'));
        $this->assertSame($two['reported_at_utc'], json_decode(IngestionSummary::latestState($this->agent)->payload, true)['reported_at_utc']);
        $this->send($two, 'estado')->assertOk()->assertExactJson($ack);
        $three = $this->freshState(2);
        $three['sdk']['last_error_code'] = -1;
        $this->send($three, 'estado')->assertCreated();
        $this->assertNotSame('{}', DB::table('control_acceso_estados')->where('sequence', 2)->value('payload'));
        $older = array_replace($one, ['sequence' => 3]);
        $this->send($older, 'estado')->assertCreated();
        $this->assertSame(-1, json_decode(IngestionSummary::latestState($this->agent)->payload, true)['sdk']['last_error_code']);
    }

    public function test_old_ids_are_removed_and_expired_replays_cannot_reinsert(): void
    {
        $this->enable();
        $payload = $this->freshBatch("2026-10-31 12:00:00,0,0,0,255,0,0\r\n");
        $this->send($payload)->assertCreated();
        $this->send($this->freshState(), 'estado')->assertCreated();
        CarbonImmutable::setTestNow(CarbonImmutable::now('UTC')->addDays(8));
        $this->send($this->freshState(1), 'estado')->assertCreated();
        $plan = app(RetentionService::class)->run();
        $result = app(RetentionService::class)->run(true);
        $plan['mode'] = 'apply';
        $this->assertSame($plan, $result);
        $this->assertSame(1, $result['response_receipts_deleted']);
        $this->assertSame(1, $result['batches_deleted']);
        $this->assertSame(1, $result['state_receipts_deleted']);
        $this->assertSame(1, $result['summaries_deleted']);
        $this->send($payload)->assertStatus(410);
        $this->assertDatabaseCount('control_acceso_respuestas', 0);
        $this->assertDatabaseCount('control_acceso_lotes', 0);
    }

    public function test_snapshot_survives_journal_expiry_and_feature_flag_rollback(): void
    {
        $this->enable();
        $this->send($this->freshState(), 'estado')->assertCreated();
        $expected = IngestionSummary::latestState($this->agent)->payload;
        CarbonImmutable::setTestNow(CarbonImmutable::now('UTC')->addDays(8));
        app(RetentionService::class)->run(true);
        config(['control_acceso.ingestion_summary_enabled' => false]);
        $this->assertSame($expected, IngestionSummary::latestState($this->agent)->payload);
        $new = $this->freshState(1);
        $this->send($new, 'estado')->assertCreated();
        $this->assertSame($new['reported_at_utc'], json_decode(IngestionSummary::latestState($this->agent)->payload, true)['reported_at_utc']);
    }

    public function test_future_clock_and_unknown_formats_do_not_get_summarized_as_status(): void
    {
        $this->enable();
        $unknown = $this->freshBatch('malformed status,255');
        $this->send($unknown)->assertCreated()->assertJsonPath('responses_pending_interpretation', 1);
        $this->assertDatabaseCount('control_acceso_resumenes', 0);
        $this->assertSame(base64_encode('malformed status,255'), DB::table('control_acceso_respuestas')->value('raw_payload_base64'));
        $future = $this->freshState();
        $future['reported_at_utc'] = CarbonImmutable::now('UTC')->addMinutes(6)->toISOString();
        $this->send($future, 'estado')->assertStatus(422);
    }

    public function test_dell_cumulative_counters_are_not_counted_again_on_replay_or_legacy_report(): void
    {
        $this->enable();
        $payload = $this->freshState();
        $epoch = (string) Str::uuid();
        $metrics = ['status_observations_epoch' => $epoch, 'statuses_observed_total' => 100,
            'status_responses_total' => 100, 'status_last_observed_utc' => $payload['reported_at_utc']];
        $payload['sdk'] += $metrics;
        $ack = $this->send($payload, 'estado')->assertCreated()->json();
        $this->send($payload, 'estado')->assertOk()->assertExactJson($ack);
        $legacy = $this->freshState(1);
        $this->send($legacy, 'estado')->assertCreated();
        $next = $this->freshState(2);
        $next['sdk'] += array_replace($metrics, ['statuses_observed_total' => 110, 'status_responses_total' => 110]);
        $this->send($next, 'estado')->assertCreated();
        $this->assertSame(110, (int) DB::table('control_acceso_resumenes')->value('statuses'));
        $this->assertSame(110, (int) DB::table('control_acceso_resumenes')->value('responses'));
        $invalid = $this->freshState(3);
        $invalid['sdk']['status_observations_epoch'] = $epoch;
        $this->send($invalid, 'estado')->assertStatus(422);
    }

    public function test_capabilities_are_authenticated_and_report_activation_state(): void
    {
        $url = '/api/control-acceso/agente/capacidades';
        $this->getJson($url)->assertUnauthorized();
        $this->getJson($url, ['Authorization' => 'Bearer '.$this->token])->assertOk()->assertJsonPath('storage_policy', 'legacy-v1');
        $this->enable();
        $this->getJson($url, ['Authorization' => 'Bearer '.$this->token])->assertOk()
            ->assertJsonPath('storage_policy', 'summary-v1')->assertJsonPath('retry_window_days', 7);
    }

    public function test_unused_summary_migration_reverses_and_reapplies(): void
    {
        $this->enable();
        $migration = require database_path('migrations/2026_11_01_000000_create_control_acceso_summaries.php');
        $migration->down();
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasTable('control_acceso_salud_actual'));
        $migration->up();
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasTable('control_acceso_resumenes'));
    }

    public function test_summary_migration_cannot_remove_active_snapshot(): void
    {
        $this->enable();
        $this->send($this->freshState(), 'estado')->assertCreated();
        $migration = require database_path('migrations/2026_11_01_000000_create_control_acceso_summaries.php');
        $this->expectException(\RuntimeException::class);
        $migration->down();
    }
}
