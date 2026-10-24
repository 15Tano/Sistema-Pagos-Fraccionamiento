"""Ensayo manual con fixtures: sin SDK, tareas ni archivos del polling."""
import argparse
import json
from pathlib import Path
import sqlite3
import sys

import credencial
from emisor import HttpTransport, Sender
from outbox import Outbox
from protocolo import digest, identifier

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'datos' / 'ensayo_remoto'
AGENT = '6b293548-0312-4d06-9c1d-3a7e79c9c5a0'
SERIAL = 'TEST-C3-001'
URL = 'http://127.0.0.1:18881/api/control-acceso/agente'
START = '2026-10-24T06:00:00.000000Z'
END = '2026-10-24T06:00:00.100000Z'
FIXTURES = (
    ('30000000-0000-4000-8000-000000000001', 1,
     b'2026-10-24 00:00:00,42,12345678,1,0,0,4\r\n'),
    ('30000000-0000-4000-8000-000000000002', 1,
     b'2026-10-24 00:00:01,0,0,0,255,0,0\r\n'),
    ('30000000-0000-4000-8000-000000000003', -2, b'\xff\x00error-ficticio'),
)


def read_credential(stream):
    raw = stream.read(4097)
    if len(raw) > 4096:
        raise ValueError('Credencial demasiado grande.')
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('Campo duplicado.')
            result[key] = value
        return result
    data = json.loads(raw, object_pairs_hook=unique_pairs)
    if (not isinstance(data, dict) or set(data) != {'agent_id', 'device_serial', 'token'} or
            data['agent_id'] != AGENT or data['device_serial'] != SERIAL or
            not isinstance(data['token'], str)):
        raise ValueError('Identidad distinta del ensayo preparado.')
    identifier(data['agent_id'])
    return credencial.validate(data['token'])


def prepare(box):
    # UUID/fechas fijos: repetir este comando conserva el mismo ensayo.
    for key, code, raw in FIXTURES:
        box.capture(raw, 'rt', code, START, END, response_id=key)
    box.build_batch()
    if not box.db.execute("SELECT 1 FROM messages WHERE endpoint='estado'").fetchone():
        box.enqueue_state({
            'reported_at_utc': END, 'agent_version': 'ensayo-dell-2026.10.24-1', 'pid': 4242,
            'vigencias': {'protocol': 2, 'pid': 4242, 'phase': 'stopped', 'consecutive_errors': 0},
            'sdk': {'last_ok_utc': None}, 'reader': {'state': 'paused'},
            'sender': {'pending_count': 2},
        })


def report(box):
    messages = []
    for row in box.db.execute('SELECT id,endpoint,sequence,sha256,state,attempts,error,ack FROM messages ORDER BY rowid'):
        item = dict(row)
        item['ack'] = json.loads(item['ack']) if item['ack'] is not None else None
        messages.append(item)
    originals = [{'response_id': row['id'], 'bytes': len(row['raw']), 'sha256': digest(row['raw'])}
                 for row in box.db.execute('SELECT id,raw FROM responses ORDER BY rowid')]
    return {'scope': 'fixtures_sin_SDK', 'agent_id': AGENT, 'device_serial': SERIAL,
            'health': box.health(), 'messages': messages, 'originals': originals}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('configurar', 'preparar', 'enviar', 'estado'))
    args = parser.parse_args(argv)
    try:
        if args.command == 'configurar':
            token = read_credential(sys.stdin.buffer)
            # La entrada SSH pasa directamente a DPAPI, sin archivo JSON local.
            with_box = Outbox(DATA / 'outbox.sqlite', AGENT, SERIAL)
            try:
                credencial.store(DATA / 'credencial.dpapi', token)
            finally:
                with_box.close()
            print('CONFIGURADO: credencial DPAPI del usuario actual; identidad de ensayo verificada.')
            return 0
        box = Outbox(DATA / 'outbox.sqlite')
        try:
            if box.identity['agent_id'] != AGENT or box.identity['device_serial'] != SERIAL:
                raise ValueError('Almacen ajeno al ensayo.')
            if args.command == 'preparar':
                prepare(box)
            result = report(box)
            if args.command == 'enviar':
                transport = HttpTransport(URL, credencial.load(DATA / 'credencial.dpapi'), local_trial=True)
                delivery = Sender(box, transport).run(maximum=3)
                result = report(box) | {'delivery': delivery}
            print(json.dumps(result, indent=2, ensure_ascii=True))
            return 2 if result['health']['paused'] else 0
        finally:
            box.close()
    except (OSError, ValueError, TypeError, sqlite3.Error):
        print('ENSAYO INTERRUMPIDO: revisar configuracion/almacen. No compartir credenciales; originales conservados.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
