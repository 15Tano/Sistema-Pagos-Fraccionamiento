<?php

namespace App\Http\Controllers;

use App\Models\Encuesta;
use App\Models\VotoEncuesta;
use App\Models\Vecino;
use Illuminate\Http\Request;

class EncuestaController extends Controller
{
    // GET /api/encuestas/activa
    public function activa(Request $request)
    {
        $vecino = Vecino::where('user_id', $request->user()->id)->first();

        if (!$vecino) {
            return response()->json(['message' => 'No se encontró vecino asociado a este usuario.'], 422);
        }

        $encuesta = Encuesta::latest()->first();

        if (!$encuesta) {
            return response()->json(['encuesta' => null]);
        }

        $voto = VotoEncuesta::where('encuesta_id', $encuesta->id)
            ->where('vecino_id', $vecino->id)
            ->first();

        $mostrarResultados = $voto !== null || !$encuesta->activa;

        return response()->json([
            'encuesta' => $encuesta,
            'ya_voto' => $voto !== null,
            'opcion_votada' => $voto?->opcion_index,
            'resultados' => $mostrarResultados ? $this->calcularResultados($encuesta) : null,
        ]);
    }

    // POST /api/encuestas/{encuesta}/votar
    public function votar(Request $request, Encuesta $encuesta)
    {
        $request->validate(['opcion_index' => 'required|integer|min:0']);

        if (!$encuesta->activa) {
            return response()->json(['message' => 'Esta encuesta ya cerró.'], 422);
        }

        if ($request->opcion_index >= count($encuesta->opciones)) {
            return response()->json(['message' => 'Opción inválida.'], 422);
        }

        $vecino = Vecino::where('user_id', $request->user()->id)->first();

        if (!$vecino) {
            return response()->json(['message' => 'No se encontró vecino asociado a este usuario.'], 422);
        }

        try {
            VotoEncuesta::create([
                'encuesta_id' => $encuesta->id,
                'vecino_id' => $vecino->id,
                'opcion_index' => $request->opcion_index,
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() === '23000') {
                return response()->json(['message' => 'Ya votaste en esta encuesta.'], 409);
            }
            throw $e;
        }

        return response()->json([
            'message' => 'Voto registrado.',
            'opcion_votada' => (int) $request->opcion_index,
            'resultados' => $this->calcularResultados($encuesta),
        ]);
    }

    // --- Admin ---

    public function index(Request $request)
    {
        $this->assertAdmin($request);
        return Encuesta::withCount('votos')->latest()->get();
    }

    public function store(Request $request)
    {
        $this->assertAdmin($request);

        $data = $request->validate([
            'pregunta' => 'required|string|max:255',
            'descripcion' => 'nullable|string|max:500',
            'opciones' => 'required|array|min:2',
            'opciones.*' => 'required|string|max:100',
            'fecha_cierre' => 'nullable|date',
        ]);

        return Encuesta::create($data);
    }

    public function toggle(Request $request, Encuesta $encuesta)
    {
        $this->assertAdmin($request);
        $encuesta->update(['activa' => !$encuesta->activa]);
        return $encuesta;
    }

    public function resultados(Request $request, Encuesta $encuesta)
    {
        $this->assertAdmin($request);
        return response()->json($this->calcularResultados($encuesta));
    }

    /**
     * Estructura compartida entre el endpoint de residente (activa/votar)
     * y el de admin — así nunca se desincronizan los cálculos.
     */
    private function calcularResultados(Encuesta $encuesta): array
    {
        $conteoPorOpcion = VotoEncuesta::where('encuesta_id', $encuesta->id)
            ->selectRaw('opcion_index, count(*) as total')
            ->groupBy('opcion_index')
            ->pluck('total', 'opcion_index');

        $totalVotos = $conteoPorOpcion->sum();

        $opciones = collect($encuesta->opciones)->map(function ($texto, $i) use ($conteoPorOpcion, $totalVotos) {
            $votos = (int) ($conteoPorOpcion[$i] ?? 0);
            return [
                'texto' => $texto,
                'votos' => $votos,
                'porcentaje' => $totalVotos > 0 ? round(($votos / $totalVotos) * 100) : 0,
            ];
        });

        $maxVotos = $opciones->max('votos');

        return [
            'opciones' => $opciones->map(function ($op) use ($maxVotos) {
                $op['es_ganadora'] = $maxVotos > 0 && $op['votos'] === $maxVotos;
                return $op;
            })->values(),
            'total_votos' => $totalVotos,
            'cierra_en_dias' => $this->diasParaCierre($encuesta),
        ];
    }

    private function diasParaCierre(Encuesta $encuesta): ?int
    {
        if (!$encuesta->fecha_cierre || !$encuesta->activa) {
            return null;
        }
        $dias = now()->diffInDays($encuesta->fecha_cierre, false);
        return $dias >= 0 ? (int) ceil($dias) : null;
    }

    private function assertAdmin(Request $request): void
    {
        if ($request->user()->role !== 'admin') {
            abort(403, 'No autorizado.');
        }
    }
}