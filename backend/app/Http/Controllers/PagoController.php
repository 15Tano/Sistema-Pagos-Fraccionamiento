<?php

namespace App\Http\Controllers;

use App\Models\Pago;
use App\Models\Vecino;
use App\Services\ZkAccessService;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class PagoController extends Controller
{
    private const MENSUALIDAD = 280;

    // ─────────────────────────────────────────
    // INDEX — con paginación y filtros
    // ─────────────────────────────────────────
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 20);
        $query   = Pago::with([
            'vecino:id,uuid,nombre,calle,numero_casa'
        ])->latest();

        // Filtro por búsqueda de vecino (nombre, calle, número)
        if ($request->filled('search')) {
            $query->whereHas('vecino', function ($q) use ($request) {
                $terms = explode(' ', trim($request->search));
                foreach ($terms as $term) {
                    $q->where(function ($inner) use ($term) {
                        $inner->where('nombre', 'like', "%{$term}%")
                              ->orWhere('calle', 'like', "%{$term}%")
                              ->orWhere('numero_casa', 'like', "%{$term}%");
                    });
                }
            });
        }

        // Filtros originales preservados
        if ($request->filled('month') && $request->filled('year')) {
            $query->whereYear('fecha_de_cobro', $request->year)
                  ->whereMonth('fecha_de_cobro', $request->month);
        } elseif ($request->filled('year')) {
            $query->whereYear('fecha_de_cobro', $request->year);
        }

        if ($request->filled('calle')) {
            $query->whereHas('vecino', fn($q) =>
                $q->where('calle', $request->calle)
            );
        }

        if ($request->filled('tipo')) {
            $query->where('tipo', $request->tipo);
        }

        if ($request->filled('fecha_cobro')) {
            $query->whereDate('fecha_de_cobro', $request->fecha_cobro);
        }

        return response()->json($query->paginate($perPage));
    }

    // ─────────────────────────────────────────
    // STORE — acepta vecino_uuid
    // ─────────────────────────────────────────
    public function store(Request $request)
    {
        $request->validate([
            'vecino_uuid'    => 'required|exists:vecinos,uuid',
            'cuota_base'     => 'required|in:280,300,500',
            'meses_pagados'  => 'required|integer|min:1|max:12',
            'mes'            => 'required|string',
            'tipo'           => 'required|in:ordinario,extraordinario',
            'fecha_de_cobro' => 'nullable|date',
        ]);

        $vecino      = Vecino::where('uuid', $request->vecino_uuid)->firstOrFail();
        $cuota       = (int) $request->cuota_base;
        $recargo     = $request->tipo === 'extraordinario' ? 50 : 0;
        $porMes      = $cuota + $recargo;
        $cantidadTotal = $porMes * (int) $request->meses_pagados;

        $mesInicial      = Carbon::parse($request->mes)->startOfMonth();
        $remainingAmount = $cantidadTotal;
        $currentMonth    = $mesInicial->copy();

        while ($remainingAmount > 0) {
            $mesString = $currentMonth->format('Y-m');

            $totalPagadoMes = Pago::where('vecino_id', $vecino->id)
                ->where('mes', $mesString)
                ->sum('cantidad');

            $neededForMonth = max(0, $porMes - $totalPagadoMes);

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
                    $restante = max(0, $porMes - $totalPagadoMes - $amountForThisMonth);
                    Pago::create([
                        'vecino_id'      => $vecino->id,
                        'cantidad'       => $amountForThisMonth,
                        'mes'            => $mesString,
                        'tipo'           => $request->tipo,
                        'restante'       => $restante,
                        'fecha_de_cobro' => $request->fecha_de_cobro
                            ?: Carbon::now()->toDateString(),
                        'meses_pagados'  => (int) $request->meses_pagados,
                    ]);
                }
                $remainingAmount -= $amountForThisMonth;
            }

            $currentMonth->addMonth();
        }

        // Sincronizar ZKTeco
        $this->syncVecinoTagStatusForMonth($vecino->id, null);

        return response()->json([
            'message' => 'Pago registrado correctamente.',
        ], 201);
    }

    // ─────────────────────────────────────────
    // UPDATE — por UUID del pago
    // ─────────────────────────────────────────
    public function update(Request $request, Pago $pago)
    {
        $request->validate([
            'cuota_base'     => 'required|in:280,300,500',
            'meses_pagados'  => 'required|integer|min:1|max:12',
            'mes'            => 'required|string',
            'tipo'           => 'required|in:ordinario,extraordinario',
            'fecha_de_cobro' => 'nullable|date',
        ]);

        $cuota    = (int) $request->cuota_base;
        $recargo  = $request->tipo === 'extraordinario' ? 50 : 0;
        $cantidad = ($cuota + $recargo) * (int) $request->meses_pagados;

        $oldMes      = $pago->mes;
        $oldVecinoId = $pago->vecino_id;

        $pago->update([
            'cantidad'       => $cantidad,
            'mes'            => $request->mes,
            'tipo'           => $request->tipo,
            'fecha_de_cobro' => $request->fecha_de_cobro,
            'meses_pagados'  => (int) $request->meses_pagados,
        ]);

        $this->recalculateRestanteForMonth($pago->mes, $pago->vecino_id);
        if ($oldMes !== $pago->mes || $oldVecinoId !== $pago->vecino_id) {
            $this->recalculateRestanteForMonth($oldMes, $oldVecinoId);
        }

        $this->syncVecinoTagStatusForMonth($pago->vecino_id, null);
        if ($oldVecinoId !== $pago->vecino_id) {
            $this->syncVecinoTagStatusForMonth($oldVecinoId, null);
        }

        return response()->json([
            'message' => 'Pago actualizado.',
            'pago'    => $pago->load('vecino:id,uuid,nombre,calle,numero_casa'),
        ]);
    }

    // ─────────────────────────────────────────
    // DESTROY — por UUID del pago
    // ─────────────────────────────────────────
    public function destroy(Pago $pago)
    {
        $mes       = $pago->mes;
        $vecino_id = $pago->vecino_id;
        $pago->delete();

        $this->recalculateRestanteForMonth($mes, $vecino_id);
        $this->syncVecinoTagStatusForMonth($vecino_id, null);

        return response()->json(['message' => 'Pago eliminado.']);
    }

    // ─────────────────────────────────────────
    // HISTÓRICO — filtros completos preservados
    // ─────────────────────────────────────────
    public function getHistorico(Request $request)
    {
        $query = Pago::with(['vecino.tags']);

        if ($request->filled('mes')) {
            $query->where('mes', $request->mes);
        }

        if ($request->filled('vecino_uuid')) {
            $vecino = Vecino::where('uuid', $request->vecino_uuid)->firstOrFail();
            $query->where('vecino_id', $vecino->id);
        } elseif ($request->filled('vecino_id')) {
            // Compatibilidad con el código viejo
            $query->where('vecino_id', $request->vecino_id);
        }

        if ($request->filled('adelantados') && $request->adelantados == 'true') {
            $query->where('mes', '>', Carbon::now()->format('Y-m'));
        }

        if ($request->filled('calle')) {
            $query->whereHas('vecino', fn($q) =>
                $q->where('calle', $request->calle)
            );
        }

        if ($request->filled('tipo')) {
            $query->where('tipo', $request->tipo);
        }

        if ($request->filled('fecha_cobro')) {
            $query->whereDate('fecha_de_cobro', $request->fecha_cobro);
        }

        if ($request->filled('mes_cobro')) {
            $query->whereYear('fecha_de_cobro', substr($request->mes_cobro, 0, 4))
                  ->whereMonth('fecha_de_cobro', substr($request->mes_cobro, 5, 2));
        }

        return response()->json(
            $query->orderByDesc('mes')
                  ->orderByDesc('created_at')
                  ->paginate($request->get('per_page', 50))
        );
    }

    // ─────────────────────────────────────────
    // ESTADO MESES — para fila expandible
    // ─────────────────────────────────────────
    public function estadoMeses(string $vecinoUuid)
    {
        $vecino = Vecino::where('uuid', $vecinoUuid)
            ->with(['tags:id,codigo,activo'])
            ->firstOrFail();

        $meses = [];
        for ($i = 2; $i >= 0; $i--) {
            $fecha  = now()->subMonths($i);
            $mesKey = $fecha->format('Y-m');

            $totalPagado = Pago::where('vecino_id', $vecino->id)
                ->where('mes', 'like', "{$mesKey}%")
                ->sum('cantidad');

            $meses[] = [
                'mes'    => $mesKey,
                'label'  => ucfirst($fecha->locale('es')->isoFormat('MMMM YYYY')),
                'pagado' => $totalPagado >= self::MENSUALIDAD,
                'monto'  => (float) $totalPagado,
            ];
        }

        return response()->json([
            'meses' => $meses,
            'tags'  => $vecino->tags,
        ]);
    }

    // ─────────────────────────────────────────
    // MIS PAGOS — solo para residentes
    // ─────────────────────────────────────────
    public function misPagos(Request $request)
    {
        $vecino = Vecino::where('user_id', $request->user()->id)->firstOrFail();

        return response()->json(
            Pago::where('vecino_id', $vecino->id)
                ->orderByDesc('mes')
                ->paginate(12)
        );
    }

    // ─────────────────────────────────────────
    // SHOW
    // ─────────────────────────────────────────
    public function show($id)
    {
        return response()->json(
            Pago::with('vecino')->findOrFail($id)
        );
    }

    // ─────────────────────────────────────────
    // HELPERS PRIVADOS — sin cambios
    // ─────────────────────────────────────────
    private function recalculateRestanteForMonth($mes, $vecino_id): void
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

    private function calculateExpirationDate($vecino_id): Carbon
    {
        $pagosCompletos = Pago::where('vecino_id', $vecino_id)
            ->selectRaw('mes, SUM(cantidad) as total')
            ->groupBy('mes')
            ->having('total', '>=', self::MENSUALIDAD)
            ->pluck('mes')
            ->toArray();

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

    private function syncVecinoTagStatusForMonth($vecino_id, $mes): void
    {
        $vecino = Vecino::with('tags')->find($vecino_id);
        if (!$vecino || $vecino->tags->isEmpty()) return;

        $newExpirationDate = $this->calculateExpirationDate($vecino_id);
        $zkService         = new ZkAccessService();

        foreach ($vecino->tags as $tag) {
            if (!empty($tag->codigo)) {
                $zkService->updateTagExpiration($tag->codigo, $newExpirationDate);
            }
        }
    }
}