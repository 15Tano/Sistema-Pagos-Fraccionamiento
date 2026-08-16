<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Vecino;
class AuthController extends Controller
{
    public function login(Request $request)
    {
        \Log::info('--- NUEVO INTENTO DE LOGIN ---');
        \Log::info('Todo lo que envió React: ', $request->all());
        $request->validate([
            'email'    => 'required', // Este campo recibirá email o username
            'password' => 'required',
        ]);
        $input    = trim($request->input('email'));
        $password = $request->input('password');
        // 1. Intentamos buscar por Email (Admin) o Username (Residente)
        $user = User::where('email', $input)
                    ->orWhere('username', $input)
                    ->first();
        // 2. Validación de existencia y contraseña
        if (!$user || !Hash::check($password, $user->password)) {
            return response()->json([
                'message' => 'Credenciales incorrectas.'
            ], 401);
        }

        // 3.5 Validación de horario para equipos de cobro
        $asignacion = null;
        if ($user->role === 'capturista') {
            $asignacion = \App\Models\AsignacionCobro::where('user_id', $user->id)
                ->whereDate('fecha', today())
                ->first();

            if (!$asignacion) {
                return response()->json([
                    'message' => 'No tienes acceso asignado el día de hoy.'
                ], 403);
            }

            $inicio = \Carbon\Carbon::parse($asignacion->fecha->toDateString() . ' ' . $asignacion->hora_inicio);
            $fin    = \Carbon\Carbon::parse($asignacion->fecha->toDateString() . ' ' . $asignacion->hora_fin);

            if (!now()->between($inicio, $fin)) {
                return response()->json([
                    'message' => 'Fuera del horario permitido de cobro.'
                ], 403);
            }
        }

        // 3. Lógica según el Rol
        $responseData = [
            'id'   => $user->id,
            'name' => $user->name,
            'role' => $user->role,
        ];
        if ($user->role === 'residente') {
            // Buscamos al vecino vinculado
            $vecino = Vecino::where('user_id', $user->id)->first();
            if (!$vecino) {
                return response()->json([
                    'message' => 'Usuario residente sin vecino vinculado.'
                ], 401);
            }
            // Agregamos datos del vecino y sus tags al response
            $responseData['vecino_id']   = $vecino->id;
            $responseData['vecino_uuid'] = $vecino->uuid;
            $responseData['tags']        = $vecino->tags->map(fn($t) => [
                'id'     => $t->id,
                'codigo' => $t->codigo,
                'activo' => $t->activo,
            ]);
        }
        // 4. Generar Token y responder
        $expiracion = $asignacion ? $fin : null;
        $token = $user->createToken('auth-token', ['*'], $expiracion)->plainTextToken;
        return response()->json([
            'token' => $token,
            'user'  => $responseData,
        ]);
    }
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Sesión cerrada correctamente.']);
    }
    public function me(Request $request)
    {
        // Cargamos la relación del vecino si es residente para que el frontend tenga todo
        $user = $request->user();
        if($user->role === 'residente') {
            $user->load('vecino.tags');
        }
        return response()->json($user);
    }
}
