<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Vecino;
use App\Models\Tag;
use Carbon\Carbon; // <-- Asegúrate de que Carbon esté importado

class VecinoController extends Controller
{
    /**
     * =========================================================================
     * MÉTODO MODIFICADO
     * =========================================================================
     * Este método ahora calcula el estado de cada tag para el mes actual
     * y lo añade a la respuesta JSON.
     */
    public function index()
    {
        // 1. Obtenemos los vecinos con sus relaciones como antes
        $vecinos = Vecino::with('tags', 'pagos')->get();

        // 2. Definimos el mes actual para el cálculo
        $currentMonth = Carbon::now()->format('Y-m');

        // 3. Procesamos los datos ANTES de enviarlos al frontend
        $vecinos->each(function ($vecino) use ($currentMonth) {
            
            // Verificamos si el vecino tiene un pago completo para el mes actual
            $hasCompletePago = $vecino->pagos->contains(function ($pago) use ($currentMonth) {
                return $pago->mes === $currentMonth && $pago->restante == 0;
            });

            // Añadimos un nuevo atributo a CADA tag del vecino
            $vecino->tags->each(function ($tag) use ($hasCompletePago) {
                // El tag se considera "activo" solo si su estado base es activo Y el vecino ha pagado el mes
                $tag->is_active_for_month = $tag->activo && $hasCompletePago;
            });
        });

        // 4. Devolvemos los vecinos ya procesados
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
