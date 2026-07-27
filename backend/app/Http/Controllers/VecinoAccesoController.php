<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Vecino;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;

class VecinoAccesoController extends Controller
{
    /**
     * POST /api/vecinos/registro-acceso
     *
     * Crea credenciales de acceso (User) para un vecino existente
     * y enlaza ambos registros mediante vecinos.user_id.
     */
    public function store(Request $request): JsonResponse
    {
        // ── 1. Validación ────────────────────────────────────────────────────
        $validated = $request->validate([
            'vecino_id' => [
                'required',
                'integer',
                // El vecino debe existir en la BD
                'exists:vecinos,id',
            ],
            'username' => [
                'required',
                'string',
                'max:60',
                // El username debe ser único en la tabla users
                'unique:users,username',
                // Sin espacios
                'regex:/^\S+$/',
            ],
            'password' => [
                'required',
                'string',
            ],
        ], [
            // Mensajes personalizados en español
            'vecino_id.required'  => 'Debes seleccionar un vecino.',
            'vecino_id.exists'    => 'El vecino seleccionado no existe en la base de datos.',
            'username.required'   => 'El nombre de usuario es obligatorio.',
            'username.unique'     => 'Ese nombre de usuario ya está en uso.',
            'username.regex'      => 'El nombre de usuario no puede contener espacios.',
            'password.required'   => 'La contraseña es obligatoria.',
        ]);

        // ── 2. Obtener el vecino y verificar que NO tenga ya un usuario ──────
        $vecino = Vecino::findOrFail($validated['vecino_id']);

        if ($vecino->user_id !== null) {
            return response()->json([
                'message' => 'Este vecino ya cuenta con credenciales de acceso.',
            ], 422);
        }

        // ── 3. Crear User y actualizar Vecino dentro de una transacción ──────
        DB::transaction(function () use ($validated, $vecino) {

            // Crear el usuario.
            // El modelo User tiene 'password' => 'hashed' en $casts,
            // por lo que Laravel bcryptea automáticamente al asignar.
            $user = User::create([
                'name'     => $vecino->nombre,   // nombre legible
                'username' => $validated['username'],
                'password' => $validated['password'], // se hashea por el cast
                'role'     => 'residente',               // rol fijo para este flujo
            ]);

            // Enlazar el vecino con el nuevo usuario
            $vecino->update([
                'user_id' => $user->id,
            ]);
        });

        return response()->json([
            'message' => 'Acceso creado correctamente.',
        ], 201);
    }

    /**
     * POST /api/vecinos/eliminar-acceso
     *
     * Elimina las credenciales de acceso (User) de un vecino
     * y desvincula vecinos.user_id.
     */
    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vecino_id' => ['required', 'integer', 'exists:vecinos,id'],
        ], [
            'vecino_id.required' => 'Debes seleccionar un vecino.',
            'vecino_id.exists'   => 'El vecino seleccionado no existe en la base de datos.',
        ]);

        $vecino = Vecino::findOrFail($validated['vecino_id']);

        if ($vecino->user_id === null) {
            return response()->json([
                'message' => 'Este vecino no cuenta con credenciales de acceso.',
            ], 422);
        }

        DB::transaction(function () use ($vecino) {
            $user = User::find($vecino->user_id);

            // Desvincular primero, para no depender de que el delete del user salga bien
            $vecino->update(['user_id' => null]);

            if ($user) {
                // Revoca cualquier token de Sanctum activo — si no haces esto, el
                // residente puede seguir usando la PWA con la sesión ya abierta
                // aunque borres el registro de User.
                $user->tokens()->delete();
                $user->delete();
            }
        });

        return response()->json([
            'message' => 'Acceso eliminado correctamente.',
        ]);
    }
}
