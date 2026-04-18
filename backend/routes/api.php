<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\VecinoController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\PagoController;
use App\Http\Controllers\TagSaleController;
use App\Http\Controllers\Api\ZkApiController;
use App\Http\Controllers\DashboardController;


// ─── AUTH (públicas) ──────────────────────────────────────────────
Route::post('/login', [AuthController::class, 'login']);

// ─── RUTAS PROTEGIDAS ─────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/me', [AuthController::class, 'me']);

    // Vecinos
    Route::resource('vecinos', VecinoController::class);
    Route::get('vecinos/{numero_tag}/historial', [VecinoController::class, 'historial']);

    // Tags — rutas específicas ANTES del resource para evitar conflictos
    Route::get('tags/stock', [TagController::class, 'stock']);
    Route::get('tags/total_sales', [TagController::class, 'totalSales']);
    Route::get('tags/sales', [TagController::class, 'sales']);
    Route::patch('tags/{id}/toggle', [TagController::class, 'toggle']);
    Route::resource('tags', TagController::class);

    // Pagos — rutas específicas ANTES del resource
    Route::get('pagos/historico', [PagoController::class, 'historico']);
    Route::resource('pagos', PagoController::class);

    // Tag Sales — ruta específica ANTES del resource
    Route::delete('tag_sales/reset', [TagSaleController::class, 'reset']);
    Route::resource('tag_sales', TagSaleController::class);

});

// ─── ZKTeco (acceso desde script Python — token separado) ─────────
Route::get('/vencimientos', [ZkApiController::class, 'index']);