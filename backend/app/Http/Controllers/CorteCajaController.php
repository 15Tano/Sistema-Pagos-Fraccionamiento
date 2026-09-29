<?php

namespace App\Http\Controllers;

use App\Models\CorteCaja;
use App\Models\Pago;
use App\Models\TagSale;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CorteCajaController extends Controller
{
    protected const MONTO_CUOTA_ORDINARIA = 280;

    // ─────────────────────────────────────────
    // HOY — estado actual del corte
    // ─────────────────────────────────────────
    public function hoy()
    {
        $hoy = Carbon::now('America/Mexico_City')->toDateString();
        $corte = CorteCaja::where('fecha', $hoy)->first();

        if (!$corte) {
            return response()->json(['existe' => false]);
        }

        return response()->json([
            'existe'    => true,
            'corte'     => $corte,
            'desglose'  => $this->desgloseDelDia($corte->fecha),
        ]);
    }

    // ─────────────────────────────────────────
    // INTENTAR
    // ─────────────────────────────────────────
    public function intentar(Request $request)
    {
        $request->validate([
            'monto_declarado' => 'required|numeric|min:0',
        ]);

        $hoy   = Carbon::now('America/Mexico_City')->toDateString();
        $corte = CorteCaja::where('fecha', $hoy)->firstOrFail();

        if ($corte->estado !== 'en_proceso') {
            return response()->json(['message' => 'Este corte ya fue cerrado.'], 409);
        }

        $montoSistema = $this->montoSistemaDelDia($corte->fecha);
        $declarado    = (float) $request->monto_declarado;
        $diferencia   = round($declarado - $montoSistema, 2);

        $intentos   = $corte->intentos ?? [];
        $numero     = count($intentos) + 1;
        $intentos[] = [
            'numero'     => $numero,
            'declarado'  => $declarado,
            'diferencia' => $diferencia,
            'at'         => now()->toIso8601String(),
        ];

        $corte->intentos = $intentos;
        $corte->save();

        return response()->json([
            'coincide'                    => $diferencia === 0.0,
            'numero_intento'              => $numero,
            'diferencia'                  => $diferencia,
            'monto_sistema'               => $montoSistema,
            'desglose'                    => $this->desgloseDelDia($corte->fecha),
            'puede_cerrar_con_diferencia' => $numero >= 3 && $diferencia !== 0.0,
        ]);
    }

    // ─────────────────────────────────────────
    // CERRAR
    // ─────────────────────────────────────────
    public function cerrar(Request $request)
    {
        $request->validate([
            'firma' => 'required|string|max:255',
        ]);

        $hoy   = Carbon::now('America/Mexico_City')->toDateString();
        $corte = CorteCaja::where('fecha', $hoy)->firstOrFail();

        if ($corte->estado !== 'en_proceso') {
            return response()->json(['message' => 'Este corte ya fue cerrado.'], 409);
        }

        $ultimoIntento = collect($corte->intentos ?? [])->last();

        if (!$ultimoIntento || $ultimoIntento['diferencia'] !== 0) {
            return response()->json(['message' => 'El último intento no coincide, no se puede cerrar.'], 422);
        }

        $corte->update([
            'estado'           => 'cuadrado',
            'monto_sistema'    => $ultimoIntento['declarado'],
            'firma_capturista' => $request->firma,
            'cerrado_at'       => now(),
        ]);

        return response()->json([
            'corte'    => $corte,
            'desglose' => $this->desgloseDelDia($corte->fecha),
        ]);
    }

    // ─────────────────────────────────────────
    // CERRAR CON DIFERENCIA
    // ─────────────────────────────────────────
    public function cerrarConDiferencia(Request $request)
    {
        $request->validate([
            'firma' => 'required|string|max:255',
        ]);

        $hoy   = Carbon::now('America/Mexico_City')->toDateString();
        $corte = CorteCaja::where('fecha', $hoy)->firstOrFail();

        if ($corte->estado !== 'en_proceso') {
            return response()->json(['message' => 'Este corte ya fue cerrado.'], 409);
        }

        $intentos = $corte->intentos ?? [];

        if (count($intentos) < 3) {
            return response()->json(['message' => 'Aún no se alcanzan los 3 intentos requeridos.'], 422);
        }

        $corte->update([
            'estado'            => 'cerrado_con_diferencia',
            'monto_sistema'     => $this->montoSistemaDelDia($corte->fecha),
            'firma_capturista'  => $request->firma,
            'cerrado_at'        => now(),
        ]);

        return response()->json([
            'corte'    => $corte,
            'desglose' => $this->desgloseDelDia($corte->fecha),
        ]);
    }

        // ─────────────────────────────────────────
    // Guard — solo la cuenta admin
    // ─────────────────────────────────────────
    protected function soloAdmin(Request $request): void
    {
        abort_if(
            $request->user()->role !== 'admin',
            403,
            'Solo el administrador puede consultar los cortes.'
        );
    }

    // ─────────────────────────────────────────
    // INDEX — historial paginado (admin)
    // ─────────────────────────────────────────
    public function index(Request $request)
    {
        $this->soloAdmin($request);

        $request->validate([
            'desde'  => 'nullable|date',
            'hasta'  => 'nullable|date',
            'estado' => 'nullable|in:en_proceso,cuadrado,cerrado_con_diferencia',
            'firma'  => 'nullable|string|max:255',
        ]);

        $cortes = CorteCaja::query()
            ->when($request->desde,  fn ($q, $v) => $q->whereDate('fecha', '>=', $v))
            ->when($request->hasta,  fn ($q, $v) => $q->whereDate('fecha', '<=', $v))
            ->when($request->estado, fn ($q, $v) => $q->where('estado', $v))
            ->when($request->firma,  fn ($q, $v) => $q->where('firma_capturista', 'like', "%{$v}%"))
            ->orderByDesc('fecha')
            ->paginate(15);

        $cortes->getCollection()->transform(fn ($c) => [
            'id'               => $c->id,
            'uuid'             => $c->uuid,
            'fecha'            => $c->fecha,
            'estado'           => $c->estado,
            'monto_sistema'    => $c->monto_sistema,
            'firma_capturista' => $c->firma_capturista,
            'cerrado_at'       => $c->cerrado_at,
            'reabierto_at'     => $c->reabierto_at,
            'intentos_count'   => count($c->intentos ?? []),
        ]);

        return response()->json($cortes);
    }

        // ─────────────────────────────────────────
    // SHOW — detalle de un corte (admin)
    // ─────────────────────────────────────────
    public function show(Request $request, CorteCaja $corte)
    {
        $this->soloAdmin($request);

        return response()->json([
            'corte'    => $corte,
            'desglose' => $this->desgloseDelDia($corte->fecha->toDateString()),
        ]);
    }

        // ─────────────────────────────────────────
    // REABRIR — desbloquea al capturista, una sola vez (admin)
    // ─────────────────────────────────────────
    public function reabrir(Request $request, CorteCaja $corte)
    {
        $this->soloAdmin($request);

        $request->validate([
            'motivo' => 'nullable|string|max:500',
        ]);

        $hoy = Carbon::now('America/Mexico_City')->toDateString();

        if ($corte->fecha->toDateString() !== $hoy) {
            return response()->json(['message' => 'Solo se puede reabrir el corte de hoy.'], 422);
        }

        if ($corte->estado === 'en_proceso') {
            return response()->json(['message' => 'Este corte no está cerrado.'], 409);
        }

        if ($corte->reabierto_at !== null) {
            return response()->json(['message' => 'Este corte ya fue reabierto una vez.'], 409);
        }

        $corte->update([
            'reabierto_at'      => now(),
            'reabierto_por'     => $request->user()->name,
            'motivo_reapertura' => $request->motivo,
        ]);

        return response()->json([
            'corte'    => $corte->fresh(),
            'desglose' => $this->desgloseDelDia($corte->fecha->toDateString()),
        ]);
    }

    // ─────────────────────────────────────────
    // Total real de efectivo del día (pagos + venta de tags)
    // ─────────────────────────────────────────
    protected function montoSistemaDelDia(string $fecha): float
    {
        $pagos = (float) Pago::whereDate('fecha_de_cobro', $fecha)->sum('cantidad');
        $tags  = (float) TagSale::whereDate('sold_at', $fecha)->sum('price');

        return round($pagos + $tags, 2);
    }

    // ─────────────────────────────────────────
    // Desglose — mismo shape que espera DesgloseFinanciero
    // ─────────────────────────────────────────
    protected function desgloseDelDia(string $fecha): array
    {
        $pagosDelDia = Pago::whereDate('fecha_de_cobro', $fecha)->get();
        $tagsDelDia  = TagSale::whereDate('sold_at', $fecha)->get();

        $ordinarios = $pagosDelDia->where('tipo', 'ordinario');

        $ordinario      = (float) $ordinarios->where('cantidad', self::MONTO_CUOTA_ORDINARIA)->sum('cantidad');
        $especiales     = (float) $ordinarios->where('cantidad', '!=', self::MONTO_CUOTA_ORDINARIA)->sum('cantidad');
        $extraordinario = (float) $pagosDelDia->where('tipo', 'extraordinario')->sum('cantidad');
        $ventasTags     = (float) $tagsDelDia->sum('price');

        return [
            'ordinario'      => $ordinario,
            'especiales'     => $especiales,
            'extraordinario' => $extraordinario,
            'ventasTags'     => $ventasTags,
            'tagsCount'      => $tagsDelDia->count(),
            'total'          => round($ordinario + $especiales + $extraordinario + $ventasTags, 2),
            'cantidad_pagos' => $pagosDelDia->count(),
        ];
    }

    // ─────────────────────────────────────────
// PLAZAS DEL DÍA — pagos agrupados por calle, para revisión cruzada
// contra la hoja física de conteo
// ─────────────────────────────────────────
public function plazasDelDia()
{
    $hoy = Carbon::now('America/Mexico_City')->toDateString();

    $pagos = Pago::whereDate('fecha_de_cobro', $hoy)
        ->with('vecino:id,nombre,calle')
        ->get();

    $plazas = $pagos
        ->groupBy(fn ($pago) => $pago->vecino->calle ?? 'Sin calle')
        ->map(function ($pagosDeLaCalle, $calle) {
            return [
                'calle'          => $calle,
                'subtotal'       => round($pagosDeLaCalle->sum('cantidad'), 2),
                'cantidad_pagos' => $pagosDeLaCalle->count(),
                'pagos'          => $pagosDeLaCalle->map(fn ($p) => [
                    'id'       => $p->id,
                    'vecino'   => $p->vecino->nombre ?? 'Desconocido',
                    'cantidad' => (float) $p->cantidad,
                    'tipo'     => $p->tipo,
                ])->values(),
            ];
        })
        ->sortBy('calle')
        ->values();

    $tagsDelDia = TagSale::whereDate('sold_at', $hoy)->get();

    return response()->json([
        'plazas'      => $plazas,
        'ventas_tags' => [
            'total'    => round((float) $tagsDelDia->sum('price'), 2),
            'cantidad' => $tagsDelDia->count(),
        ],
    ]);
}   
}
