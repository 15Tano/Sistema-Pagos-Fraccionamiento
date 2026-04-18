<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\AuthController;

/*
|--------------------------------------------------------------------------
| RUTAS PÚBLICAS (Login)
|--------------------------------------------------------------------------
*/

// 1. Mostrar el formulario (GET)
Route::get('/login', [AuthController::class, 'showLoginForm'])->name('login');

// 2. Recibir los datos del formulario (POST) <--- ESTA ES LA QUE TE FALTABA
Route::post('/login', [AuthController::class, 'login']);

// 3. Salir (Logout)
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

Route::middleware(['auth'])->group(function () {
    
    Route::get('/', function () {
        // Redirección inteligente al entrar a la raíz
        if (Auth::user()->role === 'admin') {
            return redirect()->route('vecinos.index');
        }
        return redirect()->route('residentes.dashboard');
    });

    // Ruta del Residente
    Route::get('/mi-acceso', function () {
        $user = Auth::user();
        return "<h1>¡ÉXITO!</h1> <p>Hola vecino " . $user->name . ". Entraste con el Tag: " . $user->username . "</p>";
    })->name('residentes.dashboard');



Route::get('/{any}', function () {
    return file_get_contents(public_path('react/build/index.html'));
})->where('any', '.*');

// Ruta temporal para probar que el login de residente funciona
Route::middleware(['auth'])->get('/mi-acceso', function () {
    $user = Auth::user();
    return "<h1>¡ÉXITO!</h1> <p>Hola vecino " . $user->name . ". Entraste con el Tag: " . $user->username . "</p>";
})->name('residentes.dashboard');

});