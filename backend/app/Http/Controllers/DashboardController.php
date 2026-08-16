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
$vecinosPlaza = Vecino::select('id', 'nombre', 'calle', 'numero_casa', 'user_id')->get();

$rankingPlazas = $vecinosPlaza
    ->groupBy('calle')
    ->map(function ($grupo, $calle) {
        $total = $grupo->count();
        $conCuenta = $grupo->whereNotNull('user_id')->count();
        $porcentaje = $total > 0 ? round(($conCuenta / $total) * 100, 1) : 0;

        $sinCuenta = $grupo->whereNull('user_id')
            ->sortBy('numero_casa')
            ->values()
            ->map(fn($v) => [
                'id'          => $v->id,
                'nombre'      => $v->nombre,
                'numero_casa' => $v->numero_casa,
            ]);

        return [
            'calle'              => $calle,
            'total'              => $total,
            'con_cuenta'         => $conCuenta,
            'porcentaje'         => $porcentaje,
            'vecinos_sin_cuenta' => $sinCuenta,
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
