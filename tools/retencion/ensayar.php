<?php

// Exclusivo de una copia privada en /root; nunca se ejecuta sobre el docroot.
use App\Services\ControlAcceso\IngestionService;
use App\Services\ControlAcceso\MonitorService;
use App\Services\ControlAcceso\RetentionService;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

umask(0077);
$trial = realpath($argv[1] ?? '');
if (! $trial || ! preg_match('~\A/root/ensayo-retencion-[a-f0-9]{8}\z~', $trial)
    || realpath(dirname(__DIR__, 2)) !== $trial) {
    fwrite(STDERR, "Solo se admite el código extraído dentro de /root/ensayo-retencion-XXXXXXXX.\n");
    exit(1);
}
$backend = $trial.'/backend';
if (is_file($backend.'/.env') || is_file($backend.'/bootstrap/cache/config.php')) {
    fwrite(STDERR, "El ensayo exige backend sin .env ni caché de configuración.\n");
    exit(1);
}
$database = trim(file_get_contents($trial.'/database-name'));
$client = parse_ini_file($trial.'/cliente.cnf', true, INI_SCANNER_RAW)['client'] ?? [];
if (! preg_match('/\Asicar[a-f0-9]{8}\z/', $database) || ($client['user'] ?? '') !== $database
    || ($client['host'] ?? '') !== '127.0.0.1' || ($client['port'] ?? '') !== '3306'
    || ! preg_match('/\A[a-f0-9]{48}\z/', $client['password'] ?? '')) {
    fwrite(STDERR, "Identidad de base/usuario de ensayo no válida.\n");
    exit(1);
}

// No se carga configuración ni credenciales del sitio en producción.
foreach (['APP_ENV' => 'testing', 'APP_DEBUG' => 'false', 'LOG_CHANNEL' => 'single',
    'DB_CONNECTION' => 'mysql', 'DB_URL' => '', 'DB_HOST' => '127.0.0.1', 'DB_PORT' => '3306',
    'DB_DATABASE' => $database, 'DB_USERNAME' => $client['user'], 'DB_PASSWORD' => $client['password'],
    'DB_SOCKET' => '', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array',
    'QUEUE_CONNECTION' => 'sync', 'MAIL_MAILER' => 'array', 'CONTROL_ACCESO_RETENTION_ENABLED' => 'false',
    'APP_KEY' => 'base64:'.base64_encode(random_bytes(32))] as $key => $value) {
    putenv($key.'='.$value);
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}

require $backend.'/vendor/autoload.php';
$app = require $backend.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    $identity = DB::selectOne('SELECT DATABASE() AS db, CURRENT_USER() AS account, VERSION() AS version');
    if ($identity->db !== $database || explode('@', $identity->account)[0] !== $database
        || ! str_contains($identity->version, 'MariaDB')) {
        throw new RuntimeException('La conexión no corresponde al ensayo MariaDB.');
    }
    echo 'Base aislada verificada: '.$database.' / '.$identity->version.PHP_EOL;
    $migration = 'database/migrations/2026_10_31_230000_add_control_acceso_retention_markers.php';
    if (Artisan::call('migrate', ['--path' => $migration, '--force' => true]) !== 0) {
        throw new RuntimeException('Falló la migración de ensayo.');
    }
    echo Artisan::output();

    $fixed = CarbonImmutable::now('UTC');
    CarbonImmutable::setTestNow($fixed);
    Carbon::setTestNow($fixed);
    $service = app(RetentionService::class);
    $keys = ['states_compacted', 'status_rows_deleted', 'event_rows_deleted', 'responses_compacted'];
    $counts = fn (array $result) => array_intersect_key($result, array_flip($keys));
    $snapshot = function () {
        $monitor = app(MonitorService::class);
        $result = [];
        foreach (DB::table('control_acceso_agentes')->orderBy('id')->pluck('id') as $agent) {
            $result[$agent] = [$monitor->states($agent), $monitor->current(['agent_id' => $agent])];
        }

        return $result;
    };
    $before = $snapshot();
    $plan = $service->run();
    $actual = $service->run(true);
    if ($counts($plan) !== $counts($actual) || $snapshot() !== $before) {
        throw new RuntimeException('Plan/aplicación actual o monitor no coinciden.');
    }
    echo 'Fecha actual: '.json_encode($counts($actual), JSON_THROW_ON_ERROR).PHP_EOL;

    // Fixture independiente para probar el ACK real después de retirar sus bytes.
    $agent = (string) Str::uuid();
    $tokenHash = hash('sha256', random_bytes(32));
    $serial = 'RETENTION-TRIAL-'.bin2hex(random_bytes(4));
    DB::table('control_acceso_agentes')->insert(['id' => $agent, 'nombre' => 'Ensayo sintético de retención',
        'device_serial' => $serial, 'token_hash' => $tokenHash, 'created_at' => $fixed, 'updated_at' => $fixed]);
    $raw = "2026-10-31 12:00:00,0,0,1,255,0,4\r\n";
    $payload = ['protocol_version' => 1, 'agent_id' => $agent, 'device_serial' => $serial,
        'session_id' => (string) Str::uuid(), 'sequence' => 0, 'batch_id' => (string) Str::uuid(),
        'responses' => [['response_id' => (string) Str::uuid(), 'source' => 'rt', 'sdk_return_code' => 1,
            'raw_payload_base64' => base64_encode($raw), 'sha256' => hash('sha256', $raw),
            'captured_started_utc' => $fixed->toISOString(), 'captured_ended_utc' => $fixed->toISOString()]]];
    $ingestion = app(IngestionService::class);
    $ack = $ingestion->batch($agent, $tokenHash, $payload)['ack'];

    // Solo cambia el reloj PHP de este proceso; nunca el reloj del servidor.
    CarbonImmutable::setTestNow($fixed->addDays(100));
    Carbon::setTestNow($fixed->addDays(100));
    $before = $snapshot();
    $totals = array_fill_keys($keys, 0);
    $finished = false;
    for ($pass = 0; $pass < 50; $pass++) {
        $plan = $service->run();
        $actual = $service->run(true);
        if ($counts($plan) !== $counts($actual)) {
            throw new RuntimeException('Plan futuro distinto de aplicación.');
        }
        foreach ($counts($actual) as $key => $value) {
            $totals[$key] += $value;
        }
        if (array_sum($counts($actual)) === 0) {
            $finished = true;
            break;
        }
    }
    if (! $finished || array_sum($totals) === 0 || $snapshot() !== $before) {
        throw new RuntimeException('Ensayo futuro incompleto o monitor alterado.');
    }
    $stored = DB::table('control_acceso_respuestas')->where('agent_id', $agent)->first();
    if ($stored->raw_payload_base64 !== '' || $stored->retention_pruned_at_utc === null
        || $ingestion->batch($agent, $tokenHash, $payload)['ack'] !== $ack) {
        throw new RuntimeException('ACK o retiro de bytes incorrectos.');
    }
    $changed = $payload;
    $changed['sequence'] = 1;
    try {
        $ingestion->batch($agent, $tokenHash, $changed);
        throw new RuntimeException('Identidad modificada aceptada.');
    } catch (HttpExceptionInterface $exception) {
        if ($exception->getStatusCode() !== 409) {
            throw $exception;
        }
    }
    echo 'Fecha +100 días: '.json_encode($totals, JSON_THROW_ON_ERROR).PHP_EOL;
    echo "Monitor conservado; ACK idéntico; conflicto409 correcto; repetición sin pendientes.\n";
    echo "ENSAYO MARIADB APROBADO. Producción no modificada por este ensayo.\n";
} catch (Throwable $exception) {
    file_put_contents($trial.'/ensayo-error-privado.log', (string) $exception);
    fwrite(STDERR, 'ENSAYO DETENIDO: '.get_class($exception).'. Revisar log privado local.'.PHP_EOL);
    exit(1);
} finally {
    CarbonImmutable::setTestNow();
    Carbon::setTestNow();
}
