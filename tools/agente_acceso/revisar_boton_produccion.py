"""Consulta originales recientes en SQLite readonly. Sin SDK, red ni credenciales."""
import argparse
import csv
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import zlib

DATABASE = Path(r'C:\SanIsidro\ZKSync\acceso-datos\originals.sqlite')
IDENTITY = ('54d110e4-313a-45e3-bcc6-7761f3df8721', 'CO2K225060027')
APP_ID = 0x53495241


def stamp(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise ValueError('Hora de captura UTC requerida.')
    return parsed


def safe(path):
    path = Path(path)
    for item in (path, *path.parents):
        if item.is_symlink() or getattr(item.lstat(), 'st_file_attributes', 0) & 0x400:
            raise ValueError('Ruta redirigida.')
    return path


def payload(row, meta):
    decoder = zlib.decompressobj()
    buffer = decoder.decompress(row, 65537)
    raw = buffer.split(b'\0', 1)[0]
    if (not decoder.eof or decoder.unused_data or decoder.unconsumed_tail or
            len(buffer) > 65536 or len(buffer) != meta['buffer_bytes'] or
            hashlib.sha256(buffer).hexdigest() != meta['buffer_sha256'] or
            hashlib.sha256(raw).hexdigest() != meta['payload_sha256'] or
            (b'\0' in buffer) is not meta['terminated']):
        raise ValueError('Original alterado/excedido.')
    return raw


def inspect(path, seconds=180, *, now=None, limit=6000):
    if type(seconds) is not int or not 10 <= seconds <= 900:
        raise ValueError('Ventana entre10 y900segundos.')
    now = now or datetime.now(timezone.utc)
    start = now - timedelta(seconds=seconds)
    db = sqlite3.connect(safe(path).resolve().as_uri() + '?mode=ro', uri=True, timeout=3)
    try:
        db.execute('PRAGMA query_only=ON')
        db.execute('BEGIN')
        if db.execute('PRAGMA application_id').fetchone()[0] != APP_ID:
            raise ValueError('Base distinta de originales.')
        if db.execute('SELECT agent_id,serial FROM identity').fetchall() != [IDENTITY]:
            raise ValueError('Identidad distinta de produccion.')
        rows = db.execute('SELECT id,metadata FROM originals ORDER BY rowid DESC LIMIT ?', (limit+1,)).fetchall()
        truncated = len(rows) > limit
        rows = rows[:limit]
        captures = statuses = errors = unparsed = 0
        first = last = None
        oldest = None
        events = []
        for key, encoded in reversed(rows):
            meta = json.loads(encoded)
            ended = stamp(meta['ended_utc'])
            oldest = ended if oldest is None else min(oldest, ended)
            if not start <= ended <= now:
                continue
            if meta['response_id'] != key or stamp(meta['started_utc']) > ended:
                raise ValueError('Metadatos inconsistentes.')
            first = ended if first is None else min(first, ended)
            last = ended if last is None else max(last, ended)
            captures += 1
            errors += int(meta['sdk_return_code'] < 0)
            compressed = db.execute('SELECT buffer_z FROM originals WHERE id=?', (key,)).fetchone()[0]
            raw = payload(compressed, meta)
            for ordinal, fields in enumerate(csv.reader(io.StringIO(raw.decode('utf-8', errors='strict')))):
                if not fields:
                    continue
                if len(fields) != 7:
                    unparsed += 1
                    events.append({'response_id': key, 'ordinal': ordinal,
                        'captured_utc': meta['ended_utc'], 'parse': 'unknown_fields',
                        'payload_sha256': meta['payload_sha256']})
                    continue
                device, pin, card, door, code, direction, verification = fields
                if code == '255':
                    statuses += 1
                    continue
                events.append({'response_id': key, 'ordinal': ordinal,
                    'captured_utc': meta['ended_utc'], 'device_time_raw': device,
                    'door_raw': door, 'event_code_raw': code,
                    'direction_raw': direction, 'verification_raw': verification,
                    'has_card': card not in ('', '0'), 'has_pin': pin not in ('', '0'),
                    'payload_sha256': meta['payload_sha256']})
        return {'scope': 'originales_produccion_readonly_sin_sdk_red_credenciales',
            'from_utc': start.isoformat(), 'to_utc': now.isoformat(),
            'scan_truncated_in_window': bool(truncated and oldest is not None and oldest > start),
            'captures': captures, 'first_capture_utc': first.isoformat() if first else None,
            'last_capture_utc': last.isoformat() if last else None,
            'status255_rows': statuses, 'sdk_error_captures': errors, 'unparsed_rows': unparsed,
            'events': events, 'events_without_card': sum(e.get('has_card') is False for e in events),
            'limits': ['Hora PC de captura, no hora de pulsacion ni reloj C3 corregido.',
                'No atribuye un evento al boton ni clasifica codigos por suposicion.',
                'Ausencia de evento no demuestra cableado; contrastar hora y cobertura.',
                'Omite numeros de tag y PIN en la salida; originales conservados.']}
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--segundos', type=int, default=180)
    args = parser.parse_args()
    try:
        result = inspect(DATABASE, args.segundos)
    except Exception as exc:
        print(json.dumps({'status': 'not_read', 'error_type': type(exc).__name__}))
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
