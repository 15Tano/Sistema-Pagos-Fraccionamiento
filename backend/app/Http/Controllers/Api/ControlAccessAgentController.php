<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ControlAcceso\IngestionService;
use App\Services\ControlAcceso\PayloadValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ControlAccessAgentController extends Controller
{
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
