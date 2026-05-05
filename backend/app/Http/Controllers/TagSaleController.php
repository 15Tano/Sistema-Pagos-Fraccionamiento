<?php

namespace App\Http\Controllers;

use App\Models\TagSale;
use App\Models\Tag;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB; // <-- Vital para transacciones y tabla pivote

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
            'vecino_id' => 'required|exists:vecinos,id',
        ]);

        if (TagSale::where('tag_id', $request->tag_id)->exists()) {
            return response()->json(['error' => 'Este tag ya ha sido vendido'], 400);
        }

        try {
            $sale = DB::transaction(function () use ($request) {
                // 1. Crear el recibo de venta
                $newSale = TagSale::create([
                    'tag_id' => $request->tag_id,
                    'sold_at' => now(),
                    'price' => 150,
                ]);

                // 2. Encender el tag (para que la pluma lo lea)
                $tag = Tag::findOrFail($request->tag_id);
                $tag->activo = true; 
                $tag->save();

                // 3. ¡EL PUENTE! Guardar la relación en la tabla intermedia tag_vecino
                DB::table('tag_vecino')->insert([
                    'tag_id' => $request->tag_id,
                    'vecino_id' => $request->vecino_id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return $newSale;
            });

            return response()->json($sale->load('tag'));

        } catch (\Exception $e) {
            return response()->json(['error' => 'Error BD: ' . $e->getMessage()], 500);
        }
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
        try {
            DB::transaction(function () use ($id) {
                $sale = TagSale::findOrFail($id);
                
                // 1. Apagamos el tag porque regresa al inventario
                $tag = Tag::find($sale->tag_id);
                if ($tag) {
                    $tag->activo = false;
                    $tag->save();
                }

                // 2. Destruimos el puente: lo borramos de la tabla intermedia
                DB::table('tag_vecino')->where('tag_id', $sale->tag_id)->delete();

                // 3. Borramos el recibo
                $sale->delete();
            });

            return response()->json(['message' => 'Venta eliminada y tag desvinculado']);
            
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error BD: ' . $e->getMessage()], 500);
        }
    }

    public function reset()
    {
        try {
            DB::transaction(function () {
                // Borrar recibos
                TagSale::truncate();
                // Destruir todas las relaciones de pertenencia
                DB::table('tag_vecino')->truncate();
                // Apagar todos los tags
                Tag::query()->update(['activo' => false]);
            });
            
            return response()->json(['message' => 'Ventas reiniciadas y tags desvinculados']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error BD: ' . $e->getMessage()], 500);
        }
    }
}