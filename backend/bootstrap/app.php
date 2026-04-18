<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Auth\AuthenticationException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
    // Reemplaza el Authenticate por el nuestro
    $middleware->alias([
        'auth' => \App\Http\Middleware\Authenticate::class,
    ]);

    $middleware->api(prepend: [
        \Illuminate\Http\Middleware\HandleCors::class,
    ]);

    $middleware->validateCsrfTokens(except: [
        'login',
        'logout',
        'sanctum/csrf-cookie',
    ]);
})
    ->withExceptions(function (Exceptions $exceptions): void {
        // Siempre responde JSON 401 en rutas api/* — sin importar el Accept header
        $exceptions->render(function (AuthenticationException $e, $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'No autenticado.'
                ], 401);
            }
        });
    })->create();