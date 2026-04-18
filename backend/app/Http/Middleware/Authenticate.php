<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    protected function redirectTo(Request $request): ?string
    {
        // Si es una petición API, nunca redirigir — devolver null lanza 401 JSON
        if ($request->is('api/*')) {
            return null;
        }

        return null;
    }
}