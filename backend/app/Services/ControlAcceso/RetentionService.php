<?php

namespace App\Services\ControlAcceso;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class RetentionService
{
    /** Bounded transactions share the ingestion lock; ACKs and identities never change. */
    public function run(bool $apply = false, int $size = 500, int $batches = 20): array
    {
        $now = CarbonImmutable::now('UTC');
        $technical = $now->subDays(config('control_acceso.retention_technical_days'))->format('Y-m-d H:i:s.u');
        $events = $now->subDays(config('control_acceso.retention_event_days'))->format('Y-m-d H:i:s.u');
        $result = ['mode' => $apply ? 'apply' : 'plan', 'cutoffs_utc' => ['technical' => $technical, 'events' => $events],
            'states_compacted' => 0, 'status_rows_deleted' => 0, 'event_rows_deleted' => 0, 'responses_compacted' => 0];

        foreach (DB::table('control_acceso_agentes')->orderBy('id')->pluck('id') as $agent) {
            $plannedRows = [];
            foreach (['states', 'status', 'event', 'responses'] as $phase) {
                $after = 0;
                for ($batch = 0; $batch < $batches; $batch++) {
                    $page = DB::transaction(function () use ($agent, $phase, $after, $size, $technical, $events, $now, $apply, $plannedRows) {
                        // Same lock order as ingestion, including revoked agents.
                        DB::table('control_acceso_agentes')->where('id', $agent)->lockForUpdate()->first();
                        if ($phase === 'states') {
                            $latest = DB::table('control_acceso_estados')->where('agent_id', $agent)
                                ->orderByDesc('reported_at_utc')->orderByDesc('id')->value('id');
                            $table = 'control_acceso_estados';
                            $query = DB::table($table)->where('agent_id', $agent)->where('id', '<>', $latest)
                                ->whereNull('retention_pruned_at_utc')->where('received_at_utc', '<', $technical);
                        } elseif ($phase === 'responses') {
                            $table = 'control_acceso_respuestas';
                            $query = DB::table($table)->where('agent_id', $agent)->whereNull('retention_pruned_at_utc')
                                ->whereIn('lote_id', DB::table('control_acceso_lotes')->select('id')->where('received_at_utc', '<', $technical))
                                ->whereNotExists(function ($q) use ($apply, $plannedRows) {
                                    $q->selectRaw('1')->from('control_acceso_filas')->whereColumn('respuesta_id', 'control_acceso_respuestas.id');
                                    if (! $apply && $plannedRows) {
                                        $q->whereNotIn('id', $plannedRows);
                                    }
                                });
                        } else {
                            $table = 'control_acceso_filas';
                            $query = DB::table($table)->where('kind', $phase)
                                ->whereIn('respuesta_id', DB::table('control_acceso_respuestas as r')
                                    ->join('control_acceso_lotes as l', 'l.id', '=', 'r.lote_id')->where('r.agent_id', $agent)
                                    ->where('l.received_at_utc', '<', $phase === 'event' ? $events : $technical)->select('r.id'));
                            if ($phase === 'event') {
                                // Exact predicates used by MonitorService::current().
                                $protected = [];
                                foreach (['1', '2'] as $door) {
                                    $id = DB::table('control_acceso_filas as f')->join('control_acceso_respuestas as r', 'r.id', '=', 'f.respuesta_id')
                                        ->where('r.agent_id', $agent)->where('r.source', 'rt')->where('f.kind', 'event')
                                        ->where('f.door_id', $door)->whereNotNull('f.card_no')->whereNotIn('f.card_no', ['', '0'])
                                        ->orderByDesc('f.id')->value('f.id');
                                    if ($id !== null) {
                                        $protected[] = $id;
                                    }
                                }
                                $query->whereNotIn('id', $protected);
                            }
                        }
                        $ids = $query->where('id', '>', $after)->orderBy('id')->limit($size)->pluck('id')->all();
                        if ($apply && $ids) {
                            $target = DB::table($table)->whereIn('id', $ids);
                            if ($phase === 'states') {
                                $target->update(['payload' => '{}', 'retention_pruned_at_utc' => $now->format('Y-m-d H:i:s.u')]);
                            } elseif ($phase === 'responses') {
                                $target->update(['raw_payload_base64' => '', 'retention_pruned_at_utc' => $now->format('Y-m-d H:i:s.u')]);
                            } else {
                                $target->delete();
                            }
                        }

                        return $ids;
                    }, 3);
                    $key = match ($phase) {
                        'states' => 'states_compacted', 'status' => 'status_rows_deleted',
                        'event' => 'event_rows_deleted', 'responses' => 'responses_compacted',
                    };
                    $result[$key] += count($page);
                    if (! $apply && in_array($phase, ['status', 'event'], true)) {
                        array_push($plannedRows, ...$page);
                    }
                    if (count($page) < $size) {
                        break;
                    }
                    $after = end($page);
                }
            }
        }

        return $result;
    }
}
