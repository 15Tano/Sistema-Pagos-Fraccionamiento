<?php

use App\Services\ControlAcceso\IngestionService;
use App\Services\ControlAcceso\MonitorService;
use App\Services\ControlAcceso\RetentionService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

// Reutiliza exactamente las restricciones de ruta, usuario y base del ensayo.
define('CA_TRIAL_BOOTSTRAP_ONLY', true);
require __DIR__.'/ensayar.php';

try {
    $path = 'database/migrations/2026_11_01_000000_create_control_acceso_summaries.php';
    if (Artisan::call('migrate', ['--path' => $path, '--force' => true]) !== 0) {
        throw new RuntimeException('Migración de resúmenes no completada.');
    }
    echo Artisan::output();
    config(['control_acceso.ingestion_summary_enabled' => true, 'control_acceso.retention_enabled' => true]);
    $fixed = CarbonImmutable::now('UTC');
    CarbonImmutable::setTestNow($fixed);
    $agent = (string) Str::uuid();
    $tokenHash = hash('sha256', random_bytes(32));
    $serial = 'SUMMARY-TRIAL-'.bin2hex(random_bytes(4));
    DB::table('control_acceso_agentes')->insert(['id' => $agent, 'nombre' => 'Ensayo sintético de resúmenes',
        'device_serial' => $serial, 'token_hash' => $tokenHash, 'created_at' => $fixed, 'updated_at' => $fixed]);
    $raw = "2026-10-31 12:00:00,0,0,0,255,0,0\r\n";
    $envelope = ['protocol_version' => 1, 'agent_id' => $agent, 'device_serial' => $serial, 'session_id' => (string) Str::uuid()];
    $ingestion = app(IngestionService::class);
    for ($batch = 0; $batch < 50; $batch++) {
        $payload = $envelope + ['sequence' => $batch, 'batch_id' => (string) Str::uuid(), 'responses' => []];
        for ($i = 0; $i < 20; $i++) {
            $payload['responses'][] = ['response_id' => (string) Str::uuid(), 'source' => 'rt', 'sdk_return_code' => 1,
                'raw_payload_base64' => base64_encode($raw), 'sha256' => hash('sha256', $raw),
                'captured_started_utc' => $fixed->toISOString(), 'captured_ended_utc' => $fixed->toISOString()];
        }
        $ack = $ingestion->batch($agent, $tokenHash, $payload)['ack'];
        if ($ack['statuses_summarized'] !== 20 || $ack['rows_stored'] !== 0
            || $ingestion->batch($agent, $tokenHash, $payload)['ack'] !== $ack) {
            throw new RuntimeException('Resumen o ACK de lote incorrecto.');
        }
    }
    if (DB::table('control_acceso_filas')->whereIn('respuesta_id', DB::table('control_acceso_respuestas')->select('id')->where('agent_id', $agent))->exists()
        || DB::table('control_acceso_respuestas')->where('agent_id', $agent)->where('raw_payload_base64', '<>', '')->exists()
        || (int) DB::table('control_acceso_resumenes')->where('agent_id', $agent)->sum('statuses') !== 1000) {
        throw new RuntimeException('Persistencia individual de 255 o contadores incorrectos.');
    }
    $state = $envelope + ['sequence' => 0, 'reported_at_utc' => $fixed->toISOString(), 'agent_version' => 'summary-trial', 'pid' => 100,
        'vigencias' => ['protocol' => 2, 'pid' => 100, 'phase' => 'idle', 'consecutive_errors' => 0,
            'last_ok_utc' => $fixed->toISOString(), 'heartbeat_utc' => $fixed->toISOString()],
        'sdk' => ['last_ok_utc' => $fixed->toISOString(), 'last_error_code' => null,
            'status_observations_epoch' => (string) Str::uuid(), 'statuses_observed_total' => 10,
            'status_responses_total' => 10, 'status_last_observed_utc' => $fixed->toISOString()],
        'reader' => ['state' => 'status_observed', 'checked_at_utc' => $fixed->toISOString()],
        'sender' => ['pending_count' => 0]];
    $stateAck = $ingestion->state($agent, $tokenHash, $state)['ack'];
    $ingestion->state($agent, $tokenHash, $state);
    CarbonImmutable::setTestNow($fixed->addSeconds(30));
    $state['sequence'] = 1;
    $state['reported_at_utc'] = CarbonImmutable::now('UTC')->toISOString();
    $state['sdk']['statuses_observed_total'] = $state['sdk']['status_responses_total'] = 15;
    $ingestion->state($agent, $tokenHash, $state);
    if ((int) DB::table('control_acceso_resumenes')->where('agent_id', $agent)->sum('statuses') !== 1015
        || DB::table('control_acceso_estados')->where('agent_id', $agent)->where('sequence', 1)->value('payload') !== '{}') {
        throw new RuntimeException('Salud acumulada duplica detalle o métricas.');
    }
    $monitor = app(MonitorService::class);
    CarbonImmutable::setTestNow($fixed->addDays(8));
    $before = $monitor->states($agent);
    $service = app(RetentionService::class);
    $plan = $service->run();
    $result = $service->run(true);
    $plan['mode'] = 'apply';
    if ($result !== $plan || $monitor->states($agent) !== $before) {
        throw new RuntimeException('Limpieza cambió salud o no coincide con plan.');
    }
    if (DB::table('control_acceso_respuestas')->where('agent_id', $agent)->exists()
        || DB::table('control_acceso_lotes')->where('agent_id', $agent)->exists()) {
        throw new RuntimeException('Identidades técnicas no caducaron.');
    }
    try {
        $ingestion->batch($agent, $tokenHash, $payload);
        throw new RuntimeException('Lote caducado reinsertado.');
    } catch (HttpExceptionInterface $exception) {
        if ($exception->getStatusCode() !== 410) {
            throw $exception;
        }
    }
    echo "1000 observaciones255: 0 filas, 0 copias raw individuales, 1 resumen horario.\n";
    echo "Salud repetida compacta, métricas sin doble conteo, último estado conservado.\n";
    echo 'Caducidad+8días: '.json_encode($result, JSON_THROW_ON_ERROR).PHP_EOL;
    echo "Reenvío expirado410, sin reinserción ni pérdida del estado actual.\n";
    echo "ENSAYO ORIGEN MARIADB APROBADO. Producción no modificada.\n";
} catch (Throwable $exception) {
    file_put_contents($trial.'/resumenes-error-privado.log', (string) $exception);
    fwrite(STDERR, 'ENSAYO DETENIDO: '.get_class($exception).'; revisar log privado local.'.PHP_EOL);
    exit(1);
} finally {
    CarbonImmutable::setTestNow();
}
