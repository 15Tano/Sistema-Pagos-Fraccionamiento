<?php

return [

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:5173',    // Vite dev
        'http://127.0.0.1:5173',   // Vite dev alternativo
        // 'https://tu-app.vercel.app' <- descomentar al hacer deploy
    ],

    'allowed_headers' => [
        'Content-Type',
        'Accept',
        'Authorization',
    ],

    'exposed_headers' => [],

    'max_age' => 86400,

    'supports_credentials' => false, // false = Bearer Tokens, no cookies

];