<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ControlAcceso\MonitorService;
use App\Services\ControlAcceso\MonitorAccess;
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

    public function state(Request $request, MonitorService $service, MonitorAccess $access): JsonResponse
    {
        $this->rejectUnknown($request, ['agent_id']);
        $input = $request->validate(['agent_id' => ['sometimes', 'required', 'uuid']]);

        $result = $service->states(isset($input['agent_id']) ? strtolower($input['agent_id']) : null);
        $result['meta']['permissions'] = $access->permissions($request->user()->role);

        return response()->json($result);
    }

    public function current(Request $request, MonitorService $service, MonitorAccess $access): JsonResponse
    {
        // No acepta cursores, tags, fechas ni selección arbitraria de registros pasados.
        $this->rejectUnknown($request, ['agent_id', 'door_id']);
        $input = $request->validate(['agent_id' => ['required', 'uuid'],
            'door_id' => ['sometimes', 'required', 'string', Rule::in(['1', '2'])]]);
        $input['agent_id'] = strtolower($input['agent_id']);
        $result = $service->current($input);
        $result['meta']['permissions'] = $access->permissions($request->user()->role);

        return response()->json($result);
    }

    public function settings(Request $request, MonitorAccess $access): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $this->rejectUnknown($request, []);

        return response()->json(['data' => $access->settings()]);
    }

    public function updateSettings(Request $request, MonitorAccess $access): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);
        $this->rejectUnknown($request, []);
        if ($request->except(['history_for_guards', 'revision'])) {
            throw ValidationException::withMessages(['settings' => 'Parametro desconocido.']);
        }
        $input = $request->validate([
            'history_for_guards' => ['required', function ($attribute, $value, $fail) {
                if (!is_bool($value)) { $fail('El permiso debe ser un booleano.'); }
            }],
            'revision' => ['required', 'integer', 'between:1,2147483646'],
        ]);
        $result = $access->update($input['history_for_guards'], (int) $input['revision'], (int) $request->user()->id);
        if ($result === null) {
            return response()->json(['code' => 'monitor_settings_conflict', 'data' => $access->settings(),
                'message' => 'Otro administrador cambió el ajuste. Revisa el valor actual.'], 409);
        }

        return response()->json(['data' => $result]);
    }

    public function events(Request $request, MonitorService $service, MonitorAccess $access): JsonResponse
    {
        $permissions = $access->permissions($request->user()->role);
        if (!$permissions['can_view_history']) {
            return response()->json(['code' => 'history_forbidden', 'message' => 'El historial está reservado a administración.'], 403);
        }
        $this->rejectUnknown($request, ['agent_id', 'after_id', 'before_id', 'limit', 'source', 'door_id', 'card_no',
            'q', 'date_from', 'date_to', 'result']);
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
            'q' => ['sometimes', 'required', 'string', 'max:120'],
            'date_from' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'required', 'date_format:Y-m-d', ...($request->filled('date_from') ? ['after_or_equal:date_from'] : [])],
            'result' => ['sometimes', 'required', Rule::in(['authorized', 'repeated', 'review'])],
        ]);
        $input['agent_id'] = strtolower($input['agent_id']);

        $result = $service->events($input);
        $result['meta']['permissions'] = $permissions;

        return response()->json($result);
    }
}
