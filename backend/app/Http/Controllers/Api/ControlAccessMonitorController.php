<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ControlAcceso\MonitorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ControlAccessMonitorController extends Controller
{
    private function rejectUnknown(Request $request, array $allowed): void
    {
        if (array_diff(array_keys($request->query()), $allowed)) {
            throw ValidationException::withMessages(['query' => 'Parametro de consulta desconocido.']);
        }
    }

    public function state(Request $request, MonitorService $service): JsonResponse
    {
        $this->rejectUnknown($request, ['agent_id']);
        $input = $request->validate(['agent_id' => ['sometimes', 'required', 'uuid']]);

        return response()->json($service->states(isset($input['agent_id']) ? strtolower($input['agent_id']) : null));
    }

    public function events(Request $request, MonitorService $service): JsonResponse
    {
        $this->rejectUnknown($request, ['agent_id', 'after_id', 'before_id', 'limit', 'source', 'door_id', 'card_no']);
        $cursor = ['sometimes', 'required', 'regex:/\A(?:0|[1-9][0-9]{0,18})\z/',
            function ($attribute, $value, $fail) {
                if (is_string($value) && strlen($value) === 19 && strcmp($value, '9223372036854775807') > 0) {
                    $fail('Cursor fuera de rango.');
                }
            }];
        $input = $request->validate([
            'agent_id' => ['required', 'uuid'], 'after_id' => [...$cursor, 'prohibits:before_id'],
            'before_id' => [...$cursor, 'prohibits:after_id'], 'limit' => ['sometimes', 'required', 'integer', 'between:1,100'],
            'source' => ['sometimes', 'required', Rule::in(['rt', 'transaction', 'all'])],
            'door_id' => ['sometimes', 'required', 'string', 'regex:/\A[0-9]{1,32}\z/'],
            'card_no' => ['sometimes', 'required', 'string', 'regex:/\A[0-9]{1,32}\z/'],
        ]);
        $input['agent_id'] = strtolower($input['agent_id']);

        return response()->json($service->events($input));
    }
}
