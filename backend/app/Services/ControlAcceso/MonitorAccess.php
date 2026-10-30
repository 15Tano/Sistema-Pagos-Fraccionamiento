<?php

namespace App\Services\ControlAcceso;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class MonitorAccess
{
    public function settings(): array
    {
        $row = DB::table('control_acceso_monitor_configuracion')->where('id', 1)->first();
        abort_unless($row, 503, 'Configuración del monitor no disponible.');

        return ['history_for_guards' => (bool) $row->historial_vigilancia, 'revision' => (int) $row->revision];
    }

    public function permissions(string $role): array
    {
        $settings = $this->settings();

        return ['can_view_history' => $role === 'admin' || ($role === 'vigilancia' && $settings['history_for_guards']),
            'can_manage_history' => $role === 'admin'];
    }

    public function update(bool $enabled, int $revision, int $actor): ?array
    {
        // Evita que dos administradores se sobrescriban desde pestañas antiguas.
        $changed = DB::table('control_acceso_monitor_configuracion')->where('id', 1)->where('revision', $revision)
            ->update(['historial_vigilancia' => $enabled, 'revision' => $revision + 1,
                'updated_by' => $actor, 'updated_at' => CarbonImmutable::now('UTC')->format('Y-m-d H:i:s')]);

        return $changed === 1 ? $this->settings() : null;
    }
}
