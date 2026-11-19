<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use App\Models\Vecino;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TagController extends Controller
{
    public function index()
    {
        return response()->json(Tag::with('vecinos')->get());
    }

    public function store(Request $request)
    {
        $request->merge(['codigo' => trim((string) $request->input('codigo', ''))]);
        $request->validate([
            'codigo' => 'required|string|max:255',
            'asignable_sin_venta' => 'sometimes|boolean',
        ]);
        if ($request->boolean('asignable_sin_venta') && $request->user()?->role !== 'admin') {
            abort(403, 'Solo un administrador puede registrar TAGS para asignar sin venta.');
        }

        $existing = Tag::where('codigo', $request->codigo)->first();
        if ($existing) {
            return response()->json(['message' => $existing->tagSale()->exists()
                ? 'Este TAG ya existe y tiene una venta registrada. No se puede agregar como inventario nuevo.'
                : 'Este TAG ya está registrado en el inventario.'], 422);
        }

        $tag = Tag::create([
    'codigo' => $request->codigo,
    'activo' => false,
    'asignable_sin_venta' => $request->boolean('asignable_sin_venta'),
    ]);

        return response()->json($tag);
    }

    public function show($id)
    {
        return response()->json(Tag::with('vecino')->findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        abort_if($request->has('activo') && $request->user()?->role !== 'admin', 403);
        $tag = DB::transaction(function () use ($request, $id) {
            $tag = Tag::lockForUpdate()->findOrFail($id);
            $tag->fill($request->only($tag->getFillable()));
            abort_if($tag->desactivado_manualmente && $tag->isDirty('codigo'), 422,
                'Reactiva el TAG antes de cambiar su código.');
            $tag->save();

            return $tag;
        });

        return response()->json($tag);
    }

    public function destroy($id)
    {
        DB::transaction(function () use ($id) {
            $tag = Tag::lockForUpdate()->find($id);
            abort_if($tag?->desactivado_manualmente, 422, 'Reactiva el TAG antes de eliminarlo.');
            $tag?->delete();
        });

        return response()->json(['message' => 'Tag eliminado']);
    }

    /**
     * Activar/Desactivar TAG manualmente
     */
    public function toggle(Request $request, $id)
    {
        abort_unless($request->user()?->role === 'admin', 403);
        $tag = Tag::findOrFail($id);

        $tag->activo = !$tag->activo; // alterna activación
        $tag->save();
        return response()->json([
            'message' => $tag->activo ? 'TAG activado' : 'TAG desactivado',
            'tag' => $tag
        ]);
    }

    public function setAccess(Request $request, $id)
    {
        abort_unless($request->user()?->role === 'admin', 403);
        $request->validate(['desactivado' => 'required|boolean']);

        $tag = DB::transaction(function () use ($request, $id) {
            $tag = Tag::lockForUpdate()->findOrFail($id);
            $disabled = $request->boolean('desactivado');
            abort_if($disabled && !ctype_digit(trim($tag->codigo)), 422,
                'El código del TAG debe ser numérico para enviarlo al polling.');

            $tag->desactivado_manualmente = $disabled;
            if ($tag->isDirty('desactivado_manualmente')) {
                $tag->save();
            }

            return $tag;
        });

        return response()->json(['tag' => $tag]);
    }

    // New method to get stock (unsold tags count)
    public function stock()
    {
        $stockCount = Tag::where('asignable_sin_venta', false)->whereDoesntHave('tagSale')->whereDoesntHave('vecinos')->count();
        return response()->json(['stock' => $stockCount]);
    }

    // New method to get total sales amount
    public function totalSales()
    {
        $total = \App\Models\TagSale::sum('price');
        return response()->json(['total_sales' => $total]);
    }

    // New method to get sales registry
    public function sales()
    {
        $sales = \App\Models\TagSale::with('tag')->get();
        return response()->json($sales);
    }
}
