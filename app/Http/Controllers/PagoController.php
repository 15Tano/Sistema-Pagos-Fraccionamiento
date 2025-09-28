<?php

namespace App\Http\Controllers;

use App\Models\Pago;
use App\Models\Vecino;
use Illuminate\Http\Request;
use Carbon\Carbon;

class PagoController extends Controller
{
    // Constante para la mensualidad para fácil mantenimiento
    private const MENSUALIDAD = 280;

    public function index(Request $request)
    {
        // ... (Este método no necesita cambios)
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
            'vecino_id' => 'required|exists:vecinos,id',
            'cantidad' => 'required|numeric|min:1',
            'tipo' => 'required|in:ordinario,extraordinario',
            'mes' => 'required',
            'fecha_de_cobro' => 'nullable|date',
        ]);

        $vecino = Vecino::findOrFail($request->vecino_id);
        $cantidadTotal = $request->cantidad;
        $mesInicial = Carbon::parse($request->mes)->startOfMonth();
        $remainingAmount = $cantidadTotal;
        $currentMonth = $mesInicial->copy();
        
        $affectedMonths = []; // Guardaremos los meses afectados

        while ($remainingAmount > 0) {
            $mesString = $currentMonth->format('Y-m');
            $affectedMonths[] = $mesString; // Agregamos el mes a la lista de afectados

            $totalPagadoMes = Pago::where('vecino_id', $vecino->id)
                ->where('mes', $mesString)
                ->sum('cantidad');

            $neededForMonth = max(0, self::MENSUALIDAD - $totalPagadoMes);
            
            // Si no se necesita nada para este mes (ya está pagado), pasamos al siguiente
            if ($neededForMonth <= 0) {
                 $currentMonth->addMonth();
                 continue;
            }

            $amountForThisMonth = min($remainingAmount, $neededForMonth);

            if ($amountForThisMonth > 0) {
                // ... (lógica de creación/actualización de pago sin cambios) ...
                $existingPago = Pago::where('vecino_id', $vecino->id)->where('mes', $mesString)->where('tipo', $request->tipo)->first();

                if ($existingPago) {
                    $existingPago->cantidad += $amountForThisMonth;
                    $existingPago->save();
                } else {
                    $restante = max(0, self::MENSUALIDAD - $totalPagadoMes - $amountForThisMonth);
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

            $currentMonth->addMonth();
        }

        // =========================================================================
        // LÓGICA MODIFICADA
        // =========================================================================
        // Ahora, recalculamos el estado de los tags para cada mes que fue afectado por el pago.
        foreach (array_unique($affectedMonths) as $mes) {
            $this->recalculateRestanteForMonth($mes, $vecino->id);
            $this->syncVecinoTagStatusForMonth($vecino->id, $mes);
        }

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

        $pago->update($request->all());

        // Recalcular saldos
        $this->recalculateRestanteForMonth($pago->mes, $pago->vecino_id);
        if ($oldMes !== $pago->mes || $oldVecinoId !== $pago->vecino_id) {
            $this->recalculateRestanteForMonth($oldMes, $oldVecinoId);
        }
        
        // =========================================================================
        // LÓGICA MODIFICADA
        // =========================================================================
        // Sincronizar estado de tags para el mes nuevo y el viejo (si cambiaron)
        $this->syncVecinoTagStatusForMonth($pago->vecino_id, $pago->mes);
        if ($oldMes !== $pago->mes || $oldVecinoId !== $pago->vecino_id) {
             $this->syncVecinoTagStatusForMonth($oldVecinoId, $oldMes);
        }

        return response()->json(['message' => 'Pago actualizado.', 'pago' => $pago]);
    }

    public function destroy($id)
    {
        $pago = Pago::findOrFail($id);
        $mes = $pago->mes;
        $vecino_id = $pago->vecino_id;
        $pago->delete();

        // Recalcular saldo del mes afectado
        $this->recalculateRestanteForMonth($mes, $vecino_id);
        
        // =========================================================================
        // LÓGICA MODIFICADA
        // =========================================================================
        // Sincronizar estado de tags para el mes afectado
        $this->syncVecinoTagStatusForMonth($vecino_id, $mes);

        return response()->json(['message' => 'Pago eliminado.']);
    }

    private function recalculateRestanteForMonth($mes, $vecino_id)
    {
        // ... (Este método no necesita cambios)
        $pagos = Pago::where('vecino_id', $vecino_id)
            ->where('mes', $mes)
            ->orderBy('fecha_de_cobro')
            ->orderBy('id')
            ->get();
        $cumulative = 0;
        foreach ($pagos as $p) {
            $cumulative += $p->cantidad;
            $p->restante = max(0, self::MENSUALIDAD - $cumulative);
            $p->save();
        }
    }

    /**
     * =========================================================================
     * NUEVO MÉTODO CENTRALIZADO
     * =========================================================================
     * Calcula si un vecino ha pagado la mensualidad completa para un mes
     * y actualiza el estado 'activo' de TODOS sus tags a la vez.
     *
     * @param int $vecino_id
     * @param string $mes (Formato 'Y-m')
     * @return void
     */
    private function syncVecinoTagStatusForMonth($vecino_id, $mes)
    {
        $vecino = Vecino::find($vecino_id);
        
        // Si el vecino no existe o no tiene tags, no hacemos nada.
        if (!$vecino || !$vecino->tags()->exists()) {
            return;
        }

        // 1. Calculamos el total pagado por el vecino en el mes dado.
        $totalPagadoMes = $vecino->pagos()->where('mes', $mes)->sum('cantidad');
        
        // 2. Determinamos si el pago está completo.
        $pagoCompleto = $totalPagadoMes >= self::MENSUALIDAD;

        // 3. Actualizamos TODOS los tags del vecino con el nuevo estado en una sola consulta.
        $vecino->tags()->update(['activo' => $pagoCompleto]);
    }

    public function getHistorico(Request $request)
    {
        // ... (Este método no necesita cambios)
        $query = Pago::with(['vecino.tags']);

        if ($request->has('mes')) {
            $query->where('mes', $request->mes);
        }
        if ($request->has('vecino_id')) {
            $query->where('vecino_id', $request->vecino_id);
        }
        if ($request->has('adelantados') && $request->adelantados == 'true') {
            $currentMonth = Carbon::now()->format('Y-m');
            $query->where('mes', '>', $currentMonth);
        }
        if ($request->has('calle')) {
            $query->whereHas('vecino', function($q) use ($request) {
                $q->where('calle', $request->calle);
            });
        }
        if ($request->has('tipo')) {
            $query->where('tipo', $request->tipo);
        }
        if ($request->has('fecha_cobro')) {
            $query->whereDate('fecha_de_cobro', $request->fecha_cobro);
        }

        $pagos = $query->orderBy('mes', 'desc')
                      ->orderBy('created_at', 'desc')
                      ->get();

        return response()->json($pagos);
    }
}
