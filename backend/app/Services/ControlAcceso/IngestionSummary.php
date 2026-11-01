<?php

namespace App\Services\ControlAcceso;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class IngestionSummary
{
    public static function enabled(): bool
    {
        return (bool) config('control_acceso.ingestion_summary_enabled');
    }

    public static function fresh(string $timestamp, int $days, CarbonImmutable $now): void
    {
        $at = PayloadValidator::utc($timestamp);
        abort_if($at->lessThan($now->subDays($days)), 410, 'Envío fuera de la ventana de admisión; conservar originales para revisión.');
        abort_if($at->greaterThan($now->addSeconds(config('control_acceso.ingestion_future_tolerance_seconds'))),
            422, 'Reloj del agente adelantado; conservar originales y revisar.');
    }

    public static function signal(array $payload): string
    {
        return IngestionService::digest([
            'agent_version' => $payload['agent_version'] ?? null, 'worker_version' => $payload['worker_version'] ?? null,
            'pid' => $payload['pid'] ?? null,
            'vigencias' => array_intersect_key($payload['vigencias'] ?? [], array_flip([
                'pid', 'phase', 'consecutive_errors', 'last_error_type',
            ])),
            'sdk_error' => $payload['sdk']['last_error_code'] ?? null,
            'reader' => $payload['reader']['state'] ?? null,
            'watchdog' => array_intersect_key($payload['watchdog'] ?? [], array_flip(['status', 'reason'])),
        ]);
    }

    public static function latestState(string $agent): ?object
    {
        $legacy = DB::table('control_acceso_estados')->where('agent_id', $agent)
            ->orderByDesc('reported_at_utc')->orderByDesc('id')->first();
        if (! Schema::hasTable('control_acceso_salud_actual')) {
            return $legacy;
        }
        $current = DB::table('control_acceso_salud_actual')->where('agent_id', $agent)
            ->select('state_id as id', 'reported_at_utc', 'received_at_utc', 'payload')->first();
        if ($current && (! $legacy || [$current->reported_at_utc, (int) $current->id] >= [$legacy->reported_at_utc, (int) $legacy->id])) {
            return $current;
        }

        return $legacy;
    }

    public static function status(string $agent, string $source, int $count, CarbonImmutable $now, int $responses = 1): void
    {
        if ($count === 0) {
            return;
        }
        $key = ['agent_id' => $agent, 'source' => $source, 'hour_utc' => $now->startOfHour()->format('Y-m-d H:i:s')];
        $query = DB::table('control_acceso_resumenes')->where($key);
        $values = ['last_received_at_utc' => $now->format('Y-m-d H:i:s.u')];
        if ($query->exists()) {
            $query->update($values + ['responses' => DB::raw('responses + '.$responses), 'statuses' => DB::raw('statuses + '.$count)]);
        } else {
            DB::table('control_acceso_resumenes')->insert($key + $values + ['responses' => $responses, 'statuses' => $count]);
        }
    }

    public static function counter(string $agent, array $payload, ?object $latest, CarbonImmutable $now): void
    {
        $sdk = $payload['sdk'];
        if (! isset($sdk['status_observations_epoch']) || ($latest &&
            PayloadValidator::utc($payload['reported_at_utc'])->format('Y-m-d H:i:s.u') < $latest->reported_at_utc)) {
            return;
        }
        $previous = $latest ? (json_decode($latest->payload, true, 64, JSON_THROW_ON_ERROR)['sdk'] ?? []) : [];
        $same = ($previous['status_observations_epoch'] ?? null) === $sdk['status_observations_epoch'];
        $statuses = $sdk['statuses_observed_total'] - ($same ? $previous['statuses_observed_total'] : 0);
        $responses = $sdk['status_responses_total'] - ($same ? $previous['status_responses_total'] : 0);
        abort_if($statuses < 0 || $responses < 0 || $statuses < $responses, 422, 'Contadores RT inconsistentes; conservar originales y revisar.');
        self::status($agent, 'rt', $statuses, $now, $responses);
    }
}
