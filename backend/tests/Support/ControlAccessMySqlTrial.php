<?php

namespace Tests\Support;

use Illuminate\Support\Facades\DB;
use RuntimeException;

class ControlAccessMySqlTrial
{
    public static function directory(): string
    {
        return dirname(__DIR__, 2).'/storage/app/control-acceso-mysql-ensayo';
    }

    public static function configure(): array
    {
        $expected = realpath(self::directory().'/connection.json');
        $requested = getenv('CA_MYSQL_TRIAL_FILE');
        if (! $expected || ! $requested || realpath($requested) !== $expected) {
            throw new RuntimeException('Solo se admite la configuracion generada para el ensayo local.');
        }
        $settings = json_decode(file_get_contents($expected), true, 32, JSON_THROW_ON_ERROR);
        if (! preg_match('/\Asanisidro_ca_ensayo_[a-f0-9]{12}\z/', $settings['database'] ?? '') ||
            ! preg_match('/\Aca_ensayo_[a-f0-9]{12}\z/', $settings['username'] ?? '') ||
            ! preg_match('/\A[a-f0-9]{64}\z/', $settings['marker'] ?? '')) {
            throw new RuntimeException('Identidad de ensayo invalida.');
        }
        config(['app.env' => 'testing', 'app.debug' => false, 'cache.default' => 'array',
            'session.driver' => 'array', 'logging.default' => 'null', 'database.default' => 'mysql',
            'database.connections.mysql' => [
                'driver' => 'mysql', 'url' => null, 'host' => '127.0.0.1', 'port' => 33379,
                'database' => $settings['database'], 'username' => $settings['username'],
                'password' => $settings['password'], 'unix_socket' => '', 'charset' => 'utf8mb4',
                'collation' => 'utf8mb4_unicode_ci', 'prefix' => '', 'prefix_indexes' => true,
                'strict' => true, 'engine' => 'InnoDB', 'options' => [\PDO::ATTR_TIMEOUT => 3],
            ]]);
        DB::purge('mysql');
        $server = DB::selectOne('SELECT VERSION() AS version, @@port AS port, @@server_id AS server_id, @@datadir AS data_directory');
        $dataDirectory = realpath(self::directory().'/data');
        if (str_contains($server->version, 'MariaDB') || ! str_starts_with($server->version, '8.4.') ||
            (int) $server->port !== 33379 || (int) $server->server_id !== 231026 ||
            ! $dataDirectory || realpath($server->data_directory) !== $dataDirectory ||
            DB::table('ca_ensayo_guard')->value('marker') !== $settings['marker']) {
            throw new RuntimeException('El servidor/base no corresponde al ensayo aislado.');
        }
        DB::statement('SET SESSION innodb_lock_wait_timeout = 10');

        return ['database' => $settings['database'], 'version' => $server->version];
    }
}
