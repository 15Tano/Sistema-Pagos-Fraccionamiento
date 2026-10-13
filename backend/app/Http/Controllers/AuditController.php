<?php
namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Vecino;
use App\Models\Pago;
use App\Models\Tag;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    public function index(Request $request)
    {
        $filters = $request->validate([
            'search' => 'nullable|string|max:300',
            'accion' => 'nullable|string|max:100',
        ]);
        $query = AuditLog::query();
        if (!empty($filters['accion'])) {
            $query->where('accion', $filters['accion']);
        }

        // Cada palabra debe coincidir en algún campo, antes de paginar.
        $aliases = ['creó' => 'created', 'creo' => 'created', 'editó' => 'updated',
            'edito' => 'updated', 'eliminó' => 'deleted', 'elimino' => 'deleted'];
        foreach (preg_split('/\s+/u', trim($filters['search'] ?? ''), -1, PREG_SPLIT_NO_EMPTY) as $term) {
            // Usamos ! como escape para tratar %, _ y ! como texto literal.
            $like = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $term) . '%';
            $query->where(function ($match) use ($like, $term, $aliases) {
                foreach (['id', 'user_id', 'user_name', 'accion', 'modelo', 'modelo_id',
                    'ip', 'created_at', 'updated_at', 'datos_anteriores', 'datos_nuevos'] as $field) {
                    $match->orWhereRaw("audit_logs.$field LIKE ? ESCAPE '!'", [$like]);
                }
                $alias = $aliases[mb_strtolower($term)] ?? null;
                if ($alias) $match->orWhere('accion', $alias);
                if (mb_strtolower($term) === 'sistema') $match->orWhereNull('user_name');

                $vecinos = Vecino::query()->select('id')->where(function ($neighbor) use ($like) {
                    foreach (['nombre', 'calle', 'numero_casa', 'uuid'] as $field) {
                        $neighbor->orWhereRaw("$field LIKE ? ESCAPE '!'", [$like]);
                    }
                });
                $match->orWhere(function ($related) use ($vecinos) {
                    $related->where('modelo', 'Vecino')->whereIn('modelo_id', clone $vecinos);
                })->orWhere(function ($related) use ($vecinos, $like) {
                    $related->where('modelo', 'Pago')->where(function ($payment) use ($vecinos, $like) {
                        $payment->whereIn('modelo_id', Pago::query()->select('id')->where(function ($pago) use ($vecinos, $like) {
                            $pago->whereIn('vecino_id', clone $vecinos)->orWhereRaw("mes LIKE ? ESCAPE '!'", [$like]);
                        }));
                        // Un pago eliminado conserva el vecino en sus datos históricos.
                        foreach (['datos_anteriores', 'datos_nuevos'] as $snapshot) {
                            $payment->orWhereIn("{$snapshot}->vecino_id", clone $vecinos);
                        }
                    });
                })->orWhere(function ($related) use ($like) {
                    $related->where('modelo', 'Tag')->whereIn('modelo_id',
                        Tag::query()->select('id')->whereRaw("codigo LIKE ? ESCAPE '!'", [$like]));
                });
            });
        }
        $logs = $query->orderByDesc('created_at')->orderByDesc('id')->paginate(15);

        $logs->getCollection()->transform(function ($log) {
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
