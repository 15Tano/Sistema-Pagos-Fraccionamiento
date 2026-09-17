<?php

namespace App\Console\Commands;

use App\Models\CorteCaja;
use App\Models\Pago;
use Carbon\Carbon;
use Illuminate\Console\Command;

class AbrirCorteCaja extends Command
{
    protected $signature   = 'cortes-caja:abrir';
    protected $description = 'Abre el corte de caja del día si hubo pagos registrados; bloquea al capturista hasta que cuadre';

    public function handle(): void
    {
        $hoy = Carbon::now('America/Mexico_City')->toDateString();

        $huboPagosHoy = Pago::whereDate('fecha_de_cobro', $hoy)->exists();

        if (!$huboPagosHoy) {
            $this->info("Sin pagos registrados el {$hoy}, no se abre corte.");
            return;
        }

        $yaExiste = CorteCaja::where('fecha', $hoy)->exists();

        if ($yaExiste) {
            $this->info("Ya existe un corte para el {$hoy}, no se duplica.");
            return;
        }

        CorteCaja::create([
            'fecha'  => $hoy,
            'estado' => 'en_proceso',
        ]);

        $this->info("Corte de caja abierto para el {$hoy}.");
    }
}