<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Vecino;

class VecinoController extends Controller
{
    // Mostrar todos los vecinos
    public function index()
    {
        $vecinos = Vecino::all();
        return view('vecinos.index', compact('vecinos'));
    }

    // Formulario para crear
    public function create()
    {
        return view('vecinos.create');
    }

    // Guardar nuevo vecino
    public function store(Request $request)
    {
        $request->validate([
            'nombre' => 'required|string|max:255',
            'calle' => 'required|string|max:255',
            'numero_casa' => 'required|integer',
            'numero_tag' => 'required|string|max:50',
        ]);

        Vecino::create($request->all());

        return redirect()->route('vecinos.index')->with('success', 'Vecino registrado correctamente.');
    }

    // Formulario de edición
    public function edit($id)
    {
        $vecino = Vecino::findOrFail($id);
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
            'numero_tag' => 'required|string|max:50',
        ]);

        $vecino->update($request->all());

        return redirect()->route('vecinos.index')->with('success', 'Vecino actualizado.');
    }

    // Eliminar vecino
    public function destroy($id)
    {
        $vecino = Vecino::findOrFail($id);
        $vecino->delete();

        return redirect()->route('vecinos.index')->with('success', 'Vecino eliminado.');
    }
}
