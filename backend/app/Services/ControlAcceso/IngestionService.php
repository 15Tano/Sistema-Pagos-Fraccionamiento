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
            $ack = ['protocol_version' => 1, 'status' => 'accepted', 'agent_id' => $agentId,
                'session_id' => $payload['session_id'], 'sequence' => $payload['sequence'],
                'content_sha256' => $hash, 'server_received_at_utc' => $now->toISOString()];
            DB::table('control_acceso_estados')->insert([
                'agent_id' => $agentId, 'session_id' => $payload['session_id'], 'sequence' => $payload['sequence'],
                'reported_at_utc' => PayloadValidator::utc($payload['reported_at_utc'])->format('Y-m-d H:i:s.u'),
                'received_at_utc' => $now->format('Y-m-d H:i:s.u'),
                'content_sha256' => $hash, 'payload' => self::json($payload), 'ack' => self::json($ack),
            ]);

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
            foreach ($payload['responses'] as $item) {
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
                'responses_stored' => count($parsed), 'rows_stored' => $rows,
                'events_stored' => $events, 'statuses_stored' => $statuses,
                'responses_pending_interpretation' => $unparsed, 'server_received_at_utc' => $now->toISOString()];
            $batchId = DB::table('control_acceso_lotes')->insertGetId([
                'agent_id' => $agentId, 'batch_id' => $payload['batch_id'], 'session_id' => $payload['session_id'],
                'sequence' => $payload['sequence'], 'content_sha256' => $hash,
                'received_at_utc' => $now->format('Y-m-d H:i:s.u'), 'ack' => self::json($ack),
            ]);
            foreach ($payload['responses'] as $index => $item) {
                $result = $parsed[$index];
                $responseId = DB::table('control_acceso_respuestas')->insertGetId([
                    'lote_id' => $batchId, 'agent_id' => $agentId, 'response_id' => $item['response_id'],
                    'source' => $item['source'], 'sdk_return_code' => $item['sdk_return_code'],
                    'raw_payload_base64' => $item['raw_payload_base64'], 'sha256' => $item['sha256'],
                    'payload_bytes' => strlen(base64_decode($item['raw_payload_base64'], true)),
                    'captured_started_utc' => PayloadValidator::utc($item['captured_started_utc'])->format('Y-m-d H:i:s.u'),
                    'captured_ended_utc' => PayloadValidator::utc($item['captured_ended_utc'])->format('Y-m-d H:i:s.u'),
                    'pc_local_time' => $item['pc_local_time'] ?? null, 'windows_timezone' => $item['windows_timezone'] ?? null,
                    'parse_status' => $result['status'], 'parse_reason' => $result['reason'],
                    'parser_version' => SdkResponseParser::VERSION,
                ]);
                foreach ($result['rows'] as $row) {
                    $row['raw_fields'] = self::json($row['raw_fields']);
                    DB::table('control_acceso_filas')->insert(['respuesta_id' => $responseId] + $row);
                }
            }

            return ['created' => true, 'ack' => $ack];
        }, 3);
    }
}
