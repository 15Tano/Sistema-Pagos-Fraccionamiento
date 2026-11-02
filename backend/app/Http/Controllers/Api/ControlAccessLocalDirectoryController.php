<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ControlAccessLocalDirectoryController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        abort_unless(config('control_acceso.local_display_directory_enabled'), 404);
        $agent = DB::table('control_acceso_agentes')->where('id',
            $request->attributes->get('control_access_agent_id'))->first();
        // Este directorio corresponde exclusivamente a las dos pantallas de la Dell.
        abort_unless($agent && $agent->device_serial === 'CO2K225060027', 403);
        $matches = DB::table('tags as t')->join('tag_vecino as tv', 'tv.tag_id', '=', 't.id')
            ->join('vecinos as v', 'v.id', '=', 'tv.vecino_id')
            ->select('t.codigo', 'v.id', 'v.nombre')->orderBy('t.codigo')->limit(10001)->get();
        abort_if($matches->count() > 10000, 503, 'Directorio fuera del límite local.');
        $byCard = [];
        foreach ($matches as $match) {
            $card = (string) $match->codigo;
            if (preg_match('/\A[0-9]{1,20}\z/', $card) && $card !== '0') {
                $byCard[$card][$match->id] = $match->nombre;
            }
        }
        $rows = [];
        foreach ($byCard as $card => $neighbors) {
            $single = count($neighbors) === 1;
            $rows[] = ['card_no' => (string) $card,
                'neighbor_status' => $single ? 'single' : 'multiple',
                'neighbor_name' => $single ? array_values($neighbors)[0] : null];
        }

        return response()->json(['protocol' => 1, 'agent_id' => $agent->id,
            'device_serial' => $agent->device_serial, 'generated_at_utc' => CarbonImmutable::now('UTC')->toISOString(),
            'valid_for_seconds' => 300, 'data' => $rows])->header('Cache-Control', 'private, no-store');
    }
}
