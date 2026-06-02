<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CapturistaController extends Controller
{
    /**
     * POST /api/capturista/verify-pin
     *
     * Valida el PIN y devuelve un token Sanctum temporal ligado
     * al usuario técnico 'capturista'.
     */
    public function verifyPin(Request $request): JsonResponse
    {
        $request->validate([
            'pin' => ['required', 'string'],
        ]);

        $expectedPin = config('capturista.pin');

        if (!$expectedPin || !hash_equals((string) $expectedPin, (string) $request->pin)) {
            return response()->json(['message' => 'PIN incorrecto.'], 403);
        }

        // Obtener el usuario técnico capturista
        $capturista = User::where('role', 'capturista')
            ->where('username', 'capturista.sistema')
            ->firstOrFail();

        // Revocar tokens anteriores para no acumular basura
        $capturista->tokens()->where('name', 'capturista-pin-token')->delete();

        // Crear token con expiración de 2 horas
        $token = $capturista->createToken(
            'capturista-pin-token',
            ['*'],
            now()->addHours(2)
        );

        return response()->json([
            'token' => $token->plainTextToken,
        ], 200);
    }
}