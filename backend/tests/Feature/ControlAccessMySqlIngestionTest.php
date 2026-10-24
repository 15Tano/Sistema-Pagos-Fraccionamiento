<?php

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Group;
use Symfony\Component\Process\Process;
use Tests\Support\ControlAccessMySqlTrial;

#[Group('mysql-ensayo')]
class ControlAccessMySqlIngestionTest extends ControlAccessIngestionTest
{
    protected function prepareDatabase(): void
    {
        if (! getenv('CA_MYSQL_TRIAL_FILE')) {
            $this->markTestSkipped('MySQL aislado: ejecutar tests/Support/control_acceso_mysql_trial.php run.');
        }
        ControlAccessMySqlTrial::configure();
        // Solo despues de validar servidor, ruta, nombre y marcador exclusivos.
        (require database_path('migrations/2026_10_23_210000_create_control_acceso_ingestion_tables.php'))->down();
        Schema::dropIfExists('tags');
        Schema::dropIfExists('personal_access_tokens');
    }

    private function worker(array $payload, string $endpoint): Process
    {
        return new Process([PHP_BINARY, base_path('tests/Support/control_acceso_mysql_worker.php')],
            base_path(), ['APP_ENV' => 'testing'], json_encode(['endpoint' => $endpoint,
                'payload' => $payload, 'token' => $this->token], JSON_THROW_ON_ERROR), 20);
    }

    private function race(array $payloads, string $endpoint = 'lotes', ?array $agentChange = null): array
    {
        $processes = array_map(fn ($payload) => $this->worker($payload, $endpoint), $payloads);
        DB::beginTransaction();
        try {
            DB::table('control_acceso_agentes')->where('id', $this->agent)->lockForUpdate()->first();
            if ($agentChange) {
                DB::table('control_acceso_agentes')->where('id', $this->agent)->update($agentChange);
            }
            foreach ($processes as $process) {
                $process->start();
            }
            $deadline = microtime(true) + 10;
            do {
                $waiters = DB::selectOne('SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits w
                    JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.BLOCKING_ENGINE_LOCK_ID
                    AND l.ENGINE = w.ENGINE WHERE l.OBJECT_SCHEMA = DATABASE()')->n;
                if ((int) $waiters >= count($processes)) {
                    break;
                }
                foreach ($processes as $process) {
                    if (! $process->isRunning()) {
                        $this->fail('Un worker termino antes de esperar el bloqueo: '.$process->getErrorOutput());
                    }
                }
                usleep(50000);
            } while (microtime(true) < $deadline);
            $this->assertGreaterThanOrEqual(count($processes), (int) $waiters,
                'MySQL debe confirmar que todos los procesos esperan el bloqueo del agente.');
            DB::commit();
            $results = [];
            foreach ($processes as $process) {
                $this->assertSame(0, $process->wait(), $process->getErrorOutput());
                $results[] = json_decode($process->getOutput(), true, 64, JSON_THROW_ON_ERROR);
            }

            return $results;
        } finally {
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            foreach ($processes as $process) {
                if ($process->isRunning()) {
                    $process->stop(1);
                }
            }
        }
    }

    public function test_mysql_concurrent_identical_batches_store_once_and_return_identical_ack(): void
    {
        $batch = $this->batch();
        $results = $this->race([$batch, $batch, $batch]);
        $codes = array_column($results, 'status');
        sort($codes);
        $this->assertSame([200, 200, 201], $codes);
        $this->assertEquals($results[0]['body'], $results[1]['body']);
        $this->assertEquals($results[0]['body'], $results[2]['body']);
        $this->assertDatabaseCount('control_acceso_lotes', 1);
        $this->assertDatabaseCount('control_acceso_respuestas', 1);
        $this->assertDatabaseCount('control_acceso_filas', 1);
    }

    public function test_mysql_concurrent_changed_batch_conflicts_without_partial_rows(): void
    {
        $first = $this->batch();
        $changed = $first;
        $changed['responses'][0]['pc_local_time'] = '2026-10-23T20:12:02-06:00';
        $results = $this->race([$first, $changed]);
        $codes = array_column($results, 'status');
        sort($codes);
        $this->assertSame([201, 409], $codes);
        $this->assertDatabaseCount('control_acceso_lotes', 1);
        $this->assertDatabaseCount('control_acceso_respuestas', 1);
        $this->assertDatabaseCount('control_acceso_filas', 1);
    }

    public function test_mysql_concurrent_state_reports_store_once(): void
    {
        $state = $this->state();
        $results = $this->race([$state, $state], 'estado');
        $codes = array_column($results, 'status');
        sort($codes);
        $this->assertSame([200, 201], $codes);
        $this->assertEquals($results[0]['body'], $results[1]['body']);
        $this->assertDatabaseCount('control_acceso_estados', 1);
    }

    public function test_mysql_revocation_committed_while_requests_wait_rejects_both(): void
    {
        $batch = $this->batch();
        $results = $this->race([$batch, $batch], 'lotes', ['revoked_at' => now('UTC')]);
        $this->assertSame([401, 401], array_column($results, 'status'));
        $this->assertNoIngestion();
    }

    public function test_mysql_rotation_committed_while_requests_wait_rejects_old_token(): void
    {
        $batch = $this->batch();
        $results = $this->race([$batch, $batch], 'lotes', ['token_hash' => hash('sha256', 'replacement-test-token')]);
        $this->assertSame([401, 401], array_column($results, 'status'));
        $this->assertNoIngestion();
    }

    public function test_mysql_tables_are_innodb_and_migration_reverses_and_reapplies(): void
    {
        $tables = DB::select("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'control_acceso_%'");
        $this->assertCount(5, $tables);
        foreach ($tables as $table) {
            $this->assertSame('InnoDB', $table->ENGINE);
        }
        $migration = require database_path('migrations/2026_10_23_210000_create_control_acceso_ingestion_tables.php');
        $migration->down();
        $this->assertFalse(Schema::hasTable('control_acceso_agentes'));
        $migration->up();
        $this->assertTrue(Schema::hasTable('control_acceso_filas'));
    }

    public function test_mysql_preserves_microseconds_and_prevents_deleting_referenced_agent(): void
    {
        $this->send($this->batch())->assertCreated();
        $response = DB::table('control_acceso_respuestas')->first();
        $this->assertSame('2026-10-24 02:12:01.854246', $response->captured_started_utc);
        $this->assertSame('2026-10-24 02:12:01.951000', $response->captured_ended_utc);
        try {
            DB::table('control_acceso_agentes')->where('id', $this->agent)->delete();
            $this->fail('La clave foranea debe impedir borrar un agente con historial.');
        } catch (QueryException $exception) {
            $this->assertSame(1451, $exception->errorInfo[1]);
        }
        $this->assertDatabaseCount('control_acceso_agentes', 1);
        $this->assertDatabaseCount('control_acceso_respuestas', 1);
    }
}
