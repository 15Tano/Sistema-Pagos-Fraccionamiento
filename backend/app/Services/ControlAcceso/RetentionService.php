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
        $receiptCutoff = $now->subDays(config('control_acceso.retry_event_days'))->format('Y-m-d H:i:s.u');
        $stateCutoff = $now->subDays(config('control_acceso.retry_state_days'))->format('Y-m-d H:i:s.u');
        $summaryCutoff = $now->subDays(config('control_acceso.status_summary_days'))->startOfHour()->format('Y-m-d H:i:s');
        $result = ['mode' => $apply ? 'apply' : 'plan', 'cutoffs_utc' => ['technical' => $technical, 'events' => $events],
            'states_compacted' => 0, 'status_rows_deleted' => 0, 'event_rows_deleted' => 0, 'responses_compacted' => 0];
        $phases = ['states', 'status', 'event', 'responses'];
        if (IngestionSummary::enabled()) {
            $phases = [...$phases, 'state_receipts', 'response_receipts', 'batches', 'summaries'];
            $result += ['state_receipts_deleted' => 0, 'response_receipts_deleted' => 0, 'batches_deleted' => 0, 'summaries_deleted' => 0];
        }

        foreach (DB::table('control_acceso_agentes')->orderBy('id')->pluck('id') as $agent) {
            $plannedRows = [];
            $plannedResponses = [];
            foreach ($phases as $phase) {
                $after = 0;
                for ($batch = 0; $batch < $batches; $batch++) {
                    $page = DB::transaction(function () use ($agent, $phase, $after, $size, $technical, $events, $now, $apply, $plannedRows, $plannedResponses, $receiptCutoff, $stateCutoff, $summaryCutoff) {
                        // Same lock order as ingestion, including revoked agents.
                        DB::table('control_acceso_agentes')->where('id', $agent)->lockForUpdate()->first();
                        if (in_array($phase, ['states', 'state_receipts'], true)) {
                            $latest = DB::table('control_acceso_estados')->where('agent_id', $agent)
                                ->orderByDesc('reported_at_utc')->orderByDesc('id')->value('id');
                            $table = 'control_acceso_estados';
                            $query = DB::table($table)->where('agent_id', $agent)->where('id', '<>', $latest)
                                ->where('received_at_utc', '<', $phase === 'states' ? $technical : $stateCutoff);
                            if ($phase === 'states') {
                                $query->whereNull('retention_pruned_at_utc');
                            }
                        } elseif (in_array($phase, ['responses', 'response_receipts'], true)) {
                            $table = 'control_acceso_respuestas';
                            $query = DB::table($table)->where('agent_id', $agent)
                                ->whereIn('lote_id', DB::table('control_acceso_lotes')->select('id')->where('received_at_utc', '<', $phase === 'responses' ? $technical : $receiptCutoff))
                                ->whereNotExists(function ($q) use ($apply, $plannedRows) {
                                    $q->selectRaw('1')->from('control_acceso_filas')->whereColumn('respuesta_id', 'control_acceso_respuestas.id');
                                    if (! $apply && $plannedRows) {
                                        $q->whereNotIn('id', $plannedRows);
                                    }
                                });
                            if ($phase === 'responses') {
                                $query->whereNull('retention_pruned_at_utc');
                            }
                        } elseif ($phase === 'batches') {
                            $table = 'control_acceso_lotes';
                            $query = DB::table($table)->where('agent_id', $agent)->where('received_at_utc', '<', $receiptCutoff)
                                ->whereNotExists(function ($q) use ($apply, $plannedResponses) {
                                    $q->selectRaw('1')->from('control_acceso_respuestas')->whereColumn('lote_id', 'control_acceso_lotes.id');
                                    if (! $apply && $plannedResponses) {
                                        $q->whereNotIn('id', $plannedResponses);
                                    }
                                });
                        } elseif ($phase === 'summaries') {
                            $table = 'control_acceso_resumenes';
                            $query = DB::table($table)->where('agent_id', $agent)->where('hour_utc', '<', $summaryCutoff);
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
                        'state_receipts' => 'state_receipts_deleted', 'response_receipts' => 'response_receipts_deleted',
                        'batches' => 'batches_deleted', 'summaries' => 'summaries_deleted',
                    };
                    $result[$key] += count($page);
                    if (! $apply && in_array($phase, ['status', 'event'], true)) {
                        array_push($plannedRows, ...$page);
                    }
                    if (! $apply && $phase === 'response_receipts') {
                        array_push($plannedResponses, ...$page);
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
