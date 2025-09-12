<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\VecinoController;
use App\Http\Controllers\PagoController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\AuthController;

// Login
Route::get('/login', [AuthController::class, 'showLoginForm'])->name('login');
Route::post('/login', [AuthController::class, 'login'])->name('login.post');
Route::get('/logout', [AuthController::class, 'logout'])->name('logout');

// Invitado
Route::get('/guest', [AuthController::class, 'guest'])->name('guest');

// Página de inicio
Route::get('/', function () {
    return view('welcome'); // o cámbialo por dashboard.blade.php cuando lo tengas
});

// CRUD Vecinos con vistas
Route::resource('vecinos', VecinoController::class);

// CRUD Pagos con vistas
Route::resource('pagos', PagoController::class);

// CRUD Tags con vistas
Route::resource('tags', TagController::class);

// Activar / desactivar TAG
Route::patch('tags/{id}/toggle', [TagController::class, 'toggle'])->name('tags.toggle');

Route::get('/vecinos', [VecinoController::class, 'index'])->name('vecinos.index');
Route::get('/vecinos/create', [VecinoController::class, 'create'])->name('vecinos.create');
Route::post('/vecinos', [VecinoController::class, 'store'])->name('vecinos.store');
Route::get('/vecinos/{id}/edit', [VecinoController::class, 'edit'])->name('vecinos.edit');
Route::put('/vecinos/{id}', [VecinoController::class, 'update'])->name('vecinos.update');
Route::delete('/vecinos/{id}', [VecinoController::class, 'destroy'])->name('vecinos.destroy');