<?php

// Preparacion optativa para el servidor temporal iniciado segun la guia de ensayo.
require dirname(__DIR__, 2).'/vendor/autoload.php';

use Symfony\Component\Process\Process;
use Tests\Support\ControlAccessMySqlTrial;

$operation = $argv[1] ?? '';
$directory = ControlAccessMySqlTrial::directory();
$configuration = $directory.'/connection.json';

try {
    if (! in_array($operation, ['prepare', 'run', 'stop'], true)) {
        throw new RuntimeException('Operacion invalida.');
    }
    if ($operation === 'run') {
        $process = new Process([PHP_BINARY, 'vendor/phpunit/phpunit/phpunit',
            'tests/Feature/ControlAccessMySqlIngestionTest.php'], dirname(__DIR__, 2),
            ['APP_ENV' => 'testing', 'CA_MYSQL_TRIAL_FILE' => $configuration], null, 180);
        $exitCode = $process->run(function ($type, $buffer) {
            echo $buffer;
        });
        file_put_contents($directory.'/resultado-phpunit.txt', $process->getOutput().$process->getErrorOutput());
        exit($exitCode);
    }
    if ($operation === 'prepare' && file_exists($configuration)) {
        throw new RuntimeException('Ya existe configuracion; no sobrescribir un ensayo anterior.');
    }
    $settings = $operation === 'stop'
        ? json_decode(file_get_contents($configuration), true, 32, JSON_THROW_ON_ERROR)
        : json_decode(file_get_contents($directory.'/bootstrap.json'), true, 32, JSON_THROW_ON_ERROR);
    $pdo = new PDO('mysql:host=127.0.0.1;port=33379;charset=utf8mb4', 'root', $settings['root_password'] ?? '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 3]);
    $server = $pdo->query('SELECT VERSION() AS version, @@port AS port, @@server_id AS server_id, @@datadir AS data_directory')->fetch(PDO::FETCH_ASSOC);
    $expectedData = realpath($directory.'/data');
    if (! $expectedData || realpath($server['data_directory']) !== $expectedData ||
        ! str_starts_with($server['version'], '8.4.') || str_contains($server['version'], 'MariaDB') ||
        (int) $server['port'] !== 33379 || (int) $server['server_id'] !== 231026) {
        throw new RuntimeException('Servidor fuera del ensayo.');
    }
    if ($operation === 'stop') {
        // La instancia entera es exclusiva de este ensayo; conservar datos para evidencia.
        $pdo->exec('SHUTDOWN');
        echo "Instancia temporal detenida; datos de ensayo conservados.\n";
        exit(0);
    }
    $suffix = bin2hex(random_bytes(6));
    $settings = ['database' => 'sanisidro_ca_ensayo_'.$suffix, 'username' => 'ca_ensayo_'.$suffix,
        'password' => bin2hex(random_bytes(32)), 'root_password' => bin2hex(random_bytes(32)),
        'marker' => bin2hex(random_bytes(32))];
    // Guardar primero permite detener el servidor aun si falla algun paso posterior.
    file_put_contents($configuration, json_encode($settings, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT));
    $pdo->exec('ALTER USER CURRENT_USER() IDENTIFIED BY '.$pdo->quote($settings['root_password']));
    $pdo->exec('CREATE DATABASE `'.$settings['database'].'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $user = $pdo->quote($settings['username'])."@'127.0.0.1'";
    $pdo->exec('CREATE USER '.$user.' IDENTIFIED BY '.$pdo->quote($settings['password']));
    $pdo->exec('GRANT ALL PRIVILEGES ON `'.$settings['database'].'`.* TO '.$user);
    foreach (['data_locks', 'data_lock_waits'] as $table) {
        $pdo->exec('GRANT SELECT ON performance_schema.'.$table.' TO '.$user);
    }
    $pdo->exec('CREATE TABLE `'.$settings['database'].'`.ca_ensayo_guard (marker CHAR(64) NOT NULL) ENGINE=InnoDB');
    $pdo->exec('INSERT INTO `'.$settings['database'].'`.ca_ensayo_guard (marker) VALUES ('.$pdo->quote($settings['marker']).')');
    foreach (['bootstrap.sql', 'bootstrap.json'] as $bootstrapFile) {
        if (file_exists($directory.'/'.$bootstrapFile)) {
            unlink($directory.'/'.$bootstrapFile);
        }
    }
    echo json_encode(['status' => 'prepared', 'version' => $server['version'], 'host' => '127.0.0.1',
        'port' => 33379, 'database' => $settings['database'], 'credentials' => 'solo archivo local ignorado por Git'],
        JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT)."\n";
} catch (Throwable $exception) {
    $detail = $exception instanceof PDOException
        ? 'SQLSTATE '.$exception->getCode().' / driver '.($exception->errorInfo[1] ?? 'unknown')
        : get_class($exception);
    if ($exception instanceof PDOException && ($exception->errorInfo[1] ?? null) === 1130) {
        $detail .= ' / '.$exception->errorInfo[2];
    }
    fwrite(STDERR, 'Ensayo MySQL interrumpido en linea '.$exception->getLine().': '.$detail.". No se imprimen secretos ni SQL.\n");
    exit(1);
}
