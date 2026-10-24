<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateControlAccessAgent
{
    public function handle(Request $request, Closure $next): Response
    {
        $request->headers->set('Accept', 'application/json');
        if (strlen($request->getContent()) > config('control_acceso.max_body_bytes')) {
            return response()->json(['message' => 'Mensaje demasiado grande.'], 413);
        }
        $token = $request->bearerToken() ?? '';
        if (! preg_match('/\Asica_[a-f0-9]{64}\z/', $token)) {
            return response()->json(['message' => 'Agente no autenticado.'], 401);
        }
        $hash = hash('sha256', $token);
        $agent = DB::table('control_acceso_agentes')->where('token_hash', $hash)->whereNull('revoked_at')->first();
        if (! $agent) {
            return response()->json(['message' => 'Agente no autenticado.'], 401);
        }
        if (! $request->isJson()) {
            return response()->json(['message' => 'Se requiere application/json.'], 415);
        }
        $request->attributes->set('control_access_agent_id', $agent->id);
        $request->attributes->set('control_access_token_hash', $hash);

        return $next($request);
    }
}
