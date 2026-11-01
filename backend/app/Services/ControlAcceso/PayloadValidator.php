<?php

namespace App\Services\ControlAcceso;

use Carbon\CarbonImmutable;
use Closure;
use DateTimeImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use JsonException;

class PayloadValidator
{
    public static function utc(string $value): CarbonImmutable
    {
        return CarbonImmutable::instance(new DateTimeImmutable($value))->utc();
    }

    private function timestamp(): Closure
    {
        return function ($attribute, $value, $fail) {
            if (! is_string($value) || ! preg_match('/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)\z/', $value)) {
                $fail('Debe ser una fecha ISO 8601 en UTC.');

                return;
            }
            try {
                $date = new DateTimeImmutable($value);
                if ((int) substr($value, 0, 4) < 1000 || $date->format('Y-m-d\TH:i:s') !== substr($value, 0, 19)) {
                    $fail('Fecha invalida.');
                }
            } catch (\Exception) {
                $fail('Fecha invalida.');
            }
        };
    }

    private function integer(): Closure
    {
        return function ($attribute, $value, $fail) {
            if (! is_int($value)) {
                $fail('Debe ser un entero JSON.');
            }
        };
    }

    private function decode(Request $request, array $keys): array
    {
        // Leer bytes originales: TrimStrings/ConvertEmptyStringsToNull no deben
        // modificar el contenido usado para hashes ni convertir base64 vacio en null.
        try {
            $payload = json_decode($request->getContent(), true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw ValidationException::withMessages(['payload' => 'JSON invalido.']);
        }
        if (! is_array($payload) || array_is_list($payload) || array_diff(array_keys($payload), $keys)) {
            throw ValidationException::withMessages(['payload' => 'Se requiere un objeto con los campos del protocolo.']);
        }
        foreach (['agent_id', 'session_id', 'batch_id'] as $key) {
            if (isset($payload[$key]) && is_string($payload[$key])) {
                $payload[$key] = strtolower($payload[$key]);
            }
        }

        return $payload;
    }

    private function envelope(): array
    {
        return [
            'protocol_version' => ['required', $this->integer(), 'in:1'],
            'agent_id' => ['required', 'uuid'],
            'device_serial' => ['required', 'string', 'max:64', 'regex:/\A[A-Za-z0-9_.:-]+\z/'],
            'session_id' => ['required', 'uuid'],
            'sequence' => ['required', $this->integer(), 'integer', 'min:0', 'max:2147483647'],
        ];
    }

    public function state(Request $request): array
    {
        abort_if(strlen($request->getContent()) > config('control_acceso.max_state_bytes'), 413, 'Estado demasiado grande.');
        $payload = $this->decode($request, ['protocol_version', 'agent_id', 'device_serial', 'session_id',
            'sequence', 'reported_at_utc', 'agent_version', 'worker_version', 'pid', 'vigencias',
            'sdk', 'reader', 'sender', 'watchdog']);
        $rules = $this->envelope() + [
            'reported_at_utc' => ['required', $this->timestamp()],
            'agent_version' => ['required', 'string', 'max:64'],
            'worker_version' => ['nullable', 'string', 'max:64'],
            'pid' => ['required', $this->integer(), 'integer', 'min:1', 'max:2147483647'],
            'vigencias' => ['required', 'array:protocol,pid,run_started_utc,phase,last_ok_utc,consecutive_errors,heartbeat_utc,cycle_started_utc,cycle_finished_utc,last_error_type'],
            'vigencias.protocol' => ['required', $this->integer(), 'in:2'],
            'vigencias.pid' => ['required', $this->integer(), 'integer', 'min:1', 'max:2147483647'],
            'vigencias.phase' => ['required', 'in:starting,cycle,idle,stopped'],
            'vigencias.consecutive_errors' => ['required', $this->integer(), 'integer', 'min:0', 'max:2147483647'],
            'vigencias.last_error_type' => ['nullable', 'string', 'max:128'],
            'sdk' => ['required', 'array:last_ok_utc,last_error_code,status_observations_epoch,statuses_observed_total,status_responses_total,status_last_observed_utc'],
            'sdk.status_observations_epoch' => ['required_with:sdk.statuses_observed_total,sdk.status_responses_total,sdk.status_last_observed_utc', 'uuid'],
            'sdk.statuses_observed_total' => ['required_with:sdk.status_observations_epoch', $this->integer(), 'integer', 'min:0', 'max:9007199254740991'],
            'sdk.status_responses_total' => ['required_with:sdk.status_observations_epoch', $this->integer(), 'integer', 'min:0', 'max:9007199254740991'],
            'sdk.status_last_observed_utc' => ['required_with:sdk.status_observations_epoch', $this->timestamp()],
            'sdk.last_error_code' => ['nullable', $this->integer(), 'integer', 'min:-2147483648', 'max:2147483647'],
            'reader' => ['required', 'array:state,checked_at_utc'],
            'reader.state' => ['required', 'in:catching_up,status_observed,unknown,paused'],
            'sender' => ['required', 'array:pending_count,oldest_pending_at_utc,last_ack_at_utc'],
            'sender.pending_count' => ['required', $this->integer(), 'integer', 'min:0', 'max:2147483647'],
            'watchdog' => ['sometimes', 'array:checked_utc,status,reason'],
            'watchdog.status' => ['required_with:watchdog', 'in:correcto,alerta,mantenimiento,desconocido'],
            'watchdog.reason' => ['nullable', 'string', 'max:512'],
        ];
        foreach (['vigencias.run_started_utc', 'vigencias.last_ok_utc', 'vigencias.heartbeat_utc',
            'vigencias.cycle_started_utc', 'vigencias.cycle_finished_utc', 'sdk.last_ok_utc',
            'reader.checked_at_utc', 'sender.oldest_pending_at_utc', 'sender.last_ack_at_utc',
            'watchdog.checked_utc'] as $field) {
            $rules[$field] = ['nullable', $this->timestamp()];
        }
        Validator::make($payload, $rules)->validate();

        return $payload;
    }

    public function batch(Request $request): array
    {
        $payload = $this->decode($request, ['protocol_version', 'agent_id', 'device_serial', 'session_id',
            'sequence', 'batch_id', 'responses']);
        if (isset($payload['responses']) && is_array($payload['responses'])) {
            foreach ($payload['responses'] as &$item) {
                if (is_array($item) && isset($item['response_id']) && is_string($item['response_id'])) {
                    $item['response_id'] = strtolower($item['response_id']);
                }
            }
            unset($item);
        }
        Validator::make($payload, $this->envelope() + [
            'batch_id' => ['required', 'uuid'],
            'responses' => ['required', 'array', 'list', 'min:1', 'max:'.config('control_acceso.max_responses')],
            'responses.*' => ['required', 'array:response_id,source,sdk_return_code,raw_payload_base64,sha256,captured_started_utc,captured_ended_utc,pc_local_time,windows_timezone'],
            'responses.*.response_id' => ['required', 'uuid', 'distinct:strict'],
            'responses.*.source' => ['required', 'in:rt,transaction'],
            'responses.*.sdk_return_code' => ['required', $this->integer(), 'integer', 'min:-2147483648', 'max:2147483647'],
            'responses.*.raw_payload_base64' => ['present', 'string'],
            'responses.*.sha256' => ['required', 'string', 'regex:/\A[a-f0-9]{64}\z/'],
            'responses.*.captured_started_utc' => ['required', $this->timestamp()],
            'responses.*.captured_ended_utc' => ['required', $this->timestamp()],
            'responses.*.pc_local_time' => ['nullable', 'string', 'max:40'],
            'responses.*.windows_timezone' => ['nullable', 'string', 'max:100'],
        ])->validate();
        foreach ($payload['responses'] as $index => $item) {
            $raw = base64_decode($item['raw_payload_base64'], true);
            if ($raw === false || base64_encode($raw) !== $item['raw_payload_base64'] ||
                strlen($raw) > config('control_acceso.max_response_bytes')) {
                throw ValidationException::withMessages(["responses.$index.raw_payload_base64" => 'Base64 invalido o respuesta demasiado grande.']);
            }
            if (! hash_equals(hash('sha256', $raw), $item['sha256'])) {
                throw ValidationException::withMessages(["responses.$index.sha256" => 'El hash no corresponde a los bytes recibidos.']);
            }
            if (self::utc($item['captured_ended_utc'])->lessThan(self::utc($item['captured_started_utc']))) {
                throw ValidationException::withMessages(["responses.$index.captured_ended_utc" => 'El fin es anterior al inicio.']);
            }
        }

        return $payload;
    }
}
