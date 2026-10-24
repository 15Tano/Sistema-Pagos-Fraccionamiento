<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ControlAccessIngestionTest extends TestCase
{
    protected string $agent = '10000000-0000-4000-8000-000000000001';

    protected string $session = '20000000-0000-4000-8000-000000000001';

    protected string $token;

    protected string $serial = 'TEST-C3-001';

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepareDatabase();
        (require database_path('migrations/2026_10_23_210000_create_control_acceso_ingestion_tables.php'))->up();
        $this->token = 'sica_'.str_repeat('a', 64);
        DB::table('control_acceso_agentes')->insert(['id' => $this->agent, 'nombre' => 'Caseta de prueba',
            'device_serial' => $this->serial, 'token_hash' => hash('sha256', $this->token),
            'created_at' => now(), 'updated_at' => now()]);
    }

    protected function prepareDatabase(): void
    {
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:',
            'cache.default' => 'array']);
        DB::purge('sqlite');
        DB::statement('PRAGMA foreign_keys = ON');
    }

    private function envelope(): array
    {
        return ['protocol_version' => 1, 'agent_id' => $this->agent, 'device_serial' => $this->serial,
            'session_id' => $this->session, 'sequence' => 0];
    }

    protected function state(): array
    {
        return $this->envelope() + ['reported_at_utc' => '2026-10-24T02:27:44.291472+00:00',
            'agent_version' => 'test-1', 'worker_version' => 'test-1', 'pid' => 100,
            'vigencias' => ['protocol' => 2, 'pid' => 100, 'run_started_utc' => '2026-10-24T02:26:37Z',
                'phase' => 'idle', 'last_ok_utc' => '2026-10-24T02:27:44Z', 'consecutive_errors' => 0,
                'heartbeat_utc' => '2026-10-24T02:27:44Z'],
            'sdk' => ['last_ok_utc' => '2026-10-24T02:26:27Z', 'last_error_code' => null],
            'reader' => ['state' => 'status_observed', 'checked_at_utc' => '2026-10-24T02:26:27Z'],
            'sender' => ['pending_count' => 1, 'oldest_pending_at_utc' => null, 'last_ack_at_utc' => null]];
    }

    private function response(string $raw = "2026-10-23 19:49:05,42,12345678,2,0,1,4\r\n", string $source = 'rt', int $code = 1): array
    {
        return ['response_id' => (string) Str::uuid(), 'source' => $source, 'sdk_return_code' => $code,
            'raw_payload_base64' => base64_encode($raw), 'sha256' => hash('sha256', $raw),
            'captured_started_utc' => '2026-10-24T02:12:01.854246+00:00',
            'captured_ended_utc' => '2026-10-24T02:12:01.951000+00:00',
            'pc_local_time' => '2026-10-23T20:12:01.854246-06:00',
            'windows_timezone' => 'Central Standard Time (Mexico)'];
    }

    protected function batch(?array $responses = null): array
    {
        return $this->envelope() + ['batch_id' => (string) Str::uuid(), 'responses' => $responses ?? [$this->response()]];
    }

    protected function send(array $payload, string $endpoint = 'lotes', ?string $token = null)
    {
        return $this->postJson('/api/control-acceso/agente/'.$endpoint, $payload,
            ['Authorization' => 'Bearer '.($token ?? $this->token)]);
    }

    protected function assertNoIngestion(): void
    {
        foreach (['estados', 'lotes', 'respuestas', 'filas'] as $name) {
            $this->assertDatabaseCount('control_acceso_'.$name, 0);
        }
    }

    public function test_missing_invalid_human_and_revoked_credentials_are_not_agents(): void
    {
        foreach (['estado', 'lotes'] as $endpoint) {
            $payload = $endpoint === 'estado' ? $this->state() : $this->batch();
            $this->postJson('/api/control-acceso/agente/'.$endpoint, $payload)->assertUnauthorized();
            $this->send($payload, $endpoint, 'human-sanctum-token')->assertUnauthorized();
            $this->send($payload, $endpoint, 'sica_'.str_repeat('b', 64))->assertUnauthorized();
        }
        Sanctum::actingAs(new User(['name' => 'Admin test', 'role' => 'admin']));
        $this->postJson('/api/control-acceso/agente/estado', $this->state())->assertUnauthorized();
        DB::table('control_acceso_agentes')->where('id', $this->agent)->update(['revoked_at' => now()]);
        $this->send($this->batch())->assertUnauthorized();
        $this->assertNoIngestion();
    }

    public function test_agent_cannot_claim_another_agent_or_controller(): void
    {
        $this->send(array_replace($this->state(), ['agent_id' => (string) Str::uuid()]), 'estado')->assertForbidden();
        $this->send(array_replace($this->batch(), ['device_serial' => 'OTHER-C3']))->assertForbidden();
        $this->assertNoIngestion();
    }

    public function test_agent_credential_does_not_authenticate_as_a_human(): void
    {
        Schema::create('personal_access_tokens', function ($table) {
            $table->id();
            $table->string('token', 64)->unique();
        });
        $this->withHeaders(['Authorization' => 'Bearer '.$this->token])
            ->getJson('/api/me')->assertUnauthorized();
        $this->assertNoIngestion();
    }

    public function test_revocation_after_middleware_lookup_prevents_ingestion(): void
    {
        $revoked = false;
        DB::listen(function (QueryExecuted $query) use (&$revoked) {
            if (! $revoked && str_starts_with($query->sql, 'select') &&
                str_contains($query->sql, 'control_acceso_agentes') && str_contains($query->sql, 'token_hash')) {
                $revoked = true;
                DB::table('control_acceso_agentes')->where('id', $this->agent)->update(['revoked_at' => now()]);
            }
        });
        $this->send($this->batch())->assertUnauthorized();
        $this->assertTrue($revoked);
        $this->assertNoIngestion();
    }

    public function test_state_is_durable_idempotent_and_keeps_older_reports_separate(): void
    {
        $payload = $this->state();
        $first = $this->send($payload, 'estado')->assertCreated()->json();
        $this->send(array_reverse($payload, true), 'estado')->assertOk()->assertExactJson($first);
        $changed = $payload;
        $changed['reader']['state'] = 'catching_up';
        $this->send($changed, 'estado')->assertConflict();
        $older = array_replace($payload, ['sequence' => 1, 'reported_at_utc' => '2026-10-24T01:00:00Z']);
        $this->send($older, 'estado')->assertCreated();
        $this->assertDatabaseCount('control_acceso_estados', 2);
        $stored = json_decode(DB::table('control_acceso_estados')->orderBy('id')->first()->payload, true);
        $this->assertSame('idle', $stored['vigencias']['phase']);
        $this->assertSame('2026-10-24T02:27:44.291472+00:00', $stored['reported_at_utc']);
        $this->assertStringNotContainsString($this->token, json_encode($first));
    }

    public function test_invalid_state_fields_dates_and_numeric_types_do_not_persist(): void
    {
        foreach ([['protocol_version', 2], ['pid', -1], ['sequence', '0'], ['sequence', 0.5],
            ['reported_at_utc', '2026-10-23T20:27:44-06:00'], ['reported_at_utc', '2026-02-30T02:00:00Z'],
            ['reported_at_utc', '0000-01-01T00:00:00Z']] as [$field, $value]) {
            $this->send(array_replace($this->state(), [$field => $value]), 'estado')->assertUnprocessable();
        }
        $state = $this->state();
        $state['vigencias']['password'] = 'must-not-be-accepted';
        $this->send($state, 'estado')->assertUnprocessable();
        $state = $this->state();
        $state['expiration'] = '2099-01-01';
        $this->send($state, 'estado')->assertUnprocessable();
        $this->assertNoIngestion();
    }

    public function test_raw_rt_rows_preserve_multiplicity_codes_and_status_without_tag_association(): void
    {
        Schema::create('tags', function ($table) {
            $table->id();
            $table->string('codigo');
            $table->boolean('activo');
        });
        DB::table('tags')->insert(['codigo' => '12345678', 'activo' => false]);
        $line = "2026-10-23 19:49:05,42,12345678,2,0,1,4\r\n";
        $raw = $line.$line."2026-10-23 19:49:05,42,12345678,2,20,1,4\r\n".
            "2026-10-23 19:49:05,42,12345678,2,999,1,4\r\n".
            "2026-10-23 20:26:21,1,2,0,255,0,200\r\n";
        $item = $this->response($raw, 'rt', 5);
        $this->send($this->batch([$item]))->assertCreated()->assertJsonPath('events_stored', 4)
            ->assertJsonPath('statuses_stored', 1)->assertJsonPath('rows_stored', 5);
        $this->assertDatabaseCount('control_acceso_filas', 5);
        $this->assertDatabaseHas('control_acceso_filas', ['ordinal' => 1, 'event_code' => 0]);
        $this->assertDatabaseHas('control_acceso_filas', ['event_code' => 255, 'kind' => 'status', 'card_no' => null, 'door_id' => null]);
        $this->assertDatabaseHas('control_acceso_filas', ['event_code' => 999, 'kind' => 'event']);
        $stored = DB::table('control_acceso_respuestas')->first();
        $this->assertSame($raw, base64_decode($stored->raw_payload_base64));
        $this->assertSame(hash('sha256', $raw), $stored->sha256);
        $this->assertDatabaseHas('tags', ['codigo' => '12345678', 'activo' => false]);
    }

    public function test_transaction_time_matches_verified_sdk_formula_without_assuming_utc(): void
    {
        $raw = "Cardno,Pin,Verified,DoorID,EventType,InOutState,Time_second\r\n12345678,42,4,2,0,1,861738545\r\n";
        $this->send($this->batch([$this->response($raw, 'transaction')]))->assertCreated();
        $this->assertDatabaseHas('control_acceso_filas', ['card_no' => '12345678', 'device_time_raw' => '2026-10-23 19:49:05',
            'time_second' => '861738545', 'verification' => '4', 'door_id' => '2', 'direction' => '1']);
    }

    public function test_negative_unknown_binary_and_incomplete_responses_remain_raw_only(): void
    {
        $responses = [$this->response('sdk error bytes', 'rt', -2), $this->response('new,unknown,format'),
            $this->response("\xff\0"),
            $this->response("Cardno,Pin,Verified,DoorID,EventType,InOutState,Time_second\r\n", 'transaction', 1)];
        $this->send($this->batch($responses))->assertCreated()->assertJsonPath('responses_stored', 4)
            ->assertJsonPath('rows_stored', 0)->assertJsonPath('responses_pending_interpretation', 4);
        $this->assertDatabaseHas('control_acceso_respuestas', ['sdk_return_code' => -2, 'parse_status' => 'sdk_error']);
        $this->assertDatabaseCount('control_acceso_filas', 0);
        foreach ($responses as $item) {
            $this->assertDatabaseHas('control_acceso_respuestas', ['response_id' => $item['response_id'],
                'raw_payload_base64' => $item['raw_payload_base64']]);
        }
    }

    public function test_empty_payload_and_zero_return_are_preserved_without_inventing_queue_status(): void
    {
        $this->send($this->batch([$this->response('', 'rt', 0)]))->assertCreated()->assertJsonPath('rows_stored', 0);
        $this->assertDatabaseHas('control_acceso_respuestas', ['payload_bytes' => 0, 'raw_payload_base64' => '', 'parse_status' => 'parsed']);
        $this->assertDatabaseCount('control_acceso_filas', 0);
    }

    public function test_batch_retries_return_same_durable_ack_and_changed_content_conflicts(): void
    {
        $batch = $this->batch();
        $first = $this->send($batch)->assertCreated()->json();
        $reordered = array_reverse($batch, true);
        $reordered['responses'][0] = array_reverse($batch['responses'][0], true);
        $this->send($reordered)->assertOk()->assertExactJson($first);
        config(['control_acceso.max_rows' => 0]);
        $this->send($batch)->assertOk()->assertExactJson($first);
        config(['control_acceso.max_rows' => 2000]);
        $changed = $batch;
        $changed['responses'][0]['pc_local_time'] = '2026-10-23T20:12:02-06:00';
        $this->send($changed)->assertConflict();
        $this->assertDatabaseCount('control_acceso_lotes', 1);
        $this->assertDatabaseCount('control_acceso_respuestas', 1);
        $this->assertDatabaseCount('control_acceso_filas', 1);
    }

    public function test_same_response_or_sequence_cannot_be_repackaged_as_another_batch(): void
    {
        $batch = $this->batch();
        $this->send($batch)->assertCreated();
        $other = $batch;
        $other['batch_id'] = (string) Str::uuid();
        $this->send($other)->assertConflict();
        $other['sequence'] = 1;
        $other['responses'][] = $this->response();
        $this->send($other)->assertConflict();
        $this->assertDatabaseCount('control_acceso_lotes', 1);
        $this->assertDatabaseCount('control_acceso_respuestas', 1);
    }

    public function test_invalid_hash_base64_time_or_spoofed_parsed_fields_reject_the_entire_batch(): void
    {
        foreach (['sha256' => str_repeat('0', 64), 'raw_payload_base64' => '%%%',
            'captured_ended_utc' => '2026-10-24T02:11:00Z', 'rows' => [['card_no' => 'forged']]] as $field => $value) {
            $item = $this->response();
            $item[$field] = $value;
            $this->send($this->batch([$this->response(), $item]))->assertUnprocessable();
        }
        $this->assertNoIngestion();
    }

    public function test_size_row_and_duplicate_response_limits_have_no_partial_ack(): void
    {
        $item = $this->response();
        $this->send($this->batch([$item, $item]))->assertUnprocessable();
        config(['control_acceso.max_body_bytes' => 100]);
        $this->send($this->batch())->assertStatus(413);
        config(['control_acceso.max_body_bytes' => 1048576, 'control_acceso.max_responses' => 1]);
        $this->send($this->batch([$this->response(), $this->response()]))->assertUnprocessable();
        config(['control_acceso.max_responses' => 100, 'control_acceso.max_rows' => 4]);
        $line = "2026-10-23 19:49:05,42,12345678,2,0,1,4\r\n";
        $this->send($this->batch([$this->response(str_repeat($line, 3), 'rt', 3),
            $this->response(str_repeat($line, 3), 'rt', 3)]))->assertUnprocessable();
        $this->assertNoIngestion();
    }

    public function test_malformed_json_and_non_json_are_rejected(): void
    {
        $headers = ['HTTP_AUTHORIZATION' => 'Bearer '.$this->token, 'CONTENT_TYPE' => 'application/json'];
        $this->call('POST', '/api/control-acceso/agente/lotes', [], [], [], $headers, '{')->assertUnprocessable();
        $headers['CONTENT_TYPE'] = 'text/plain';
        $this->call('POST', '/api/control-acceso/agente/lotes', [], [], [], $headers, '{}')->assertStatus(415);
        $this->assertNoIngestion();
    }

    public function test_database_failure_during_rows_rolls_back_batch_and_all_responses(): void
    {
        $this->withoutExceptionHandling();
        $insertions = 0;
        DB::listen(function (QueryExecuted $query) use (&$insertions) {
            if (str_contains(str_replace('`', '"', $query->sql), 'insert into "control_acceso_filas"') && ++$insertions === 2) {
                throw new \RuntimeException('simulated persistence failure');
            }
        });
        try {
            $this->send($this->batch([$this->response(), $this->response()]));
            $this->fail('Expected simulated database failure.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('simulated persistence failure', $exception->getMessage());
        }
        $this->assertNoIngestion();
    }

    public function test_cli_credentials_rotate_revoke_and_never_store_the_secret(): void
    {
        $this->assertSame(0, Artisan::call('control-acceso:agente', ['operacion' => 'crear', '--nombre' => 'Test', '--serial' => 'TEST-C3-NEW']));
        preg_match('/token: (sica_[a-f0-9]{64})/', Artisan::output(), $matches);
        $token = $matches[1];
        $agent = DB::table('control_acceso_agentes')->where('device_serial', 'TEST-C3-NEW')->first();
        $this->assertSame(hash('sha256', $token), $agent->token_hash);
        $payload = array_replace($this->state(), ['agent_id' => $agent->id, 'device_serial' => $agent->device_serial]);
        $this->send($payload, 'estado', $token)->assertCreated();
        $this->assertSame(0, Artisan::call('control-acceso:agente', ['operacion' => 'rotar', '--id' => $agent->id]));
        preg_match('/token: (sica_[a-f0-9]{64})/', Artisan::output(), $matches);
        $rotated = $matches[1];
        $this->assertNotSame($token, $rotated);
        $this->send($payload, 'estado', $token)->assertUnauthorized();
        $this->send($payload, 'estado', $rotated)->assertOk();
        Artisan::call('control-acceso:agente', ['operacion' => 'revocar', '--id' => $agent->id]);
        $this->send($payload, 'estado', $rotated)->assertUnauthorized();
        $this->assertDatabaseCount('control_acceso_estados', 1);
    }
}
