<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ControlAcceso\IngestionService;
use App\Services\ControlAcceso\PayloadValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ControlAccessAgentController extends Controller
{
    public function capabilities(): JsonResponse
    {
        if (\App\Services\ControlAcceso\IngestionSummary::enabled()) {
            abort_unless(\Illuminate\Support\Facades\Schema::hasTable('control_acceso_salud_actual')
                && \Illuminate\Support\Facades\Schema::hasTable('control_acceso_resumenes')
                && \Illuminate\Support\Facades\Schema::hasColumn('control_acceso_estados', 'retention_pruned_at_utc')
                && \Illuminate\Support\Facades\Schema::hasColumn('control_acceso_respuestas', 'retention_pruned_at_utc'),
                503, 'Estructura de ingesta resumida no preparada.');
        }

        return response()->json([
            'retention_enabled' => (bool) config('control_acceso.retention_enabled'),
            'storage_policy' => \App\Services\ControlAcceso\IngestionSummary::enabled() ? 'summary-v1' : 'legacy-v1',
            'retry_window_days' => config('control_acceso.retry_event_days'),
            'technical_days' => config('control_acceso.retention_technical_days'),
            'event_days' => config('control_acceso.retention_event_days'),
        ])->header('Cache-Control', 'private, no-store');
    }

    public function state(Request $request, PayloadValidator $validator, IngestionService $service): JsonResponse
    {
        $payload = $validator->state($request);
        $result = $service->state($request->attributes->get('control_access_agent_id'),
            $request->attributes->get('control_access_token_hash'), $payload);

        return response()->json($result['ack'], $result['created'] ? 201 : 200);
    }

    public function batch(Request $request, PayloadValidator $validator, IngestionService $service): JsonResponse
    {
        $payload = $validator->batch($request);
        $result = $service->batch($request->attributes->get('control_access_agent_id'),
            $request->attributes->get('control_access_token_hash'), $payload);

        return response()->json($result['ack'], $result['created'] ? 201 : 200);
    }
}
