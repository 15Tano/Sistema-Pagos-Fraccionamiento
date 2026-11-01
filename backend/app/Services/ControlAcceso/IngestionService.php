<?php

namespace App\Services\ControlAcceso;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class IngestionService
{
    public function __construct(private SdkResponseParser $parser) {}

    public static function json(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
    }

    public static function digest(array $payload): string
    {
        $sort = function (mixed $value) use (&$sort): mixed {
            if (! is_array($value)) {
                return $value;
            }
            if (! array_is_list($value)) {
                ksort($value, SORT_STRING);
            }

            return array_map($sort, $value);
        };

        return hash('sha256', self::json($sort($payload)));
    }

    private function authorize(string $id, string $hash, array $payload): void
    {
        // Serializa ingesta y revocacion/rotacion por agente, antes de comprobar IDs.
        $agent = DB::table('control_acceso_agentes')->where('id', $id)->lockForUpdate()->first();
        abort_unless($agent && $agent->revoked_at === null && hash_equals($agent->token_hash, $hash), 401, 'Agente no autenticado.');
        abort_unless($payload['agent_id'] === $agent->id && $payload['device_serial'] === $agent->device_serial,
            403, 'El mensaje no corresponde al equipo autorizado.');
    }

    private function replay(object $stored, string $hash): array
    {
        abort_unless(hash_equals($stored->content_sha256, $hash), 409, 'Identificador reutilizado con otro contenido.');

        return ['created' => false, 'ack' => json_decode($stored->ack, true, 64, JSON_THROW_ON_ERROR)];
    }

    public function state(string $agentId, string $tokenHash, array $payload): array
    {
        $hash = self::digest($payload);

        return DB::transaction(function () use ($agentId, $tokenHash, $payload, $hash) {
            $this->authorize($agentId, $tokenHash, $payload);
            $stored = DB::table('control_acceso_estados')->where('agent_id', $agentId)
                ->where('session_id', $payload['session_id'])->where('sequence', $payload['sequence'])->first();
            if ($stored) {
                return $this->replay($stored, $hash);
            }
            $now = CarbonImmutable::now('UTC');
            $summary = IngestionSummary::enabled();
            $latest = null;
            $signal = null;
            $saveDetail = true;
            if ($summary) {
                IngestionSummary::fresh($payload['reported_at_utc'], config('control_acceso.retry_state_days'), $now);
                $latest = IngestionSummary::latestState($agentId);
                IngestionSummary::counter($agentId, $payload, $latest, $now);
                $signal = IngestionSummary::signal($payload);
                $saveDetail = ! $latest || ! hash_equals($signal, IngestionSummary::signal(json_decode($latest->payload, true, 64, JSON_THROW_ON_ERROR)));
            }
            $ack = ['protocol_version' => 1, 'status' => 'accepted', 'agent_id' => $agentId,
                'session_id' => $payload['session_id'], 'sequence' => $payload['sequence'],
                'content_sha256' => $hash, 'server_received_at_utc' => $now->toISOString()];
            if ($summary) {
                $ack += ['storage_policy' => 'summary-v1', 'retry_window_days' => config('control_acceso.retry_state_days')];
            }
            $stateId = DB::table('control_acceso_estados')->insertGetId([
                'agent_id' => $agentId, 'session_id' => $payload['session_id'], 'sequence' => $payload['sequence'],
                'reported_at_utc' => PayloadValidator::utc($payload['reported_at_utc'])->format('Y-m-d H:i:s.u'),
                'received_at_utc' => $now->format('Y-m-d H:i:s.u'),
                'content_sha256' => $hash, 'payload' => $saveDetail ? self::json($payload) : '{}', 'ack' => self::json($ack),
            ] + ($summary && ! $saveDetail ? ['retention_pruned_at_utc' => $now->format('Y-m-d H:i:s.u')] : []));
            $reported = PayloadValidator::utc($payload['reported_at_utc'])->format('Y-m-d H:i:s.u');
            if ($summary && (! $latest || [$reported, $stateId] > [$latest->reported_at_utc, (int) $latest->id])) {
                $snapshotPayload = $payload;
                // Un reporte antiguo sin métricas no debe borrar el watermark acumulado.
                $previousSdk = $latest ? (json_decode($latest->payload, true, 64, JSON_THROW_ON_ERROR)['sdk'] ?? []) : [];
                if (! isset($payload['sdk']['status_observations_epoch'])) {
                    $snapshotPayload['sdk'] += array_intersect_key($previousSdk, array_flip([
                        'status_observations_epoch', 'statuses_observed_total', 'status_responses_total', 'status_last_observed_utc',
                    ]));
                }
                DB::table('control_acceso_salud_actual')->updateOrInsert(['agent_id' => $agentId], [
                    'state_id' => $stateId, 'reported_at_utc' => $reported, 'received_at_utc' => $now->format('Y-m-d H:i:s.u'),
                    'payload' => self::json($snapshotPayload), 'signal_sha256' => $signal,
                ]);
            }

            return ['created' => true, 'ack' => $ack];
        }, 3);
    }

    public function batch(string $agentId, string $tokenHash, array $payload): array
    {
        $hash = self::digest($payload);

        return DB::transaction(function () use ($agentId, $tokenHash, $payload, $hash) {
            $this->authorize($agentId, $tokenHash, $payload);
            $stored = DB::table('control_acceso_lotes')->where('agent_id', $agentId)->where('batch_id', $payload['batch_id'])->first();
            if ($stored) {
                return $this->replay($stored, $hash);
            }
            // Un ACK confirmado no depende de interpretar otra vez el lote.
            // Para lotes nuevos, interpretar todo antes de escribir.
            $parsed = [];
            $rows = 0;
            $events = 0;
            $statuses = 0;
            $unparsed = 0;
            $summary = IngestionSummary::enabled();
            $now = CarbonImmutable::now('UTC');
            foreach ($payload['responses'] as $item) {
                if ($summary) {
                    IngestionSummary::fresh($item['captured_started_utc'], config('control_acceso.retry_event_days'), $now);
                    IngestionSummary::fresh($item['captured_ended_utc'], config('control_acceso.retry_event_days'), $now);
                }
                $result = $this->parser->parse($item);
                $parsed[] = $result;
                $rows += count($result['rows']);
                $events += count(array_filter($result['rows'], fn ($r) => $r['kind'] === 'event'));
                $statuses += count(array_filter($result['rows'], fn ($r) => $r['kind'] === 'status'));
                $unparsed += $result['status'] !== 'parsed' ? 1 : 0;
            }
            if ($rows > config('control_acceso.max_rows')) {
                throw ValidationException::withMessages(['responses' => 'Demasiadas filas interpretadas en el lote.']);
            }
            abort_if(DB::table('control_acceso_lotes')->where('agent_id', $agentId)
                ->where('session_id', $payload['session_id'])->where('sequence', $payload['sequence'])->exists(),
                409, 'Secuencia de lote reutilizada.');
            abort_if(DB::table('control_acceso_respuestas')->where('agent_id', $agentId)
                ->whereIn('response_id', array_column($payload['responses'], 'response_id'))->exists(),
                409, 'Una respuesta ya pertenece a otro lote; reintente el lote original.');
            $now = CarbonImmutable::now('UTC');
            $ack = ['protocol_version' => 1, 'status' => 'accepted', 'agent_id' => $agentId,
                'batch_id' => $payload['batch_id'], 'content_sha256' => $hash,
                'responses_stored' => count($parsed), 'rows_stored' => $summary ? $events : $rows,
                'events_stored' => $events, 'statuses_stored' => $summary ? 0 : $statuses,
                'responses_pending_interpretation' => $unparsed, 'server_received_at_utc' => $now->toISOString()];
            if ($summary) {
                $ack += ['storage_policy' => 'summary-v1', 'statuses_summarized' => $statuses,
                    'retry_window_days' => config('control_acceso.retry_event_days')];
            }
            $batchId = DB::table('control_acceso_lotes')->insertGetId([
                'agent_id' => $agentId, 'batch_id' => $payload['batch_id'], 'session_id' => $payload['session_id'],
                'sequence' => $payload['sequence'], 'content_sha256' => $hash,
                'received_at_utc' => $now->format('Y-m-d H:i:s.u'), 'ack' => self::json($ack),
            ]);
            foreach ($payload['responses'] as $index => $item) {
                $result = $parsed[$index];
                $statusCount = count(array_filter($result['rows'], fn ($row) => $row['kind'] === 'status'));
                $onlyStatus = $summary && $result['status'] === 'parsed' && $statusCount > 0 && $statusCount === count($result['rows']);
                if ($summary) {
                    IngestionSummary::status($agentId, $item['source'], $statusCount, $now);
                }
                $responseId = DB::table('control_acceso_respuestas')->insertGetId([
                    'lote_id' => $batchId, 'agent_id' => $agentId, 'response_id' => $item['response_id'],
                    'source' => $item['source'], 'sdk_return_code' => $item['sdk_return_code'],
                    'raw_payload_base64' => $onlyStatus ? '' : $item['raw_payload_base64'], 'sha256' => $item['sha256'],
                    'payload_bytes' => strlen(base64_decode($item['raw_payload_base64'], true)),
                    'captured_started_utc' => PayloadValidator::utc($item['captured_started_utc'])->format('Y-m-d H:i:s.u'),
                    'captured_ended_utc' => PayloadValidator::utc($item['captured_ended_utc'])->format('Y-m-d H:i:s.u'),
                    'pc_local_time' => $item['pc_local_time'] ?? null, 'windows_timezone' => $item['windows_timezone'] ?? null,
                    'parse_status' => $result['status'], 'parse_reason' => $result['reason'],
                    'parser_version' => SdkResponseParser::VERSION,
                ] + ($onlyStatus ? ['retention_pruned_at_utc' => $now->format('Y-m-d H:i:s.u')] : []));
                foreach ($result['rows'] as $row) {
                    if ($summary && $row['kind'] === 'status') {
                        continue;
                    }
                    $row['raw_fields'] = self::json($row['raw_fields']);
                    DB::table('control_acceso_filas')->insert(['respuesta_id' => $responseId] + $row);
                }
            }

            return ['created' => true, 'ack' => $ack];
        }, 3);
    }
}
