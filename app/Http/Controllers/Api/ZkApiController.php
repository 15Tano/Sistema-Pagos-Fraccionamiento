<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vecino;
use App\Models\Pago;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ZkApiController extends Controller
{
    private const MENSUALIDAD = 280;

    public function index()
    {
        // Traemos todos los vecinos que tengan Tags
        $vecinos = Vecino::with('tags')->whereHas('tags')->get();
        
        $respuesta = [];

        foreach ($vecinos as $vecino) {
            // Calculamos la fecha real de vencimiento
            $expirationDate = $this->calculateExpirationDate($vecino->id);

            foreach ($vecino->tags as $tag) {
                if (!empty($tag->codigo)) {
                    $respuesta[] = [
                        'card_no' => $tag->codigo,
                        'expiration' => $expirationDate->toDateTimeString() // Formato: "2026-05-31 23:59:59"
                    ];
                }
            }
        }

        return response()->json($respuesta);
    }

    // Copia exacta de tu lógica de PagoController
    private function calculateExpirationDate($vecino_id)
    {
        $pagosCompletos = Pago::where('vecino_id', $vecino_id)
            ->selectRaw('mes, SUM(cantidad) as total')
            ->groupBy('mes')
            ->having('total', '>=', self::MENSUALIDAD)
            ->pluck('mes')->toArray();

        $currentDate = Carbon::now()->startOfMonth();
        $expirationDate = Carbon::now()->subDay()->endOfDay(); 

        for ($i = 0; $i < 12; $i++) {
            if (in_array($currentDate->format('Y-m'), $pagosCompletos)) {
                $expirationDate = $currentDate->copy()->endOfMonth()->endOfDay();
            } else {
                break; 
            }
            $currentDate->addMonth();
        }
        return $expirationDate;
    }
}