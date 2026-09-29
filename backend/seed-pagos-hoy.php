<?php

$hoy = now('America/Mexico_City')->toDateString();
$mesActual = now('America/Mexico_City')->format('Y-m');

$vecinos = \App\Models\Vecino::inRandomOrder()->take(35)->get();

foreach ($vecinos as $vecino) {
    $esEspecial = rand(1, 100) <= 15;
    $esExtraordinario = rand(1, 100) <= 10;

    $tipo = $esExtraordinario ? 'extraordinario' : 'ordinario';

    if ($esExtraordinario) {
        $cantidad = collect([150, 200, 350])->random();
    } elseif ($esEspecial) {
        $cantidad = collect([300, 500, 560])->random();
    } else {
        $cantidad = 280;
    }

    \App\Models\Pago::create([
        'vecino_id'      => $vecino->id,
        'cantidad'       => $cantidad,
        'mes'            => $mesActual,
        'tipo'           => $tipo,
        'restante'       => 0,
        'fecha_de_cobro' => $hoy,
        'meses_pagados'  => 1,
    ]);
}

echo \App\Models\Pago::whereDate('fecha_de_cobro', $hoy)->count() . " pagos creados hoy.\n";
echo \App\Models\Pago::whereDate('fecha_de_cobro', $hoy)->sum('cantidad') . " total del día.\n";