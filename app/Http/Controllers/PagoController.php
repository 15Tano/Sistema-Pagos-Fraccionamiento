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
        $cantidadTotal = $request->cantidad;
        $mesInicial = Carbon::parse($request->mes)->startOfMonth();

        $mensualidad = 280;
        $remainingAmount = $cantidadTotal;
        $currentMonth = $mesInicial->copy();

        // Process payments month by month until the amount is fully distributed
        while ($remainingAmount > 0) {
            $mesString = $currentMonth->format('Y-m');

            // Calculate total paid for this month so far
            $totalPagadoMes = Pago::where('vecino_id', $vecino->id)
                ->where('mes', $mesString)
                ->sum('cantidad');

            $neededForMonth = max(0, $mensualidad - $totalPagadoMes);
            $amountForThisMonth = min($remainingAmount, $neededForMonth);

            if ($amountForThisMonth > 0) {
                // Check if a payment already exists for this month
                $existingPago = Pago::where('vecino_id', $vecino->id)
                    ->where('mes', $mesString)
                    ->where('tipo', $request->tipo)
                    ->first();

                if ($existingPago) {
                    // Add to existing payment
                    $existingPago->cantidad += $amountForThisMonth;
                    $existingPago->save();
                    // Recalculate restante for this month
                    $this->recalculateRestanteForMonth($mesString, $vecino->id);
                } else {
                    // Create new payment
                    $restante = max(0, $mensualidad - $totalPagadoMes - $amountForThisMonth);
                    Pago::create([
                        'vecino_id' => $vecino->id,
                        'cantidad' => $amountForThisMonth,
                        'mes' => $mesString,
                        'tipo' => $request->tipo,
                        'restante' => $restante,
                        'fecha_de_cobro' => $request->fecha_de_cobro ?: Carbon::now()->toDateString(),
                    ]);
                }

                $remainingAmount -= $amountForThisMonth;
            }

            // Move to next month
            $currentMonth->addMonth();
        }

        // Update tag status for the current month
        $this->updateTagStatusForMonth($vecino, Carbon::now()->format('Y-m'));

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Pago registrado correctamente']);
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

        $oldMes = $pago->mes;
        $oldVecinoId = $pago->vecino_id;
        $oldCantidad = $pago->cantidad;

        $pago->update($request->all());

        // If month or vecino changed, we need to recalculate for both old and new
        if ($oldMes !== $pago->mes || $oldVecinoId !== $pago->vecino_id) {
            $this->recalculateRestanteForMonth($oldMes, $oldVecinoId);
            $this->recalculateRestanteForMonth($pago->mes, $pago->vecino_id);
        } else {
            // Recalculate restante for the month
            $this->recalculateRestanteForMonth($pago->mes, $pago->vecino_id);
        }

        // Update tag status if month changed
        if ($oldMes !== $pago->mes) {
            $vecino = $pago->vecino;
            $this->updateTagStatusForMonth($vecino, $oldMes);
            $this->updateTagStatusForMonth($vecino, $pago->mes);
        }

        return response()->json(['message' => 'Pago actualizado.', 'pago' => $pago]);
    }

    public function destroy($id)
    {
        $pago = Pago::findOrFail($id);
        $mes = $pago->mes;
        $vecino_id = $pago->vecino_id;
        $vecino = $pago->vecino;
        $pago->delete();

        // Recalculate restante for the month
        $this->recalculateRestanteForMonth($mes, $vecino_id);

        // Update tag status for the month
        $this->updateTagStatusForMonth($vecino, $mes);

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

    private function updateTagStatusForMonth($vecino, $mes)
    {
        if ($vecino->tag) {
            $mensualidad = 280;
            $totalPagadoMes = $vecino->pagos()->where('mes', $mes)->sum('cantidad');
            $vecino->tag->update(['activo' => $totalPagadoMes >= $mensualidad]);
        }
    }

    // Only replace the getHistorico method in your existing PagoController.php

    public function getHistorico(Request $request)
{
    $query = Pago::with(['vecino.tags']);

    // Filter by specific month (for monthly view)
    if ($request->has('mes')) {
        $query->where('mes', $request->mes);
    }

    // Filter by vecino ID (for individual view)  
    if ($request->has('vecino_id')) {
        $query->where('vecino_id', $request->vecino_id);
    }

    // Filter for advance payments only (payments for future months)
    if ($request->has('adelantados') && $request->adelantados == 'true') {
        $currentMonth = Carbon::now()->format('Y-m');
        $query->where('mes', '>', $currentMonth);
    }

    // Filter by street (via vecino relationship)
    if ($request->has('calle')) {
        $query->whereHas('vecino', function($q) use ($request) {
            $q->where('calle', $request->calle);
        });
    }

    // Filter by payment type
    if ($request->has('tipo')) {
        $query->where('tipo', $request->tipo);
    }

    // In your getHistorico method, add:
    if ($request->has('fecha_cobro')) {
        $query->whereDate('fecha_de_cobro', $request->fecha_cobro);
    }

    // Order by month descending, then by creation date
    $pagos = $query->orderBy('mes', 'desc')
                   ->orderBy('created_at', 'desc')
                   ->get();

    return response()->json($pagos);
}
/*public function getHistorico(Request $request)
{
    $query = Pago::with(['vecino.tags']);

    // Filter by specific month (for monthly view)
    if ($request->has('mes')) {
        $query->where('mes', $request->mes);
    }

    // Filter by vecino ID (for individual view)  
    if ($request->has('vecino_id')) {
        $query->where('vecino_id', $request->vecino_id);
    }

    // Filter for advance payments only (payments for future months)
    if ($request->has('adelantados') && $request->adelantados == 'true') {
        $currentMonth = Carbon::now()->format('Y-m');
        $query->where('mes', '>', $currentMonth);
    }

    // Filter by street (via vecino relationship)
    if ($request->has('calle')) {
        $query->whereHas('vecino', function($q) use ($request) {
            $q->where('calle', $request->calle);
        });
    }

    // Filter by payment type
    if ($request->has('tipo')) {
        $query->where('tipo', $request->tipo);
    }

    // Filter by payment collection date (for daily view)
    if ($request->has('fecha_cobro')) {
        // Try to parse the date and handle any format issues
        try {
            $date = Carbon::parse($request->fecha_cobro)->toDateString();
            $query->whereDate('fecha_de_cobro', $date);
        } catch (\Exception $e) {
            // If parsing fails, try the raw value
            $query->whereDate('fecha_de_cobro', $request->fecha_cobro);
        }
    }

    // Order by month descending, then by creation date
    $pagos = $query->orderBy('mes', 'desc')
                   ->orderBy('created_at', 'desc')
                   ->get();

    return response()->json($pagos);
}

*/}
