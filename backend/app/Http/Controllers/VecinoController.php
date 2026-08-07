<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Vecino;
use App\Models\Tag;
use Carbon\Carbon;

class VecinoController extends Controller
{
   public function index(Request $request)
{
    $perPage = $request->get('per_page', 20);
    $search  = $request->get('search', '');

    $query = Vecino::with(['tags']);


    if ($search) {
        $query->where(function ($q) use ($search) {
            // Búsqueda simultánea en nombre, calle, numero_casa y tag
            $terms = explode(' ', trim($search));
            foreach ($terms as $term) {
                $q->where(function ($inner) use ($term) {
                    $inner->where('nombre', 'like', "%{$term}%")
                        ->orWhere('calle', 'like', "%{$term}%")
                        ->orWhere('numero_casa', 'like', "%{$term}%")
                        ->orWhereHas('tags', function ($tagQuery) use ($term) {
                            $tagQuery->where('codigo', 'like', "%{$term}%");
                        });
                });
            }
        });
    }

    $vecinos = $query->orderBy('nombre')->paginate($perPage);
    return response()->json($vecinos);
}

    public function store(Request $request)
    {
        $request->validate([
            'nombre'      => 'required|string|max:255',
            'calle'       => 'required|string|max:255',
            'numero_casa' => 'required|string|max:255',
            'tags'        => 'nullable|array',
            'tags.*'      => 'exists:tags,id',
        ]);

        $vecino = Vecino::create($request->only(['nombre', 'calle', 'numero_casa']));

        if (!empty($request->tags)) {
            $soldTagIds = Tag::whereIn('id', $request->tags)
                ->whereHas('tagSale')
                ->pluck('id')
                ->toArray();
            $vecino->tags()->sync($soldTagIds);
        }

        return response()->json([
            'message' => 'Vecino registrado correctamente.',
            'vecino'  => $vecino->load('tags'),
        ], 201);
    }

    public function show($id)
    {
        $vecino = Vecino::with('tags', 'pagos')->findOrFail($id);
        return response()->json($vecino);
    }

    public function update(Request $request, $id)
    {
        $vecino = Vecino::findOrFail($id);

        $request->validate([
            'nombre'      => 'required|string|max:255',
            'calle'       => 'required|string|max:255',
            'numero_casa' => 'required|string|max:255',
            'tags'        => 'nullable|array',
            'tags.*'      => 'exists:tags,id',
        ]);

        $vecino->update($request->only(['nombre', 'calle', 'numero_casa']));

        $tagIds = [];
        if (!empty($request->tags)) {
            $tagIds = Tag::whereIn('id', $request->tags)
                ->whereHas('tagSale')
                ->pluck('id')
                ->toArray();
        }
        $vecino->tags()->sync($tagIds);

        return response()->json([
            'message' => 'Vecino actualizado.',
            'vecino'  => $vecino->load('tags'),
        ]);
    }

    public function destroy($id)
    {
        Vecino::findOrFail($id)->delete();
        return response()->json(['message' => 'Vecino eliminado.']);
    }

    public function historial($numero_tag)
    {
        $vecino = Vecino::whereHas('tags', fn($q) => $q->where('codigo', $numero_tag))
            ->with('pagos')
            ->first();

        if (!$vecino) {
            return response()->json(['message' => 'Vecino no encontrado'], 404);
        }

        return response()->json($vecino->pagos);
    }

    public function plazas()
{
    $plazas = Vecino::select('calle')
        ->distinct()
        ->orderBy('calle')
        ->pluck('calle');

    return response()->json($plazas);
}
}