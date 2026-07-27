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
    private const TAGS_PRUEBA = ['12160354', '6654315', '5308479', '6377078', '6344928'];

    // Mapa dinámico de meses y sus días exactos de vencimiento
    // Formato: [Número de Mes => Día de Corte]
    private const DIAS_VENCIMIENTO = [
        1  => 7,  // Vencimiento en Enero (Aplica al pagar Diciembre)
        2  => 5,  // Vencimiento en Febrero (Aplica al pagar Enero)
        3  => 5,  // Vencimiento en Marzo (Aplica al pagar Febrero)
        4  => 9,  // Vencimiento en Abril (Aplica al pagar Marzo)
        5  => 7,  // Vencimiento en Mayo (Aplica al pagar Abril)
        6  => 4,  // Vencimiento en Junio (Aplica al pagar Mayo)
        7  => 9,  // Vencimiento en Julio (Aplica al pagar Junio)
        8  => 6,  // Vencimiento en Agosto (Aplica al pagar Julio)
        9  => 10, // Vencimiento en Septiembre (Aplica al pagar Agosto)
        10 => 8,  // Vencimiento en Octubre (Aplica al pagar Septiembre)
        11 => 5,  // Vencimiento en Noviembre (Aplica al pagar Octubre)
        12 => 10, // Vencimiento en Diciembre (Aplica al pagar Noviembre)
    ];

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

        // 1. Definimos los puntos de validación (Mes anterior y mes actual)
        $mesAnterior = Carbon::now()->startOfMonth()->subMonth();
        $mesActual   = Carbon::now()->startOfMonth();

        // 2. Fecha de castigo default: Si debe, buscamos qué día venció el mes pasado
        $mesCastigo = Carbon::now()->subMonth();
        $diaCastigo = self::DIAS_VENCIMIENTO[$mesCastigo->month];
        $expirationDate = $mesCastigo->day($diaCastigo)->endOfDay();

        // 3. ¿Desde dónde empezamos a contar?
        if (in_array($mesAnterior->format('Y-m'), $pagosCompletos)) {
            // Pagó el mes pasado. Arrancamos desde ahí.
            $checkDate = $mesAnterior->copy();
        } elseif (in_array($mesActual->format('Y-m'), $pagosCompletos)) {
            // NO pagó el mes pasado, pero YA pagó este mes. Arrancamos desde este mes.
            $checkDate = $mesActual->copy();
        } else {
            // No pagó ni el mes pasado ni este. Retornamos la fecha de castigo.
            return $expirationDate;
        }

        // 4. El Loop: Desde el punto válido, calculamos hacia adelante (soporta hasta 2 años de pagos adelantados)
        for ($i = 0; $i < 24; $i++) {
            if (in_array($checkDate->format('Y-m'), $pagosCompletos)) {
                // Brincamos al mes de vencimiento (Mes pagado + 1)
                $targetExp = $checkDate->copy()->addMonth();
                // Buscamos el día exacto de ese mes en el arreglo y lo aplicamos a las 23:59:59
                $diaCorte = self::DIAS_VENCIMIENTO[$targetExp->month];
                $expirationDate = $targetExp->day($diaCorte)->endOfDay();
                // Preparamos la variable para checar si el siguiente mes también está pagado
                $checkDate->addMonth();
            } else {
                // Hueco encontrado, detenemos el ciclo
                break;
            }
        }
        return $expirationDate;
    }
}
