<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\VecinoController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\PagoController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::resource('vecinos', VecinoController::class);
Route::get('vecinos/{numero_tag}/historial', [VecinoController::class, 'historial']);
Route::resource('tags', TagController::class);
Route::get('pagos/historico', [PagoController::class, 'historico']);
Route::resource('pagos', PagoController::class);
Route::patch('tags/{id}/toggle', [TagController::class, 'toggle']);

// New routes for tag sales and tag controller extra methods
use App\Http\Controllers\TagSaleController;

Route::resource('tag_sales', TagSaleController::class);
Route::delete('tag_sales/reset', [TagSaleController::class, 'reset']);
Route::delete('/tag_sales/{id}', [TagSaleController::class, 'destroy']);
Route::get('tags/stock', [TagController::class, 'stock']);
Route::get('tags/total_sales', [TagController::class, 'totalSales']);
Route::get('tags/sales', [TagController::class, 'sales']);
// Add new route for enhanced historico endpoint
Route::get('/pagos/historico', [PagoController::class, 'getHistorico']);