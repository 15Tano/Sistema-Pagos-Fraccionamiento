<?php
namespace App\Http\Controllers;
use Illuminate\Support\Facades\DB;
use App\Models\Vecino;
use App\Models\Tag;
class DashboardController extends Controller
{
    public function stats()
    {
        $mesActual = now()->format('Y-m');
        // ── 1. FLUJO DE CAJA REAL (El dinero que cuadra con tu Histórico) ──
        // Sumamos TODO el dinero que entró físicamente este mes (Atrasos, Actuales, Adelantos y Tags)
        $ingresosPagos = DB::table('pagos')
            ->whereMonth(DB::raw('COALESCE(fecha_de_cobro, created_at)'), now()->month)
            ->whereYear(DB::raw('COALESCE(fecha_de_cobro, created_at)'), now()->year)
            ->sum('cantidad');
        $ingresosTags = DB::table('tag_sales')
            ->whereMonth(DB::raw('COALESCE(sold_at, created_at)'), now()->month)
            ->whereYear(DB::raw('COALESCE(sold_at, created_at)'), now()->year)
            ->sum('price');
        $totalRecaudado = $ingresosPagos + $ingresosTags;
        // ── 2. ESTADO DE CUENTA (Vecinos que ya cubrieron la cuota del mes) ──
        $vecinosPagaron = DB::table('pagos')
            ->where('mes', $mesActual)
            ->distinct()
            ->pluck('vecino_id');
        // ── Total vecinos ──
        $totalVecinos = Vecino::count();
        // ── Morosos: vecinos con al menos un tag vendido que no pagaron el mes actual ──
        $morosos = Vecino::with(['tags' => fn($q) => $q->whereHas('tagSale')])
            ->whereHas('tags', fn($q) => $q->whereHas('tagSale'))
            ->whereNotIn('id', $vecinosPagaron)
            ->select('id', 'nombre', 'calle', 'numero_casa')
            ->orderBy('calle')
            ->get();
        // ── Tags vendidos y stock ──
        $tagsVendidos = DB::table('tag_sales')->count();
        $totalTags    = Tag::count();
        $tagsEnStock  = max(0, $totalTags - $tagsVendidos);

        // ── Ranking de adopción por plaza (% de vecinos con cuenta de residente) ──
        $rankingPlazas = Vecino::select('calle')
            ->selectRaw('COUNT(*) as total_vecinos')
            ->selectRaw('SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) as con_cuenta')
            ->groupBy('calle')
            ->get()
            ->map(function ($row) {
                $porcentaje = $row->total_vecinos > 0
                    ? round(($row->con_cuenta / $row->total_vecinos) * 100, 1)
                    : 0;
                return [
                    'calle'      => $row->calle,
                    'total'      => (int) $row->total_vecinos,
                    'con_cuenta' => (int) $row->con_cuenta,
                    'porcentaje' => $porcentaje,
                ];
            })
            ->sortByDesc('porcentaje')
            ->values();

        // ── Últimas ventas de tags ──
        $ultimasVentas = DB::table('tag_sales')
            ->join('tags', 'tag_sales.tag_id', '=', 'tags.id')
            ->select(
                'tag_sales.id',
                'tags.codigo',
                'tag_sales.created_at'
            )
            ->orderByDesc('tag_sales.created_at')
            ->limit(20)
            ->get();

    
    
        return response()->json([
            'mes'                => $mesActual,
            'total_recaudado'    => (float) $totalRecaudado,
            'total_vecinos'      => $totalVecinos,
            'vecinos_pendientes' => $morosos->count(),
            'tags_vendidos'      => $tagsVendidos,
            'tags_en_stock'      => $tagsEnStock,
            'morosos'            => $morosos,
            'ultimas_ventas'     => $ultimasVentas,
            'ranking_plazas'     => $rankingPlazas,
        ]);
    }
}
