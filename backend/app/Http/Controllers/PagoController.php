<?php

namespace App\Http\Controllers;

use App\Models\Pago;
use App\Models\Vecino;
use App\Services\ZkAccessService;
use Illuminate\Http\Request;
use Carbon\Carbon;

class PagoController extends Controller
{
    const RECARGO_EXTRA = 50;

    // ─────────────────────────────────────────
    // INDEX
    // ─────────────────────────────────────────
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 20);
        $query   = Pago::with([
            'vecino:id,uuid,nombre,calle,numero_casa'
        ])->latest();

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

        if ($request->filled('month') && $request->filled('year')) {
            $query->whereYear('fecha_de_cobro', $request->year)
                  ->whereMonth('fecha_de_cobro', $request->month);
        } elseif ($request->filled('year')) {
            $query->whereYear('fecha_de_cobro', $request->year);
        }

        if ($request->filled('calle')) {
            $query->whereHas('vecino', fn($q) => $q->where('calle', $request->calle));
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
    // STORE (La lógica corregida)
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

        $vecino     = Vecino::where('uuid', $request->vecino_uuid)->firstOrFail();
        
        $cuota      = (int) $request->cuota_base;
        $recargo    = $request->tipo === 'extraordinario' ? self::RECARGO_EXTRA : 0;
        $porMes     = $cuota + $recargo;
        
        $fechaCobro = $request->fecha_de_cobro ?: Carbon::now()->toDateString();
        $mesActual  = Carbon::parse($request->mes)->startOfMonth();
        
        $mesesRegistrados = 0;
        $maxIteraciones   = 36; // Límite de seguridad
        $iteracion        = 0;

        while ($mesesRegistrados < (int) $request->meses_pagados && $iteracion < $maxIteraciones) {
            $iteracion++;
            $mesString = $mesActual->format('Y-m');

            // LA CLAVE: Si existe el mes para este vecino, lo saltamos sin importar la cantidad.
            $yaPagado = Pago::where('vecino_id', $vecino->id)
                ->where('mes', $mesString)
                ->exists();

            if ($yaPagado) {
                $mesActual->addMonth();
                continue; 
            }

            // Si llegamos aquí, el mes está libre.
            Pago::create([
                'vecino_id'      => $vecino->id,
                'cantidad'       => $porMes,
                'mes'            => $mesString,
                'tipo'           => $request->tipo,
                'fecha_de_cobro' => $fechaCobro,
                'meses_pagados'  => 1, // Esto arregla el error de tu captura (cada fila es 1 mes)
            ]);

            $mesesRegistrados++;
            $mesActual->addMonth();
        }

        $this->syncVecinoTagStatusForMonth($vecino->id, null);

        return response()->json([
            'message'           => 'Pago registrado correctamente.',
            'meses_registrados' => $mesesRegistrados,
        ], 201);
    }

    // ─────────────────────────────────────────
    // UPDATE
    // ─────────────────────────────────────────
    public function update(Request $request, Pago $pago)
    {
        $request->validate([
            'cuota_base'     => 'required|in:280,300,500',
            'mes'            => 'required|string',
            'tipo'           => 'required|in:ordinario,extraordinario',
            'fecha_de_cobro' => 'nullable|date',
        ]);

        $cuota    = (int) $request->cuota_base;
        $recargo  = $request->tipo === 'extraordinario' ? self::RECARGO_EXTRA : 0;
        $porMes   = $cuota + $recargo;

        $oldVecinoId = $pago->vecino_id;

        $pago->update([
            'cantidad'       => $porMes,
            'mes'            => $request->mes,
            'tipo'           => $request->tipo,
            'fecha_de_cobro' => $request->fecha_de_cobro,
            'meses_pagados'  => 1, 
        ]);

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
    // DESTROY
    // ─────────────────────────────────────────
    public function destroy(Pago $pago)
    {
        $vecino_id = $pago->vecino_id;
        $pago->delete();

        $this->syncVecinoTagStatusForMonth($vecino_id, null);

        return response()->json(['message' => 'Pago eliminado.']);
    }

    // ─────────────────────────────────────────
    // HISTÓRICO
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
            $query->where('vecino_id', $request->vecino_id);
        }

        if ($request->filled('adelantados') && $request->adelantados == 'true') {
            $query->where('mes', '>', Carbon::now()->format('Y-m'));
        }

        if ($request->filled('calle')) {
            $query->whereHas('vecino', fn($q) => $q->where('calle', $request->calle));
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
    // ESTADO MESES
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
                'pagado' => $totalPagado > 0, // Si tiene más de $0, está pagado. Simple.
                'monto'  => (float) $totalPagado,
            ];
        }

        return response()->json([
            'meses' => $meses,
            'tags'  => $vecino->tags,
        ]);
    }

    // ─────────────────────────────────────────
    // MIS PAGOS
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

    public function show($id)
    {
        return response()->json(Pago::with('vecino')->findOrFail($id));
    }

    // ─────────────────────────────────────────
    // ZKTECO LÓGICA (Simplificada)
    // ─────────────────────────────────────────
    private function calculateExpirationDate($vecino_id): Carbon
    {
        // Traemos los meses que este vecino tiene registrados
        $pagosCompletos = Pago::where('vecino_id', $vecino_id)
            ->distinct()
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