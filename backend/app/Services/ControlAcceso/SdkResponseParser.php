<?php

namespace App\Services\ControlAcceso;

use DateTimeImmutable;

class SdkResponseParser
{
    public const VERSION = 'zk-pull-text-v1';

    public function parse(array $response): array
    {
        if ($response['sdk_return_code'] < 0) {
            return ['status' => 'sdk_error', 'reason' => 'negative_return_code', 'rows' => []];
        }
        $raw = base64_decode($response['raw_payload_base64'], true);
        if (! mb_check_encoding($raw, 'UTF-8') || str_contains($raw, "\0")) {
            return $this->unknown('non_text_payload');
        }
        if ($raw === '') {
            return $response['sdk_return_code'] === 0
                ? ['status' => 'parsed', 'reason' => null, 'rows' => []]
                : $this->unknown('empty_payload_with_positive_count');
        }
        $lines = array_values(array_filter(preg_split('/\r\n|\n|\r/', $raw), fn ($line) => $line !== ''));
        if (count($lines) > config('control_acceso.max_rows') + 1) {
            return $this->unknown('response_row_limit');
        }
        $records = array_map(fn ($line) => str_getcsv($line, ',', '"', ''), $lines);
        $rows = [];
        if ($response['source'] === 'transaction') {
            $header = array_shift($records);
            $expected = ['Cardno', 'Pin', 'Verified', 'DoorID', 'EventType', 'InOutState', 'Time_second'];
            if (! $header || count($header) !== 7 || array_diff($expected, $header) || count(array_unique($header)) !== 7) {
                return $this->unknown('unknown_transaction_schema');
            }
            if (count($records) !== $response['sdk_return_code']) {
                return $this->unknown('transaction_count_mismatch');
            }
        }
        foreach ($records as $values) {
            if (count($values) !== 7 || count(array_filter($values, fn ($v) => ! is_string($v) || strlen($v) > 64))) {
                return $this->unknown('unknown_row_schema');
            }
            if ($response['source'] === 'rt') {
                [$time, $pin, $card, $door, $code, $direction, $verified] = $values;
                if (! $this->validTime($time)) {
                    return $this->unknown('unknown_rt_time');
                }
                $packed = null;
            } else {
                $data = array_combine($header, $values);
                $pin = $data['Pin'];
                $card = $data['Cardno'];
                $door = $data['DoorID'];
                $code = $data['EventType'];
                $direction = $data['InOutState'];
                $verified = $data['Verified'];
                $packed = $data['Time_second'];
                $time = $this->unpackTime($packed);
                if ($time === null) {
                    return $this->unknown('unknown_transaction_time');
                }
            }
            if (! preg_match('/\A\d{1,10}\z/', $code) || (int) $code > 2147483647 ||
                strlen($door) > 32 || strlen($direction) > 32 || strlen($verified) > 32) {
                return $this->unknown('unknown_event_fields');
            }
            $status = (int) $code === 255;
            $rows[] = ['ordinal' => count($rows), 'kind' => $status ? 'status' : 'event',
                'device_time_raw' => $time, 'time_second' => $packed,
                'card_no' => $status ? null : $card, 'pin' => $status ? null : $pin,
                'door_id' => $status ? null : $door, 'event_code' => (int) $code,
                'direction' => $status ? null : $direction, 'verification' => $status ? null : $verified,
                'raw_fields' => $response['source'] === 'rt' ? $values : $data];
        }

        return ['status' => 'parsed', 'reason' => null, 'rows' => $rows];
    }

    private function unknown(string $reason): array
    {
        // Conservar toda la respuesta; no publicar una parte como si el resto fuera valido.
        return ['status' => 'unparsed', 'reason' => $reason, 'rows' => []];
    }

    private function validTime(string $value): bool
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value);

        return $date !== false && $date->format('Y-m-d H:i:s') === $value;
    }

    private function unpackTime(string $value): ?string
    {
        if (! preg_match('/\A\d{1,12}\z/', $value)) {
            return null;
        }
        $n = (int) $value;
        $second = $n % 60;
        $n = intdiv($n, 60);
        $minute = $n % 60;
        $n = intdiv($n, 60);
        $hour = $n % 24;
        $n = intdiv($n, 24);
        $day = $n % 31 + 1;
        $n = intdiv($n, 31);
        $month = $n % 12 + 1;
        $year = intdiv($n, 12) + 2000;
        $result = sprintf('%04d-%02d-%02d %02d:%02d:%02d', $year, $month, $day, $hour, $minute, $second);

        return $year <= 9999 && $this->validTime($result) ? $result : null;
    }
}
