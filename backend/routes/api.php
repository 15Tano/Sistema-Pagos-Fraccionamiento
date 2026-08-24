<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AvisoController;
use App\Http\Controllers\AuditController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\VecinoController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\PagoController;
use App\Http\Controllers\TagSaleController;
use App\Http\Controllers\Api\ZkApiController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CapturistaController;
use App\Http\Controllers\VecinoAccesoController;
use App\Http\Controllers\EncuestaController;


// ─── AUTH (públicas) ──────────────────────────────────────────────
Route::middleware('throttle:5,1')->post('/login', [AuthController::class, 'login']);
Route::post('/capturista/verify-pin', [CapturistaController::class, 'verifyPin']);
Route::post('/vecinos/registro-acceso', [VecinoAccesoController::class, 'store']);
Route::post('/vecinos/eliminar-acceso', [VecinoAccesoController::class, 'destroy']);

// ─── RUTAS PROTEGIDAS ─────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('vecinos/plazas', [VecinoController::class, 'plazas']);

    // Vecinos
    Route::resource('vecinos', VecinoController::class);
    Route::get('vecinos/{numero_tag}/historial', [VecinoController::class, 'historial']);

    /* CORRECCION DE RUTAS DE TAGS: antes se colaban tags "falsos" en el stock que tenían created_at pero no sold_at, lo que rompía las estadísticas de ventas mensuales. Ahora separamos claramente las rutas de tags (que solo manejan el stock) de las de tag_sales (que manejan las ventas), y ya no hay riesgo de mezclar tags falsos con ventas reales. Por eso ahora sí es seguro usar created_at para filtrar ventas por mes, porque ya no hay tags falsos colados.
    // Tags — rutas específicas ANTES del resource para evitar conflictos
    Route::get('tags/stock', [TagController::class, 'stock']);
    Route::get('tags/total_sales', [TagController::class, 'totalSales']);
    Route::get('tags/sales', [TagController::class, 'sales']);
    Route::patch('tags/{id}/toggle', [TagController::class, 'toggle']);
    Route::resource('tags', TagController::class);
    */
    // Tags
    Route::get('tags/stock', [TagController::class, 'stock']);
    Route::patch('tags/{id}/toggle', [TagController::class, 'toggle']);
    Route::resource('tags', TagController::class);

    // Tag Sales
    Route::delete('tag_sales/reset', [TagSaleController::class, 'reset']);
    Route::resource('tag_sales', TagSaleController::class); // <--- Este es el bueno que usaremos
    // Pagos — rutas específicas ANTES del resource
    // Pagos — rutas específicas ANTES del resource
    Route::get('pagos/historico', [PagoController::class, 'getHistorico']);
    Route::get('pagos/mis-pagos', [PagoController::class, 'misPagos']);
    Route::get('pagos/estado-meses/{vecinoUuid}', [PagoController::class, 'estadoMeses']);
    Route::get('pagos/{uuid}/recibo', [PagoController::class, 'recibo']);
    Route::resource('pagos', PagoController::class)->except(['show']);
    Route::get('pagos/{pago}', [PagoController::class, 'show']);
    Route::resource('pagos', PagoController::class);

    /* Tag Sales — ruta específica ANTES del resource
    Route::delete('tag_sales/reset', [TagSaleController::class, 'reset']);
    Route::resource('tag_sales', TagSaleController::class);
    */

        Route::get('/audit-logs', [AuditController::class, 'index']);

        // Avisos
        Route::get('/avisos', [AvisoController::class, 'index']);
        Route::post('/avisos', [AvisoController::class, 'store']);
        Route::post('/avisos/{id}', [AvisoController::class, 'update']);
        Route::delete('/avisos/{id}', [AvisoController::class, 'destroy']);

        // Encuestas
        Route::get('/encuestas/activa', [EncuestaController::class, 'activa']);
        Route::post('/encuestas/{encuesta}/votar', [EncuestaController::class, 'votar']);
        Route::get('/encuestas', [EncuestaController::class, 'index']);
        Route::post('/encuestas', [EncuestaController::class, 'store']);
        Route::patch('/encuestas/{encuesta}/toggle', [EncuestaController::class, 'toggle']);
        Route::get('/encuestas/{encuesta}/resultados', [EncuestaController::class, 'resultados']);
});

// ─── ZKTeco (acceso desde script Python — token separado) ─────────
Route::get('/vencimientos', [ZkApiController::class, 'index']);

Route::get('/ping', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toDateTimeString(),
    ]);
});