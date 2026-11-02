<?php

// Ensayo CLI en la copia privada existente. Sin servidor HTTP ni escrituras de negocio.
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

define('CA_TRIAL_BOOTSTRAP_ONLY', true);
require __DIR__.'/../retencion/ensayar.php';

$temporaryTables = [];
$checks = 0;
$passed = false;
try {
    if (glob($backend.'/bootstrap/cache/routes*.php')) {
        throw new RuntimeException('El ensayo requiere rutas sin cachear.');
    }
    $connection = DB::connection();
    if ($connection->getPdo() !== $connection->getReadPdo()) {
        throw new RuntimeException('No se admite una conexión de lectura separada.');
    }
    // Estas tablas ocultan nombres del respaldo SOLO en esta conexión. CREATE/DROP
    // TEMPORARY no modifica las tablas permanentes ni exige limpiar datos reales.
    foreach ([
        'control_acceso_agentes' => 'id VARCHAR(36) PRIMARY KEY, nombre VARCHAR(100), device_serial VARCHAR(100), token_hash VARCHAR(64), revoked_at DATETIME NULL',
        'tags' => 'id BIGINT PRIMARY KEY, codigo VARCHAR(40)',
        'vecinos' => 'id BIGINT PRIMARY KEY, nombre VARCHAR(240), calle VARCHAR(100)',
        'tag_vecino' => 'tag_id BIGINT, vecino_id BIGINT',
    ] as $name => $columns) {
        DB::unprepared('CREATE TEMPORARY TABLE `'.$name.'` ('.$columns.') ENGINE=InnoDB');
        $temporaryTables[] = $name;
    }
    $agent = '11111111-1111-4111-8111-111111111111';
    $token = 'sica_'.bin2hex(random_bytes(32));
    DB::table('control_acceso_agentes')->insert(['id' => $agent, 'nombre' => 'AGENTE FICTICIO',
        'device_serial' => 'CO2K225060027', 'token_hash' => hash('sha256', $token)]);
    DB::table('tags')->insert([['id' => 1, 'codigo' => '1234567'], ['id' => 2, 'codigo' => '7654321'],
        ['id' => 3, 'codigo' => '8888888']]);
    DB::table('vecinos')->insert([['id' => 1, 'nombre' => 'VECINO FICTICIO UNO', 'calle' => 'DOMICILIO_PRIVADO_FICTICIO'],
        ['id' => 2, 'nombre' => 'VECINO FICTICIO DOS', 'calle' => 'DOMICILIO_PRIVADO_FICTICIO']]);
    DB::table('tag_vecino')->insert([['tag_id' => 1, 'vecino_id' => 1], ['tag_id' => 1, 'vecino_id' => 1],
        ['tag_id' => 2, 'vecino_id' => 1], ['tag_id' => 2, 'vecino_id' => 2]]);
    config(['cache.default' => 'array', 'session.driver' => 'array', 'control_acceso.local_display_directory_enabled' => true]);
    $assert = function (bool $ok, string $message) use (&$checks): void {
        if (! $ok) {
            throw new RuntimeException($message);
        }
        $checks++;
    };
    $kernel = app(Kernel::class);
    $request = function (?string $credential, int $status, bool $json = true) use ($kernel, $assert) {
        $server = ['HTTP_ACCEPT' => 'application/json', 'REMOTE_ADDR' => '127.0.0.1'];
        if ($json) {
            $server['CONTENT_TYPE'] = 'application/json';
        }
        if ($credential !== null) {
            $server['HTTP_AUTHORIZATION'] = 'Bearer '.$credential;
        }
        $request = Request::create('http://localhost/api/control-acceso/agente/asociaciones', 'GET', [], [], [], $server);
        $response = $kernel->handle($request);
        $assert($response->getStatusCode() === $status, 'Estado HTTP inesperado en fixture.');
        $kernel->terminate($request, $response);

        return $response;
    };
    $request(null, 401);
    $request('human-fixture-not-agent', 401);
    $request($token, 415, false);
    config(['control_acceso.local_display_directory_enabled' => false]);
    $request($token, 404);
    config(['control_acceso.local_display_directory_enabled' => true]);
    $response = $request($token, 200);
    $value = json_decode($response->getContent(), true, 32, JSON_THROW_ON_ERROR);
    $assert($value['protocol'] === 1 && $value['agent_id'] === $agent && $value['valid_for_seconds'] === 300, 'Contrato/identidad/TTL incorrectos.');
    $assert(count($value['data']) === 2, 'Duplicados o tags sin asociación incorrectos.');
    $assert($value['data'][0] === ['card_no' => '1234567', 'neighbor_status' => 'single', 'neighbor_name' => 'VECINO FICTICIO UNO'], 'Asociación única incorrecta.');
    $assert($value['data'][1] === ['card_no' => '7654321', 'neighbor_status' => 'multiple', 'neighbor_name' => null], 'Asociación ambigua incorrecta.');
    $assert($response->headers->get('Cache-Control') === 'no-store, private', 'Respuesta cacheable.');
    foreach (['DOMICILIO_PRIVADO_FICTICIO', 'token_hash', $token, 'vecino_id', 'saldo', 'pagos'] as $secret) {
        $assert(! str_contains($response->getContent(), $secret), 'Respuesta contiene campos privados.');
    }
    DB::table('control_acceso_agentes')->where('id', $agent)->update(['revoked_at' => '2026-11-01 00:00:00']);
    $request($token, 401);
    DB::table('control_acceso_agentes')->where('id', $agent)->update(['revoked_at' => null, 'device_serial' => 'OTHER-FIXTURE']);
    $request($token, 403);
    DB::table('control_acceso_agentes')->where('id', $agent)->update(['device_serial' => 'CO2K225060027']);
    DB::table('tag_vecino')->delete(); // Sigue siendo la tabla TEMPORARY de esta conexión.
    $response = $request($token, 200);
    $assert(json_decode($response->getContent(), true, 32, JSON_THROW_ON_ERROR)['data'] === [], 'Directorio vacío incorrecto.');
    $batch = array_fill(0, 1000, ['tag_id' => 1, 'vecino_id' => 1]);
    for ($i = 0; $i < 10; $i++) {
        DB::table('tag_vecino')->insert($batch);
    }
    DB::table('tag_vecino')->insert(['tag_id' => 1, 'vecino_id' => 1]);
    $request($token, 503);
    $passed = true;
} catch (Throwable $exception) {
    file_put_contents($trial.'/pantalla-local-error-privado.log', (string) $exception);
    fwrite(STDERR, 'ENSAYO DETENIDO: '.get_class($exception).'; revisar log privado de la copia.'.PHP_EOL);
} finally {
    foreach (array_reverse($temporaryTables) as $name) {
        try {
            DB::unprepared('DROP TEMPORARY TABLE IF EXISTS `'.$name.'`');
        } catch (Throwable) {
            $passed = false;
            fwrite(STDERR, 'Cierre temporal no confirmado; la conexión se cerrará al terminar CLI.'.PHP_EOL);
        }
    }
}
if (! $passed) {
    exit(1);
}
echo 'Comprobaciones aprobadas: '.$checks.PHP_EOL;
echo "Autenticación, revocación, bandera, serial, asociaciones, privacidad y límite verificados.\n";
echo "ENSAYO DIRECTORIO MARIADB APROBADO. Solo tablas temporales con datos ficticios.\n";
