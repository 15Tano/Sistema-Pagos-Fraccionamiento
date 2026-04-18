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

        // ── Total recaudado este mes ──
        $totalRecaudado = DB::table('pagos')
            ->whereRaw("strftime('%Y-%m', mes) = ?", [$mesActual])
            ->sum('cantidad');

        // ── IDs de vecinos que pagaron este mes ──
        $vecinosPagaron = DB::table('pagos')
            ->whereRaw("strftime('%Y-%m', mes) = ?", [$mesActual])
            ->distinct()
            ->pluck('vecino_id');

        // ── Total vecinos ──
        $totalVecinos = Vecino::count();

        // ── Morosos: vecinos con al menos un tag vendido que no pagaron ──
        // Un tag "activo para acceso" = fue vendido (tiene tagSale)
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
        ]);
    }
}