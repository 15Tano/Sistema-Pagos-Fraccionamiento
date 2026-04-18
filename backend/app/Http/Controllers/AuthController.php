<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Tag;
use App\Models\Vecino;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required',
            'password' => 'required',
        ]);

        $input    = trim($request->input('email'));
        $password = $request->input('password');

        // --- CASO 1: ADMIN (es un email) ---
        if (filter_var($input, FILTER_VALIDATE_EMAIL)) {
            $user = User::where('username', $input)->first();

            if (!$user || !Hash::check($password, $user->password)) {
                return response()->json([
                    'message' => 'Credenciales incorrectas.'
                ], 401);
            }

            if ($user->role !== 'admin') {
                return response()->json([
                    'message' => 'No tienes permisos de administrador.'
                ], 403);
            }

            $token = $user->createToken('auth-token')->plainTextToken;

            return response()->json([
                'token' => $token,
                'user'  => [
                    'id'   => $user->id,
                    'name' => $user->name,
                    'role' => $user->role,
                ],
            ]);
        }

        // --- CASO 2: RESIDENTE (es un código de tag) ---
        $tag = Tag::where('codigo', $input)->first();

        if (!$tag) {
            return response()->json([
                'message' => 'Tag no encontrado.'
            ], 401);
        }

        if (!$tag->activo) {
            return response()->json([
                'message' => 'Este tag está desactivado.'
            ], 403);
        }

        $vecino = Vecino::find($tag->vecino_id);

        if (!$vecino || !$vecino->user_id) {
            return response()->json([
                'message' => 'No hay un usuario vinculado a este tag.'
            ], 401);
        }

        $user = User::find($vecino->user_id);

        if (!$user || !Hash::check($password, $user->password)) {
            return response()->json([
                'message' => 'Credenciales incorrectas.'
            ], 401);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'        => $user->id,
                'name'      => $user->name,
                'role'      => $user->role,
                'tag_usado' => $input,
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sesión cerrada correctamente.']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }
}