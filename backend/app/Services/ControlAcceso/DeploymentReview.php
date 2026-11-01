<?php

namespace App\Services\ControlAcceso;

use App\Http\Controllers\Api\ControlAccessAgentController;
use App\Http\Controllers\Api\ControlAccessMonitorController;
use App\Http\Middleware\AuthorizeControlAccessMonitor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Throwable;

class DeploymentReview
{
    public const MIGRATIONS = [
        '2026_10_23_210000_create_control_acceso_ingestion_tables',
        '2026_10_26_070000_add_control_acceso_monitor_indexes',
        '2026_10_30_010000_create_control_acceso_monitor_settings',
        '2026_10_31_230000_add_control_acceso_retention_markers',
        '2026_11_01_000000_create_control_acceso_summaries',
    ];

    private const COLUMNS = [
        'control_acceso_salud_actual' => ['agent_id', 'state_id', 'reported_at_utc', 'received_at_utc', 'payload', 'signal_sha256'],
        'control_acceso_resumenes' => ['id', 'agent_id', 'hour_utc', 'source', 'responses', 'statuses', 'last_received_at_utc'],
        'control_acceso_agentes' => ['id', 'device_serial', 'nombre', 'token_hash', 'revoked_at'],
        'control_acceso_estados' => ['id', 'agent_id', 'session_id', 'sequence', 'reported_at_utc', 'received_at_utc', 'payload', 'ack', 'content_sha256', 'retention_pruned_at_utc'],
        'control_acceso_lotes' => ['id', 'agent_id', 'batch_id', 'session_id', 'sequence', 'content_sha256', 'received_at_utc', 'ack'],
        'control_acceso_respuestas' => ['id', 'lote_id', 'agent_id', 'response_id', 'source', 'sdk_return_code', 'raw_payload_base64', 'sha256', 'payload_bytes', 'captured_started_utc', 'captured_ended_utc', 'pc_local_time', 'windows_timezone', 'parse_status', 'parse_reason', 'parser_version', 'retention_pruned_at_utc'],
        'control_acceso_filas' => ['id', 'respuesta_id', 'ordinal', 'kind', 'device_time_raw', 'time_second', 'card_no', 'pin', 'door_id', 'event_code', 'direction', 'verification', 'raw_fields'],
        'control_acceso_monitor_configuracion' => ['id', 'historial_vigilancia', 'revision', 'updated_by', 'created_at', 'updated_at'],
        'tags' => ['id', 'codigo'], 'vecinos' => ['id', 'nombre'],
        'tag_vecino' => ['tag_id', 'vecino_id'], 'users' => ['id', 'role'],
        'personal_access_tokens' => ['id', 'tokenable_type', 'tokenable_id', 'name', 'token', 'abilities', 'last_used_at', 'expires_at'],
    ];

    private const INDEXES = [
        'ca_expiry_estados' => ['control_acceso_estados', ['agent_id', 'received_at_utc', 'id']],
        'ca_expiry_lotes' => ['control_acceso_lotes', ['agent_id', 'received_at_utc', 'id']],
        'ca_status_hour' => ['control_acceso_resumenes', ['agent_id', 'hour_utc', 'source']],
        'ca_retention_estados' => ['control_acceso_estados', ['agent_id', 'retention_pruned_at_utc', 'id']],
        'ca_retention_respuestas' => ['control_acceso_respuestas', ['agent_id', 'retention_pruned_at_utc', 'id']],
        'ca_states_monitor' => ['control_acceso_estados', ['agent_id', 'reported_at_utc', 'id']],
        'ca_responses_monitor' => ['control_acceso_respuestas', ['agent_id', 'source', 'id']],
        'ca_rows_monitor' => ['control_acceso_filas', ['kind', 'id']],
        'ca_rows_current' => ['control_acceso_filas', ['kind', 'door_id', 'id']],
    ];

    private function routes(): array
    {
        $checks = [];
        foreach ([
            ['GET', 'agente/capacidades', ControlAccessAgentController::class, 'capabilities', ['control-acceso.agente', 'throttle:120,1']],
            ['POST', 'agente/estado', ControlAccessAgentController::class, 'state', ['control-acceso.agente', 'throttle:120,1']],
            ['POST', 'agente/lotes', ControlAccessAgentController::class, 'batch', ['control-acceso.agente', 'throttle:120,1']],
            ['GET', 'monitor/estado', ControlAccessMonitorController::class, 'state'],
            ['GET', 'monitor/eventos', ControlAccessMonitorController::class, 'events'],
            ['GET', 'monitor/actual', ControlAccessMonitorController::class, 'current'],
            ['GET', 'monitor/configuracion', ControlAccessMonitorController::class, 'settings'],
            ['PATCH', 'monitor/configuracion', ControlAccessMonitorController::class, 'updateSettings'],
        ] as $definition) {
            [$method, $path, $controller, $action] = $definition;
            $required = $definition[4] ?? ['auth:sanctum', AuthorizeControlAccessMonitor::class, 'throttle:120,1'];
            $route = collect(Route::getRoutes())->first(fn ($route) => $route->uri() === 'api/control-acceso/'.$path && in_array($method, $route->methods(), true));
            $checks[$method.' '.$path] = $route !== null && $route->getActionName() === $controller.'@'.$action
                && array_diff($required, $route->gatherMiddleware()) === [];
        }

        return $checks;
    }

    public function inspect(): array
    {
        $checks = ['routes' => $this->routes()];
        $setting = null;
        $error = null;
        try {
            foreach (self::COLUMNS as $table => $columns) {
                $actual = Schema::hasTable($table) ? Schema::getColumnListing($table) : [];
                $checks['columns'][$table] = array_values(array_diff($columns, $actual));
            }
            foreach (self::INDEXES as $name => [$table, $columns]) {
                $index = empty($checks['columns'][$table]) ? collect(Schema::getIndexes($table))->firstWhere('name', $name) : null;
                $checks['indexes'][$name] = $index !== null && $index['columns'] === $columns;
            }
            $ran = Schema::hasTable('migrations') ? DB::table('migrations')->whereIn('migration', self::MIGRATIONS)->pluck('migration')->all() : [];
            $checks['migrations_missing'] = array_values(array_diff(self::MIGRATIONS, $ran));
            if (empty($checks['columns']['control_acceso_monitor_configuracion'])) {
                // Lee exclusivamente el ajuste, nunca credenciales, padron ni buffers.
                $row = DB::table('control_acceso_monitor_configuracion')->where('id', 1)->first(['historial_vigilancia', 'revision']);
                if ($row && in_array($row->historial_vigilancia, [0, 1, '0', '1', false, true], true)
                    && filter_var($row->revision, FILTER_VALIDATE_INT) !== false && $row->revision >= 1 && $row->revision <= 2147483647) {
                    $setting = ['history_for_guards' => (bool) $row->historial_vigilancia, 'revision' => (int) $row->revision];
                }
            }
            $checks['settings_valid'] = $setting !== null;
        } catch (Throwable) {
            // No imprimir mensajes SQL: pueden contener rutas, hosts o parametros privados.
            $error = 'database_review_failed';
        }
        $ready = $error === null && ! in_array(false, $checks['routes'], true)
            && count(array_filter($checks['columns'] ?? [], fn ($missing) => $missing !== [])) === 0
            && ! in_array(false, $checks['indexes'] ?? [], true) && ($checks['migrations_missing'] ?? null) === []
            && ($checks['settings_valid'] ?? false);

        return ['scope' => 'backend_structure_readonly_not_activation',
            'status' => $ready ? 'backend_structure_ready' : 'review_required',
            'backend_structure_ready' => $ready, 'checks' => $checks,
            'monitor_enabled' => (bool) config('control_acceso.monitor_enabled'), 'history_setting' => $setting,
            'error' => $error, 'writes_performed' => false, 'activation_authorized' => false,
            'limits' => ['No prueba credenciales, HTTPS externo, interfaz publicada, Dell, SDK ni flujo continuo.',
                'No ejecuta migraciones, no habilita la bandera y no crea agentes.']];
    }
}
