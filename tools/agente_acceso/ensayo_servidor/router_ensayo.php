<?php

// Entrada privada de ensayo. Nunca sirve archivos estaticos ni otras rutas.
$root = realpath(__DIR__);
$marker = $root.'/datos/listo.json';
if (PHP_SAPI !== 'cli-server' || ! is_file($marker) ||
    ! in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    exit;
}
$ready = json_decode(file_get_contents($marker), true, 32, JSON_THROW_ON_ERROR);
if (($ready['root'] ?? '') !== $root || ! is_file($root.'/datos/ensayo.sqlite')) {
    http_response_code(503);
    exit;
}
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'GET' && $path === '/salud') {
    header('Content-Type: application/json');
    echo json_encode(['status' => 'ensayo_listo', 'device_serial' => $ready['device_serial']]);
    exit;
}
if ($method !== 'POST' || ! in_array($path, ['/api/control-acceso/agente/estado', '/api/control-acceso/agente/lotes'], true)) {
    http_response_code(404);
    exit;
}
require $root.'/backend/public/index.php';
