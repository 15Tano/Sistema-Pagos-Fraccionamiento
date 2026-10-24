<?php

// Servidor solo para pruebas locales; no utiliza bases ni credenciales de .env.
$root = dirname(__DIR__, 3);
require $root.'/backend/vendor/autoload.php';
$trial = realpath(getenv('CA_AGENT_TRIAL_ROOT') ?: '');
$allowed = realpath($root.'/backend/storage/app/agente-acceso-ensayo');
if (! $trial || ! $allowed || ! str_starts_with($trial.DIRECTORY_SEPARATOR, $allowed.DIRECTORY_SEPARATOR) ||
    ! is_file($trial.'/laravel.sqlite')) {
    throw new RuntimeException('Ruta fuera del ensayo local.');
}
$app = require $root.'/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();
config(['app.env' => 'testing', 'app.debug' => false, 'app.key' => 'base64:'.base64_encode(str_repeat('t', 32)),
    'cache.default' => 'array', 'session.driver' => 'array', 'logging.default' => 'null',
    'database.default' => 'sqlite', 'database.connections.sqlite' => [
        'driver' => 'sqlite', 'url' => null, 'database' => $trial.'/laravel.sqlite', 'prefix' => '',
        'foreign_key_constraints' => true, 'busy_timeout' => 5000,
    ]]);
Illuminate\Support\Facades\DB::purge('sqlite');
if (PHP_SAPI === 'cli' && ($argv[1] ?? '') === 'init') {
    (require $root.'/backend/database/migrations/2026_10_23_210000_create_control_acceso_ingestion_tables.php')->up();
    Illuminate\Support\Facades\DB::table('control_acceso_agentes')->insert([
        'id' => '10000000-0000-4000-8000-000000000001', 'nombre' => 'Ensayo emisor',
        'device_serial' => 'TEST-C3-001', 'token_hash' => hash('sha256', 'sica_'.str_repeat('f', 64)),
        'created_at' => now('UTC'), 'updated_at' => now('UTC'),
    ]);
    exit(0);
}
$request = Illuminate\Http\Request::capture();
$response = $kernel->handle($request);
$response->send();
$kernel->terminate($request, $response);
