<?php

namespace App\Http\Controllers;

use App\Models\Pago;
use App\Models\Vecino;
use Illuminate\Http\Request;
use Carbon\Carbon;

class PagoController extends Controller
{
    const MENSUALIDAD = 280;

    public function index()
    {
        return response()->json(Pago::with('vecino')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'vecino_id' => 'required|exists:vecinos,id',
            'monto' => 'required|numeric|min:1'
        ]);

        $vecino = Vecino::findOrFail($request->vecino_id);
        $monto = $request->monto;
        $mesesPagados = intdiv($monto, self::MENSUALIDAD); // cuántos meses cubre
        $resto = $monto % self::MENSUALIDAD;

        $pagos = [];
        $fecha = Carbon::now();

        for ($i = 0; $i < $mesesPagados; $i++) {
            $pagos[] = Pago::create([
                'vecino_id' => $vecino->id,
                'monto' => self::MENSUALIDAD,
                'fecha_pago' => $fecha->copy()->addMonths($i),
                'estado' => 'Pagado'
            ]);
        }

        if ($resto > 0) {
            $pagos[] = Pago::create([
                'vecino_id' => $vecino->id,
                'monto' => $resto,
                'fecha_pago' => $fecha,
                'estado' => 'Parcial'
            ]);
        }

        return response()->json([
            'message' => 'Pagos registrados correctamente',
            'pagos' => $pagos
        ]);
    }

    public function show($id)
    {
        return response()->json(Pago::with('vecino')->findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        $pago = Pago::findOrFail($id);
        $pago->update($request->all());
        return response()->json($pago);
    }

    public function destroy($id)
    {
        Pago::destroy($id);
        return response()->json(['message' => 'Pago eliminado']);
    }
}