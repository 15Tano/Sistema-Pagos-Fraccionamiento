<?php

namespace App\Http\Controllers;

use App\Models\TagSale;
use App\Models\Tag;
use Illuminate\Http\Request;

class TagSaleController extends Controller
{
    public function index()
    {
        return response()->json(TagSale::with('tag')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'tag_id' => 'required|exists:tags,id',
        ]);

        // Check if tag is already sold
        if (TagSale::where('tag_id', $request->tag_id)->exists()) {
            return response()->json(['error' => 'Este tag ya ha sido vendido'], 400);
        }

        $sale = TagSale::create([
            'tag_id' => $request->tag_id,
            'sold_at' => now(),
            'price' => 150, // fixed price
        ]);

        return response()->json($sale->load('tag'));
    }

    public function show($id)
    {
        return response()->json(TagSale::with('tag')->findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        $sale = TagSale::findOrFail($id);
        $sale->update($request->all());
        return response()->json($sale);
    }

    public function destroy($id)
    {
        TagSale::destroy($id);
        return response()->json(['message' => 'Venta eliminada']);
    }

    public function reset()
    {
        TagSale::truncate();
        return response()->json(['message' => 'Ventas reiniciadas']);
    }
}
