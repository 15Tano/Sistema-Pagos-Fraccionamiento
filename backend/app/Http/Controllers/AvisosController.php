<?php

namespace App\Http\Controllers;

use App\Models\Aviso;
use Illuminate\Http\Request;

class AvisosController extends Controller
{
    // GET /api/avisos — público, lo leen residentes y admin
    public function index()
    {
        return response()->json(
            Aviso::where('activo', true)
                ->orderByDesc('created_at')
                ->get()
        );
    }

    // POST /api/avisos — solo admin
    public function store(Request $request)
    {
        $request->validate([
            'titulo'      => 'required|string|max:255',
            'descripcion' => 'required|string',
            'tipo'        => 'required|in:urgente,informativo,aviso,positivo',
        ]);

        $aviso = Aviso::create([
            'titulo'      => $request->titulo,
            'descripcion' => $request->descripcion,
            'tipo'        => $request->tipo,
            'activo'      => true,
        ]);

        return response()->json($aviso, 201);
    }

    // PUT /api/avisos/{id} — solo admin
    public function update(Request $request, $id)
    {
        $aviso = Aviso::findOrFail($id);

        $request->validate([
            'titulo'      => 'sometimes|string|max:255',
            'descripcion' => 'sometimes|string',
            'tipo'        => 'sometimes|in:urgente,informativo,aviso,positivo',
        ]);

        $aviso->update($request->only(['titulo', 'descripcion', 'tipo']));

        return response()->json($aviso);
    }

    // DELETE /api/avisos/{id} — solo admin
    public function destroy($id)
    {
        Aviso::findOrFail($id)->delete();
        return response()->json(['message' => 'Aviso eliminado']);
    }
}