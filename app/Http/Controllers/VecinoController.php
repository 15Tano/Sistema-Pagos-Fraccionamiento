<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Vecino;
use App\Models\Tag;

class VecinoController extends Controller
{
    // Mostrar todos los vecinos
    public function index()
    {
        $vecinos = Vecino::with('tags', 'pagos')->get();
        if (request()->wantsJson()) {
            return response()->json($vecinos);
        }
        return view('vecinos.index', compact('vecinos'));
    }

    // Formulario para crear
    public function create()
    {
        $tags = Tag::whereHas('tagSale')->get();
        return view('vecinos.create', compact('tags'));
    }

    // Guardar nuevo vecino
    public function store(Request $request)
    {
        $request->validate([
            'nombre' => 'required|string|max:255',
            'calle' => 'required|string|max:255',
            'numero_casa' => 'required|integer',
            'tag_ids' => 'required|array',
            'tag_ids.*' => 'exists:tags,id',
        ]);

        // Verify tags have been sold
        $soldTagIds = Tag::whereIn('id', $request->tag_ids)
            ->whereHas('tagSale')
            ->pluck('id')
            ->toArray();

        if (count($soldTagIds) !== count($request->tag_ids)) {
            return back()->withErrors(['tag_ids' => 'One or more tags have not been sold.']);
        }

        $vecino = Vecino::create($request->only(['nombre', 'calle', 'numero_casa']));

        $vecino->tags()->sync($soldTagIds);

        if (request()->wantsJson()) {
            return response()->json(['message' => 'Vecino registrado correctamente.', 'vecino' => $vecino], 201);
        }
        return redirect()->route('vecinos.index')->with('success', 'Vecino registrado correctamente.');
    }

    // Formulario de edición
    public function edit($id)
    {
        $vecino = Vecino::with('tags')->findOrFail($id);
        return view('vecinos.edit', compact('vecino'));
    }

    // Actualizar vecino
    public function update(Request $request, $id)
    {
        $vecino = Vecino::findOrFail($id);

        $request->validate([
            'nombre' => 'required|string|max:255',
            'calle' => 'required|string|max:255',
            'numero_casa' => 'required|integer',
            'tag_ids' => 'required|array',
            'tag_ids.*' => 'exists:tags,id',
        ]);

        // Verify tags have been sold
        $soldTagIds = Tag::whereIn('id', $request->tag_ids)
            ->whereHas('tagSale')
            ->pluck('id')
            ->toArray();

        if (count($soldTagIds) !== count($request->tag_ids)) {
            return back()->withErrors(['tag_ids' => 'One or more tags have not been sold.']);
        }

        $vecino->update($request->only(['nombre', 'calle', 'numero_casa']));

        $vecino->tags()->sync($soldTagIds);

        if (request()->wantsJson()) {
            return response()->json(['message' => 'Vecino actualizado.', 'vecino' => $vecino]);
        }
        return redirect()->route('vecinos.index')->with('success', 'Vecino actualizado.');
    }

    // Eliminar vecino
    public function destroy($id)
    {
        $vecino = Vecino::findOrFail($id);
        $vecino->delete();

        if (request()->wantsJson()) {
            return response()->json(['message' => 'Vecino eliminado.']);
        }
        return redirect()->route('vecinos.index')->with('success', 'Vecino eliminado.');
    }

    // New method to get historial by numero_tag
    public function historial($numero_tag)
    {
        $vecino = Vecino::whereHas('tags', function ($query) use ($numero_tag) {
            $query->where('codigo', $numero_tag);
        })->with('pagos')->first();

        if (!$vecino) {
            return response()->json(['message' => 'Vecino no encontrado'], 404);
        }

        return response()->json($vecino->pagos);
    }
}
