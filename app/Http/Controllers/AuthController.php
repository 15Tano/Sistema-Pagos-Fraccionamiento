<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;

class AuthController extends Controller
{
    // Formulario de login
    public function showLoginForm()
    {
        return view('auth.login');
    }

    // Procesar login
    public function login(Request $request)
    {
        $credentials = $request->only('email', 'password');

        if (Auth::attempt($credentials)) {
            return redirect()->route('vecinos.index'); // admin al sistema completo
        }

        return back()->withErrors([
            'email' => 'Credenciales incorrectas.',
        ]);
    }

    // Cerrar sesión
    public function logout()
    {
        Auth::logout();
        return redirect()->route('login');
    }

    // Invitado
    public function guest(Request $request)
{
    $vecinos = [];

    if ($request->has('q') && $request->q != '') {
        $vecinos = \App\Models\Vecino::where('nombre', 'like', '%' . $request->q . '%')
            ->with('pagos') // relación con pagos
            ->get();
    }

    return view('guest.search', compact('vecinos'));
}
}
