<?php

namespace App\Http\Middleware;

use App\Models\CorteCaja;
use Carbon\Carbon;
use Closure;
use Illuminate\Http\Request;

class BloquearSiCorteActivo
{
    /**
     * Rutas que el capturista debe poder seguir usando aunque el corte esté bloqueando todo lo demás.
     */
    protected array $rutasExentas = [
        'api/corte-caja/*',
        'api/logout',
        'api/me',
    ];
    public function handle(Request $request, Closure $next)
    {

        $user = $request->user();

        // Solo aplica al rol capturista; admin nunca se bloquea.
        if (!$user || $user->role !== 'capturista') {
            return $next($request);
        }

        // Las lecturas (GET) siempre pasan; el bloqueo es sobre acciones que modifican datos.
        if ($request->isMethod('get') || $request->is($this->rutasExentas)) {
            return $next($request);
        }

        $hoy = Carbon::now('America/Mexico_City')->toDateString();
        $corte = CorteCaja::where('fecha', $hoy)->first();

        if (!$corte) {
            return $next($request);
        }

        $bloqueado = $corte->estado === 'en_proceso'
            || ($corte->estado !== 'en_proceso' && is_null($corte->reabierto_at));

        if ($bloqueado) {
            return response()->json([
                'message'    => 'La caja de hoy está cerrada. Solicita al admin que la reabra para continuar.',
                'corte_uuid' => $corte->uuid,
            ], 423);
        }

        return $next($request);
    }
}