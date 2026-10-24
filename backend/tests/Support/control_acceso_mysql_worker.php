<?php

// Un proceso PHP independiente ejecuta el kernel HTTP real; entrada solo por stdin.
require dirname(__DIR__, 2).'/vendor/autoload.php';

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Tests\Support\ControlAccessMySqlTrial;

try {
    $input = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);
    $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
    $kernel = $app->make(Kernel::class);
    $kernel->bootstrap();
    ControlAccessMySqlTrial::configure();
    if (! in_array($input['endpoint'], ['estado', 'lotes'], true)) {
        throw new RuntimeException('Ruta de ensayo invalida.');
    }
    $request = Request::create('/api/control-acceso/agente/'.$input['endpoint'], 'POST', [], [], [],
        ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer '.$input['token']], json_encode($input['payload'], JSON_THROW_ON_ERROR));
    $response = $kernel->handle($request);
    $kernel->terminate($request, $response);
    echo json_encode(['status' => $response->getStatusCode(),
        'body' => json_decode($response->getContent(), true, 64, JSON_THROW_ON_ERROR)], JSON_THROW_ON_ERROR);
} catch (Throwable) {
    // No imprimir configuracion, secreto ni mensajes SQL con bindings.
    fwrite(STDERR, "Fallo del worker de ensayo MySQL.\n");
    exit(1);
}
