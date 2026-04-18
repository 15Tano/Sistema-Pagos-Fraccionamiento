<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash; // <--- Importamos Hash correctamente
use App\Models\User;
use App\Models\Tag;
use App\Models\Vecino;

class AuthController extends Controller
{
    public function showLoginForm()
    {
        return response()->json([
            'status' => 'error',
            'message' => 'Acceso no autorizado. Por favor inicie sesión vía POST.'
        ], 401); // ✅ (Esto devuelve un JSON limpio)
    }

    /*public function login(Request $request)
    {
        // 1. Validar datos
        $request->validate([
            'email' => 'required',
            'password' => 'required'
        ]);

        $input = $request->input('email');
        $password = $request->input('password');

        // --- CASO 1: ADMIN (Correo) ---
        if (filter_var($input, FILTER_VALIDATE_EMAIL)) {
            if (Auth::attempt(['email' => $input, 'password' => $password])) {
                $request->session()->regenerate();
                return response()->json([
                    'status' => 'success', 
                    'role' => 'admin', 
                    'name' => Auth::user()->name
                ]);
            }
        } 
        
        // --- CASO 2: RESIDENTE (Tag) ---
        else {
            // A. Buscamos el Tag
            $tagEncontrado = Tag::where('codigo', $input)->first();

            if ($tagEncontrado) {
                // B. Buscamos al Vecino dueño del Tag
                $vecino = Vecino::where('id', $tagEncontrado->vecino_id)->first();
                
                // C. Si el vecino existe y tiene un Usuario vinculado
                if ($vecino && $vecino->user_id) {
                    $user = User::find($vecino->user_id);

                    // D. Verificamos la contraseña y logueamos manualmente
                    // AQUÍ ESTABA EL ERROR: Usamos Hash::check sin la barra invertida
                    if ($user && Hash::check($password, $user->password)) {
                        
                        Auth::login($user); // <--- Esto crea la sesión de Laravel
                        $request->session()->regenerate();
                        
                        return response()->json([
                            'status' => 'success', 
                            'role' => 'residente', 
                            'name' => $user->name,
                            'tag_usado' => $input
                        ]);
                    }
                }
            }
        }
        
        // Si falla cualquiera de los dos casos:
        return response()->json([
            'status' => 'error', 
            'message' => 'Credenciales incorrectas'
        ], 401);
    }*/

    public function login(Request $request)
{
    // 1. Validar
    $request->validate(['email' => 'required', 'password' => 'required']);
    
    $input = trim($request->input('email'));
    $password = $request->input('password');

    // --- LOGICA DETECTIVE ---
    
    // A. Buscamos el Tag
    $tag = \App\Models\Tag::where('codigo', $input)->first();
    if (!$tag) {
        return response()->json(['status' => 'error', 'message' => "ERROR: No existe el Tag '$input' en la BD."], 401);
    }

    // B. Buscamos al Vecino
    $vecino = \App\Models\Vecino::find($tag->vecino_id);
    if (!$vecino) {
        return response()->json(['status' => 'error', 'message' => "ERROR: El Tag existe, pero el Vecino ID {$tag->vecino_id} fue borrado."], 401);
    }

    // C. Buscamos el Usuario
    if (!$vecino->user_id) {
        return response()->json(['status' => 'error', 'message' => "ERROR: El vecino {$vecino->nombre} no tiene un usuario vinculado."], 401);
    }

    $user = \App\Models\User::find($vecino->user_id);
    if (!$user) {
        return response()->json(['status' => 'error', 'message' => "ERROR: El user_id {$vecino->user_id} apunta a la nada."], 401);
    }

    // D. Verificamos Password
    if (!Hash::check($password, $user->password)) {
        return response()->json(['status' => 'error', 'message' => "ERROR: Usuario encontrado ({$user->name}), pero la contraseña es incorrecta."], 401);
    }

    // ¡ÉXITO!
    Auth::login($user);
    $request->session()->regenerate();
    
    return response()->json([
        'status' => 'success', 
        'role' => 'residente', 
        'name' => $user->name,
        'tag_usado' => $input
    ]);
}

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->json(['status' => 'success']);
    }
}