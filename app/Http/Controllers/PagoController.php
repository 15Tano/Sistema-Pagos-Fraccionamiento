<?php

namespace App\Http\Controllers;

use App\Models\Pago;
use App\Models\Vecino;
use Illuminate\Http\Request;
use Carbon\Carbon;

class PagoController extends Controller
{
    public function index()
    {
        $pagos = Pago::with('vecino')->latest()->get();
        return view('pagos.index', compact('pagos'));
    }

    public function create()
    {
        $vecinos = Vecino::all();
        return view('pagos.create', compact('vecinos'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'vecino_id' => 'required',
            'cantidad' => 'required|numeric|min:1',
            'tipo' => 'required|in:ordinario,extraordinario',
            'mes' => 'required',
        ]);

        $vecino = Vecino::findOrFail($request->vecino_id);
        $cantidad = $request->cantidad;
        $mes = Carbon::parse($request->mes)->startOfMonth();

        $mensualidad = 280;

        // Distribuir pagos
        while ($cantidad >= $mensualidad) {
            Pago::create([
                'vecino_id' => $vecino->id,
                'cantidad' => $mensualidad,
                'mes' => $mes->format('Y-m'),
                'tipo' => $request->tipo,
                'restante' => 0,
            ]);
            $cantidad -= $mensualidad;
            $mes->addMonth();
        }

        // Si sobra algo que no completa otra mensualidad
        if ($cantidad > 0) {
            Pago::create([
                'vecino_id' => $vecino->id,
                'cantidad' => $cantidad,
                'mes' => $mes->format('Y-m'),
                'tipo' => $request->tipo,
                'restante' => $mensualidad - $cantidad,
            ]);
        }

        return redirect()->route('pagos.index')->with('success', 'Pago registrado correctamente');
    }
}
