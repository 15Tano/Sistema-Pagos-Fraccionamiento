<?php

namespace App\Http\Controllers;

use App\Models\Pago;
use App\Models\Vecino;
use App\Services\ZkAccessService; // Importante: Tu servicio nuevo
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log; // Importante: Para que funcionen los logs

class PagoController extends Controller
{
    // Constante para la mensualidad para fácil mantenimiento
    private const MENSUALIDAD = 280;

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
        
        $affectedMonths = []; 

        while ($remainingAmount > 0) {
            $mesString = $currentMonth->format('Y-m');
            $affectedMonths[] = $mesString; 

            $totalPagadoMes = Pago::where('vecino_id', $vecino->id)
                ->where('mes', $mesString)
                ->sum('cantidad');

            $neededForMonth = max(0, self::MENSUALIDAD - $totalPagadoMes);
            
            if ($neededForMonth <= 0) {
                 $currentMonth->addMonth();
                 continue;
            }

            $amountForThisMonth = min($remainingAmount, $neededForMonth);

            if ($amountForThisMonth > 0) {
                $existingPago = Pago::where('vecino_id', $vecino->id)
                    ->where('mes', $mesString)
                    ->where('tipo', $request->tipo)
                    ->first();

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
        // SINCRONIZACIÓN CON ZKTECO (PLUMA)
        // =========================================================================
        // Solo necesitamos sincronizar una vez por transacción, ya que el cálculo 
        // revisa todo el historial del vecino, no solo el mes actual.
        $this->syncVecinoTagStatusForMonth($vecino->id, null);

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
        
        // Sincronizar ZKTeco
        $this->syncVecinoTagStatusForMonth($pago->vecino_id, null);
        if ($oldVecinoId !== $pago->vecino_id) {
             $this->syncVecinoTagStatusForMonth($oldVecinoId, null);
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
        
        // Sincronizar ZKTeco (se recalcula la fecha de expiración tras borrar el pago)
        $this->syncVecinoTagStatusForMonth($vecino_id, null);

        return response()->json(['message' => 'Pago eliminado.']);
    }

    private function recalculateRestanteForMonth($mes, $vecino_id)
    {
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

    // ==========================================
    // NUEVA LÓGICA PARA ZKTECO
    // ==========================================

    /**
     * Calcula la fecha de expiración. 
     * El ": \Carbon\Carbon" al final le asegura al editor que siempre devolveremos una fecha.
     */
    private function calculateExpirationDate($vecino_id): \Carbon\Carbon 
    {
        // Busca meses pagados completos
        $pagosCompletos = Pago::where('vecino_id', $vecino_id)
            ->selectRaw('mes, SUM(cantidad) as total')
            ->groupBy('mes')
            ->having('total', '>=', self::MENSUALIDAD)
            ->pluck('mes')->toArray();

        $currentDate = Carbon::now()->startOfMonth();
        $expirationDate = Carbon::now()->subDay()->endOfDay(); // Vencido por defecto

        // Revisa continuidad de pagos los próximos 12 meses
        for ($i = 0; $i < 12; $i++) {
            if (in_array($currentDate->format('Y-m'), $pagosCompletos)) {
                $expirationDate = $currentDate->copy()->endOfMonth()->endOfDay();
            } else {
                break; // Si hay un hueco, cortamos el acceso
            }
            $currentDate->addMonth();
        }
        return $expirationDate;
    }

    private function syncVecinoTagStatusForMonth($vecino_id, $mes)
    {
        $vecino = Vecino::with('tags')->find($vecino_id);
        
        if (!$vecino || $vecino->tags->isEmpty()) return;

        // 1. Calcular fecha (Ahora esto funciona perfecto con el type hinting de arriba)
        $newExpirationDate = $this->calculateExpirationDate($vecino_id);

        // 2. Llamar al servicio ZK
        $zkService = new ZkAccessService();

        foreach ($vecino->tags as $tag) {
            // OJO: Cambia 'codigo_tag' por el nombre real de tu columna en la BD si es diferente (ej: 'uid', 'folio')
            if (!empty($tag->codigo)) { 
                $zkService->updateTagExpiration($tag->codigo, $newExpirationDate);
            }
        }
    }

    public function getHistorico(Request $request)
    {
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

        if ($request->has('mes_cobro')) {
            $collectionMonth = $request->mes_cobro;
            $query->whereYear('fecha_de_cobro', substr($collectionMonth, 0, 4))
                  ->whereMonth('fecha_de_cobro', substr($collectionMonth, 5, 2));
        }

        $pagos = $query->orderBy('mes', 'desc')
                           ->orderBy('created_at', 'desc')
                           ->get();

        return response()->json($pagos);
    }
}