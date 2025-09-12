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
     * Activar/Desactivar TAG según pagos del vecino
     */
    public function toggle($id)
    {
        $tag = Tag::findOrFail($id);

        if (!$tag->vecino) {
            return response()->json(['error' => 'Este tag no está asignado a un vecino'], 400);
        }

        // Revisar si el vecino tiene algún pago vigente
        $tienePago = $tag->vecino->pagos()->where('estado', 'Pagado')->exists();

        if ($tienePago) {
            $tag->activo = !$tag->activo; // alterna activación
            $tag->save();
            return response()->json([
                'message' => $tag->activo ? 'TAG activado' : 'TAG desactivado',
                'tag' => $tag
            ]);
        }

        return response()->json(['error' => 'El vecino no tiene pagos vigentes'], 400);
    }
}
