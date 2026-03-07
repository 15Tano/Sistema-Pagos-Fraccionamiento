<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Vecino;
use App\Models\Tag;
use Carbon\Carbon;

class VecinoController extends Controller
{
    /**
     * Listar todos los vecinos con sus tags y pagos.
     * Calcula el estado de cada tag para el mes actual.
     */
    public function index()
    {
        $vecinos = Vecino::with('tags', 'pagos')->get();
        $currentMonth = Carbon::now()->format('Y-m');

        $vecinos->each(function ($vecino) use ($currentMonth) {
            $hasCompletePago = $vecino->pagos->contains(function ($pago) use ($currentMonth) {
                return $pago->mes === $currentMonth && $pago->restante == 0;
            });

            $vecino->tags->each(function ($tag) use ($hasCompletePago) {
                $tag->is_active_for_month = $tag->activo && $hasCompletePago;
            });
        });

        return response()->json($vecinos);
    }

    /**
     * Guardar un nuevo vecino.
     */
    public function store(Request $request)
    {
        $request->validate([
            'nombre' => 'required|string|max:255',
            'calle' => 'required|string|max:255',
            'numero_casa' => 'required|string|max:255',
            'tag_ids' => 'required|array',
            'tag_ids.*' => 'exists:tags,id',
        ]);

        // Verificar que los tags han sido vendidos
        $soldTagIds = Tag::whereIn('id', $request->tag_ids)
            ->whereHas('tagSale')
            ->pluck('id')
            ->toArray();

        if (count($soldTagIds) !== count($request->tag_ids)) {
            return response()->json(['error' => 'One or more tags have not been sold.'], 422);
        }

        $vecino = Vecino::create($request->only(['nombre', 'calle', 'numero_casa']));
        $vecino->tags()->sync($soldTagIds);

        return response()->json(['message' => 'Vecino registrado correctamente.', 'vecino' => $vecino], 201);
    }

    /**
     * Mostrar un vecino específico con sus tags y pagos.
     */
    public function show($id)
    {
        $vecino = Vecino::with('tags', 'pagos')->findOrFail($id);
        return response()->json($vecino);
    }

    /**
     * Actualizar un vecino.
     */
    public function update(Request $request, $id)
    {
        $vecino = Vecino::findOrFail($id);

        $request->validate([
            'nombre' => 'required|string|max:255',
            'calle' => 'required|string|max:255',
            'numero_casa' => 'required|string|max:255',
            'tag_ids' => 'required|array',
            'tag_ids.*' => 'exists:tags,id',
        ]);

        $soldTagIds = Tag::whereIn('id', $request->tag_ids)
            ->whereHas('tagSale')
            ->pluck('id')
            ->toArray();

        if (count($soldTagIds) !== count($request->tag_ids)) {
            return response()->json(['error' => 'One or more tags have not been sold.'], 422);
        }

        $vecino->update($request->only(['nombre', 'calle', 'numero_casa']));
        $vecino->tags()->sync($soldTagIds);

        return response()->json(['message' => 'Vecino actualizado.', 'vecino' => $vecino]);
    }

    /**
     * Eliminar un vecino.
     */
    public function destroy($id)
    {
        $vecino = Vecino::findOrFail($id);
        $vecino->delete();

        return response()->json(['message' => 'Vecino eliminado.']);
    }

    /**
     * Obtener historial de pagos por número de tag.
     */
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
