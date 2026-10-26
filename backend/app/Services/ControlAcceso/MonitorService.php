<?php

namespace App\Services\ControlAcceso;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class MonitorService
{
    // Asociación actual de la app; no atribuye quién portaba el tag en el pasado.
    private function neighborNames(array $cards): array
    {
        if (!$cards) {
            return [];
        }
        $matches = DB::table('tags as t')->join('tag_vecino as tv', 'tv.tag_id', '=', 't.id')
            ->join('vecinos as v', 'v.id', '=', 'tv.vecino_id')->whereIn('t.codigo', $cards)
            ->select('t.codigo', 'v.id', 'v.nombre')->get();
        $byCard = [];
        foreach ($matches as $match) {
            if (in_array((string) $match->codigo, $cards, true)) {
                $byCard[(string) $match->codigo][$match->id] = $match->nombre;
            }
        }
        $result = [];
        foreach ($byCard as $card => $neighbors) {
            $single = count($neighbors) === 1;
            $result[$card] = ['neighbor_name' => $single ? array_values($neighbors)[0] : null,
                'neighbor_status' => $single ? 'single' : 'multiple'];
        }

        return $result;
    }

    private function iso(?string $value): ?string
    {
        return $value === null ? null : CarbonImmutable::parse($value, 'UTC')->toISOString();
    }

    private function age(?string $value, CarbonImmutable $now): ?float
    {
        return $value === null ? null : CarbonImmutable::parse($value, 'UTC')->diffInSeconds($now, false);
    }

    private function reportingStatus(object $agent, ?object $state, CarbonImmutable $now): string
    {
        if ($agent->revoked_at !== null) {
            return 'revocado';
        }
        if ($state === null) {
            return 'sin_reporte';
        }
        $reported = $this->age($state->reported_at_utc, $now);
        $received = $this->age($state->received_at_utc, $now);
        if (min($reported, $received) < -config('control_acceso.monitor_future_tolerance_seconds')) {
            return 'reloj_por_revisar';
        }
        if ($received > config('control_acceso.monitor_stale_seconds')) {
            return 'sin_reporte_reciente';
        }

        return $reported > config('control_acceso.monitor_stale_seconds') ? 'reporte_atrasado' : 'reciente';
    }

    private function cycleStatus(?array $vigencias, string $reporting, CarbonImmutable $now): string
    {
        if ($vigencias === null) {
            return 'sin_datos';
        }
        if ($reporting !== 'reciente') {
            return 'sin_confirmar';
        }
        if ($vigencias['phase'] === 'stopped') {
            return 'detenido';
        }
        if ($vigencias['consecutive_errors'] > 0) {
            return 'error';
        }
        $lastOk = $this->age($vigencias['last_ok_utc'] ?? null, $now);
        $heartbeat = $this->age($vigencias['heartbeat_utc'] ?? null, $now);
        if ($lastOk === null || $heartbeat === null) {
            return 'sin_datos';
        }
        if (min($lastOk, $heartbeat) < -config('control_acceso.monitor_future_tolerance_seconds')) {
            return 'reloj_por_revisar';
        }
        if (max($lastOk, $heartbeat) > config('control_acceso.monitor_vigencias_stale_seconds')) {
            return 'atrasado';
        }

        return 'correcto';
    }

    public function states(?string $agentId): array
    {
        $now = CarbonImmutable::now('UTC');
        $agents = DB::table('control_acceso_agentes')->select('id', 'nombre', 'device_serial', 'revoked_at')
            ->when($agentId, fn ($query) => $query->where('id', $agentId))->orderBy('id')->limit(51)->get();
        abort_if($agentId && $agents->isEmpty(), 404);
        $truncated = $agents->count() > 50;
        $data = [];
        foreach ($agents->take(50) as $agent) {
            // Un reporte atrasado recibido despues no reemplaza uno mas reciente del mismo PC.
            $state = DB::table('control_acceso_estados')->where('agent_id', $agent->id)
                ->orderByDesc('reported_at_utc')->orderByDesc('id')->first();
            $payload = $state ? json_decode($state->payload, true, 64, JSON_THROW_ON_ERROR) : null;
            $reporting = $this->reportingStatus($agent, $state, $now);
            $vigencias = $payload['vigencias'] ?? null;
            $data[] = [
                'agent_id' => $agent->id, 'name' => $agent->nombre, 'device_serial' => $agent->device_serial,
                'revoked_at_utc' => $this->iso($agent->revoked_at), 'reporting_status' => $reporting,
                'reported_at_utc' => $state ? $this->iso($state->reported_at_utc) : null,
                'received_at_utc' => $state ? $this->iso($state->received_at_utc) : null,
                'vigencias_status' => $this->cycleStatus($vigencias, $reporting, $now),
                'vigencias' => $vigencias ? array_intersect_key($vigencias, array_flip([
                    'protocol', 'pid', 'run_started_utc', 'phase', 'last_ok_utc', 'consecutive_errors',
                    'heartbeat_utc', 'cycle_started_utc', 'cycle_finished_utc', 'last_error_type',
                ])) : null,
                'reader' => $payload ? array_intersect_key($payload['reader'], array_flip(['state', 'checked_at_utc'])) : null,
                'sdk' => $payload ? array_intersect_key($payload['sdk'], array_flip(['last_ok_utc', 'last_error_code'])) : null,
                'sender' => $payload ? array_intersect_key($payload['sender'], array_flip([
                    'pending_count', 'oldest_pending_at_utc', 'last_ack_at_utc',
                ])) : null,
            ];
        }

        return ['data' => $data, 'meta' => ['server_time_utc' => $now->toISOString(), 'truncated' => $truncated,
            'stale_after_seconds' => config('control_acceso.monitor_stale_seconds')]];
    }

    public function events(array $filters): array
    {
        $agent = DB::table('control_acceso_agentes')->where('id', $filters['agent_id'])->first(['id', 'device_serial']);
        abort_unless($agent, 404);
        $limit = (int) ($filters['limit'] ?? 50);
        $after = $filters['after_id'] ?? null;
        $before = $filters['before_id'] ?? null;
        $query = DB::table('control_acceso_filas as f')
            ->join('control_acceso_respuestas as r', 'r.id', '=', 'f.respuesta_id')
            ->join('control_acceso_lotes as l', 'l.id', '=', 'r.lote_id')
            ->where('r.agent_id', $agent->id)->where('f.kind', 'event')
            ->when(($filters['source'] ?? 'rt') !== 'all', fn ($q) => $q->where('r.source', $filters['source'] ?? 'rt'))
            ->when(isset($filters['door_id']), fn ($q) => $q->where('f.door_id', $filters['door_id']))
            ->when(isset($filters['card_no']), fn ($q) => $q->where('f.card_no', $filters['card_no']))
            ->when($after !== null, fn ($q) => $q->where('f.id', '>', $after))
            ->when($before !== null, fn ($q) => $q->where('f.id', '<', $before))
            ->select(['f.id', 'f.ordinal', 'f.device_time_raw', 'f.card_no', 'f.pin', 'f.door_id', 'f.event_code',
                'f.direction', 'f.verification', 'r.response_id', 'r.source', 'r.captured_started_utc',
                'r.captured_ended_utc', 'l.received_at_utc']);
        $rows = ($after !== null ? $query->orderBy('f.id') : $query->orderByDesc('f.id'))->limit($limit + 1)->get();
        $more = $rows->count() > $limit;
        $rows = $rows->take($limit);
        if ($after === null) {
            $rows = $rows->reverse();
        }
        $cards = $rows->pluck('card_no')->filter(fn ($card) => is_string($card) && $card !== '' && $card !== '0')->uniqueStrict()->values()->all();
        $names = $this->neighborNames($cards);
        $data = $rows->values()->map(fn ($row) => [
            'id' => (string) $row->id, 'response_id' => $row->response_id, 'ordinal' => (int) $row->ordinal,
            'source' => $row->source, 'device_time_raw' => $row->device_time_raw,
            'card_no' => $row->card_no, 'pin' => $row->pin, 'door_id' => $row->door_id,
            'door_label' => $agent->device_serial === 'CO2K225060027' ? match ($row->door_id) {
                '1' => 'Entrada', '2' => 'Salida', default => null,
            } : null,
            'event_code' => (int) $row->event_code, 'direction' => $row->direction, 'verification' => $row->verification,
            'captured_started_utc' => $this->iso($row->captured_started_utc),
            'captured_ended_utc' => $this->iso($row->captured_ended_utc), 'received_at_utc' => $this->iso($row->received_at_utc),
            ...($names[$row->card_no] ?? ['neighbor_name' => null, 'neighbor_status' => 'none']),
        ])->all();

        return ['data' => $data, 'meta' => ['server_time_utc' => CarbonImmutable::now('UTC')->toISOString(),
            'order' => 'server_row_id_ascending', 'initial_latest' => $after === null && $before === null,
            'has_more' => $more, 'first_id' => $data[0]['id'] ?? null,
            'last_id' => $data ? $data[count($data) - 1]['id'] : $after,
            'physical_passage_confirmed' => false]];
    }
}
