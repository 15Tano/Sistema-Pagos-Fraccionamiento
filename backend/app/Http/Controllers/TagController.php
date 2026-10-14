<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use App\Models\Vecino;
use Illuminate\Http\Request;

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
        $tag = Tag::findOrFail($id);
        $tag->update($request->all());
        return response()->json($tag);
    }

    public function destroy($id)
    {
        Tag::destroy($id);
        return response()->json(['message' => 'Tag eliminado']);
    }

    /**
     * Activar/Desactivar TAG manualmente
     */
    public function toggle($id)
    {
        $tag = Tag::findOrFail($id);

        $tag->activo = !$tag->activo; // alterna activación
        $tag->save();
        return response()->json([
            'message' => $tag->activo ? 'TAG activado' : 'TAG desactivado',
            'tag' => $tag
        ]);
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
