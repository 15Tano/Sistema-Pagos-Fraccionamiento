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

    // Tags de confianza para pruebas
    private const TAGS_PRUEBA = ['12160354', '6654315', '5308476', '6377078', '6344628'];

    public function index(Request $request)
    {
        $vecinos = Vecino::with('tags')->whereHas('tags')->get();

        $respuesta = [];

        foreach ($vecinos as $vecino) {
            $expirationDate = $this->calculateExpirationDate($vecino->id);

            foreach ($vecino->tags as $tag) {
                if (!empty($tag->codigo)) {
                    // Si es modo test, solo incluir los tags de prueba
                    if ($request->query('test') === 'true') {
                        if (!in_array($tag->codigo, self::TAGS_PRUEBA)) {
                            continue;
                        }
                    }

                    $respuesta[] = [
                        'card_no'    => $tag->codigo,
                        'expiration' => $expirationDate->toDateTimeString(),
                    ];
                }
            }
        }

        return response()->json($respuesta);
    }

    private function calculateExpirationDate($vecino_id)
    {
        $pagosCompletos = Pago::where('vecino_id', $vecino_id)
            ->selectRaw('mes, SUM(cantidad) as total')
            ->groupBy('mes')
            ->having('total', '>=', self::MENSUALIDAD)
            ->pluck('mes')->toArray();

        $currentDate    = Carbon::now()->startOfMonth();
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