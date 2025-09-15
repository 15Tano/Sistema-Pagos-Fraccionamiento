<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use App\Models\Vecino;
use Illuminate\Http\Request;

class TagController extends Controller
{
    public function index()
    {
        return response()->json(Tag::with('vecino')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'codigo' => 'required|unique:tags',
            'vecino_id' => 'nullable|exists:vecinos,id'
        ]);

        $tag = Tag::create([
            'codigo' => $request->codigo,
            'activo' => false,
            'vecino_id' => $request->vecino_id
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
        $stockCount = Tag::whereDoesntHave('tagSale')->count();
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
