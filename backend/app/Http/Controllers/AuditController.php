<?php
namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Vecino;
use App\Models\Pago;
use App\Models\Tag;

class AuditController extends Controller
{
    public function index()
    {
        $logs = AuditLog::orderByDesc('created_at')->limit(100)->get();

        $logs->transform(function ($log) {
            $log->modelo_label = $this->resolverLabel($log->modelo, $log->modelo_id, $log->datos_anteriores, $log->datos_nuevos);
            return $log;
        });

        return response()->json($logs);
    }

    private function resolverLabel($modelo, $modeloId, $anterior, $nuevo)
    {
        try {
            switch ($modelo) {
                case 'Pago':
                    $pago = Pago::with('vecino')->find($modeloId);
                    if ($pago && $pago->vecino) {
                        return $pago->vecino->nombre . ' · ' . $pago->mes;
                    }
                    // Si el pago fue eliminado, buscar en datos_anteriores
                    $data = is_array($anterior) ? $anterior : json_decode($anterior, true);
                    if ($data && isset($data['vecino_id'])) {
                        $vecino = Vecino::find($data['vecino_id']);
                        return ($vecino ? $vecino->nombre : 'Vecino eliminado') . ' · ' . ($data['mes'] ?? '');
                    }
                    return 'Pago #' . $modeloId;

                case 'Vecino':
                    $vecino = Vecino::find($modeloId);
                    if ($vecino) return $vecino->nombre;
                    $data = is_array($anterior) ? $anterior : json_decode($anterior, true);
                    return $data['nombre'] ?? 'Vecino #' . $modeloId;

                case 'Tag':
                    $tag = Tag::find($modeloId);
                    if ($tag) return 'Tag ' . $tag->codigo;
                    $data = is_array($anterior) ? $anterior : json_decode($anterior, true);
                    return 'Tag ' . ($data['codigo'] ?? '#' . $modeloId);

                default:
                    return $modelo . ' #' . $modeloId;
            }
        } catch (\Exception $e) {
            return $modelo . ' #' . $modeloId;
        }
    }
}