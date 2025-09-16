<?php

namespace App\Http\Controllers;

use App\Models\Pago;
use App\Models\Vecino;
use Illuminate\Http\Request;
use Carbon\Carbon;

class PagoController extends Controller
{
    public function index(Request $request)
    {
        $query = Pago::with('vecino')->latest();

        if ($request->has('month') && $request->has('year')) {
            $month = $request->input('month');
            $year = $request->input('year');
            $query->whereYear('fecha_de_cobro', $year)
                  ->whereMonth('fecha_de_cobro', $month);
        } elseif ($request->has('year')) {
            $year = $request->input('year');
            $query->whereYear('fecha_de_cobro', $year);
        }

        if ($request->has('calle')) {
            $query->whereHas('vecino', function($q) use ($request) {
                $q->where('calle', $request->input('calle'));
            });
        }

        if ($request->has('vecino')) {
            $query->whereHas('vecino', function($q) use ($request) {
                $q->where('nombre', $request->input('vecino'));
            });
        }

        if ($request->has('tipo')) {
            $query->where('tipo', $request->input('tipo'));
        }

        $pagos = $query->get();

        if ($request->wantsJson()) {
            return response()->json($pagos);
        }

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
            'fecha_de_cobro' => 'nullable|date',
        ]);

        $vecino = Vecino::findOrFail($request->vecino_id);
        $cantidad = $request->cantidad;
        $mes = Carbon::parse($request->mes)->startOfMonth();

        $mensualidad = 280;

        // Calculate total paid for the month so far
        $totalPagadoMes = Pago::where('vecino_id', $vecino->id)
            ->where('mes', $mes->format('Y-m'))
            ->sum('cantidad');

        $restante = max(0, $mensualidad - $totalPagadoMes - $cantidad);

        // Always create a new pago record
        Pago::create([
            'vecino_id' => $vecino->id,
            'cantidad' => $cantidad,
            'mes' => $mes->format('Y-m'),
            'tipo' => $request->tipo,
            'restante' => $restante,
            'fecha_de_cobro' => $request->fecha_de_cobro ?: Carbon::now()->toDateString(),
        ]);

        // Update tag status to active if vecino has a tag and total paid >= mensualidad
        if ($vecino->tag) {
            $currentMonth = Carbon::now()->format('Y-m');
            $totalPagadoCurrent = $vecino->pagos()->where('mes', $currentMonth)->sum('cantidad');
            if ($totalPagadoCurrent >= $mensualidad) {
                $vecino->tag->update(['activo' => true]);
            } else {
                $vecino->tag->update(['activo' => false]);
            }
        }

        return redirect()->route('pagos.index')->with('success', 'Pago registrado correctamente');
    }

    public function show($id)
    {
        $pago = Pago::with('vecino')->findOrFail($id);
        return response()->json($pago);
    }

    public function update(Request $request, $id)
    {
        $pago = Pago::findOrFail($id);

        $request->validate([
            'vecino_id' => 'required',
            'cantidad' => 'required|numeric|min:0.01',
            'tipo' => 'required|in:ordinario,extraordinario',
            'mes' => 'required',
            'restante' => 'required|numeric|min:0',
            'fecha_de_cobro' => 'nullable|date',
        ]);

        $pago->update($request->all());

        // Recalculate restante for all pagos in the month
        $this->recalculateRestanteForMonth($pago->mes, $pago->vecino_id);

        return response()->json(['message' => 'Pago actualizado.', 'pago' => $pago]);
    }

    public function destroy($id)
    {
        $pago = Pago::findOrFail($id);
        $mes = $pago->mes;
        $vecino_id = $pago->vecino_id;
        $pago->delete();

        // Recalculate restante for the remaining pagos in the month
        $this->recalculateRestanteForMonth($mes, $vecino_id);

        return response()->json(['message' => 'Pago eliminado.']);
    }

    private function recalculateRestanteForMonth($mes, $vecino_id)
    {
        $mensualidad = 280;
        $pagos = Pago::where('vecino_id', $vecino_id)
            ->where('mes', $mes)
            ->orderBy('fecha_de_cobro')
            ->orderBy('id')
            ->get();

        $cumulative = 0;
        foreach ($pagos as $p) {
            $cumulative += $p->cantidad;
            $p->restante = max(0, $mensualidad - $cumulative);
            $p->save();
        }
    }
}
