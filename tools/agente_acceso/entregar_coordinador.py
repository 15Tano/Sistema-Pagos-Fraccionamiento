"""Entrega manual del almacen real de ensayo; no importa SDK ni toca polling."""
import argparse
import base64
from collections import Counter
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import time
import types

BASE = Path(r'C:\SanIsidro\CoordinadorEnsayo_20261024')
AGENT = 'c8d7ccdc-991f-497c-8383-92fb52921f8a'
SERIAL = 'CO2K225060027'
URL = 'http://127.0.0.1:18881/api/control-acceso/agente'
EXPECTED = {
    'outbox.py': 'f00112ac88f1b3268aac628bc4987c3f9ca7e723c22f98aadc05cb71fba012ad',
    'protocolo.py': '5f43b055d0a11a2afe3e3f9cf86ec3ac2682f6c3704ee8c27c1ec69a20c266fb',
    'emisor.py': '0e7cef854b88c739274a1b2d82408bcb2c2a2629ec7cc7e10b015fabcc78359a',
    'credencial.py': '06d9e15b02a58fe0b8cc3fd10f2b3e1df531f1e753df82e2b7b75fdcb998744a',
}


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def libraries(base):
    for name, digest in EXPECTED.items():
        if hashlib.sha256((base / name).read_bytes()).hexdigest() != digest:
            raise ValueError('Biblioteca diferente del paquete de coordinador verificado.')
    protocol = module('_entrega_protocolo', base / 'protocolo.py')
    previous = sys.modules.get('protocolo')
    try:
        sys.modules['protocolo'] = protocol
        return types.SimpleNamespace(protocol=protocol,
            outbox=module('_entrega_outbox', base / 'outbox.py'),
            sender=module('_entrega_emisor', base / 'emisor.py'),
            secret=module('_entrega_credencial', base / 'credencial.py'))
    finally:
        if previous is None:
            sys.modules.pop('protocolo', None)
        else:
            sys.modules['protocolo'] = previous


def read_secret(stream):
    data = stream.read(4097)
    if len(data) > 4096:
        raise ValueError('Entrada demasiado grande.')
    text = data.decode('utf-8-sig').replace('\r\n', '\n')
    ids = re.findall(r'^agent_id: (.*)$', text, re.M)
    tokens = re.findall(r'^token: (.*)$', text, re.M)
    if ids != [AGENT] or len(tokens) != 1 or not re.fullmatch(r'sica_[a-f0-9]{64}', tokens[0]):
        raise ValueError('Salida de alta incompleta o identidad incorrecta.')
    return tokens[0]


class Delivery:
    def __init__(self, base):
        self.lib = libraries(Path(base))
        self.data = Path(base) / 'datos' / 'lectura_mantenimiento'
        self.secret_file = self.data / 'credencial-ingesta.dpapi'
        self.box = self.lib.outbox.Outbox(self.data / 'outbox.sqlite')  # Nunca inicializar otra base.
        if self.box.identity['agent_id'] != AGENT or self.box.identity['device_serial'] != SERIAL:
            self.box.close()
            raise ValueError('Almacen de otro agente o serial.')

    def close(self):
        self.box.close()

    def configure(self, stream):
        self.lib.secret.store(self.secret_file, read_secret(stream))

    def originals(self):
        result = []
        for row in self.box.db.execute('SELECT id,raw,metadata FROM responses ORDER BY id'):
            meta = json.loads(row['metadata'])
            digest = hashlib.sha256(row['raw']).hexdigest()
            if (meta['response_id'] != row['id'] or meta['sha256'] != digest or
                    base64.b64decode(meta['raw_payload_base64'], validate=True) != row['raw']):
                raise ValueError('Original SQLite o metadatos alterados.')
            result.append({'response_id': row['id'], 'bytes': len(row['raw']), 'sha256': digest})
        return result

    def message_hashes(self):
        result = {}
        for row in self.box.db.execute('SELECT id,body,sha256 FROM messages ORDER BY id'):
            if self.lib.protocol.digest(row['body']) != row['sha256']:
                raise ValueError('Cuerpo de mensaje alterado.')
            result[row['id']] = row['sha256']
        return result

    def report(self):
        originals = self.originals()
        messages = self.message_hashes()
        totals = {'state_messages': 0, 'batches': 0, 'responses_stored': 0, 'rows_stored': 0,
                  'events_stored': 0, 'statuses_stored': 0, 'responses_pending_interpretation': 0}
        for row in self.box.db.execute("SELECT body,sha256,ack,endpoint FROM messages WHERE state='acked'"):
            payload, ack = json.loads(row['body']), json.loads(row['ack'])
            self.lib.protocol.validate_ack(200, ack, payload, row['sha256'])
            if row['endpoint'] == 'estado':
                totals['state_messages'] += 1
            else:
                totals['batches'] += 1
                for key in ('responses_stored', 'rows_stored', 'events_stored', 'statuses_stored',
                            'responses_pending_interpretation'):
                    totals[key] += ack[key]
        return {'scope': 'entrega_capturas_reales_backend_aislado', 'agent_id': AGENT,
                'device_serial': SERIAL, 'health': self.box.health(), 'ack_totals': totals,
                'originals': {'count': len(originals), 'hashes_verified': True,
                              'manifest_sha256': self.lib.protocol.digest(self.lib.protocol.json_bytes(originals))},
                'messages': {'count': len(messages), 'body_hashes_verified': True}}

    def send(self, *, transport=None, clock=time.monotonic):
        before = self.originals()
        messages = self.message_hashes()
        for _ in range(100):
            if self.box.build_batch() is None:
                break
        if transport is None:
            transport = self.lib.sender.HttpTransport(URL, self.lib.secret.load(self.secret_file), local_trial=True)
        sender = self.lib.sender.Sender(self.box, transport)
        outcomes, deadline = [], clock() + 60
        for _ in range(100):
            if clock() >= deadline:
                outcomes.append('limit')
                break
            outcome = sender.once()
            outcomes.append(outcome)
            if outcome != 'acked':
                break
            if len(outcomes) % 5 == 0:
                print('Mensajes confirmados en esta tanda: ' + str(len(outcomes)), flush=True)
        after = self.originals()
        current = {entry['response_id']: entry for entry in after}
        unchanged = all(current.get(entry['response_id']) == entry for entry in before)
        current_messages = self.message_hashes()
        messages_unchanged = all(current_messages.get(key) == digest for key, digest in messages.items())
        if not unchanged or not messages_unchanged:
            raise ValueError('Cambio de originales o mensajes durante entrega.')
        result = self.report() | {'delivery': dict(Counter(outcomes)),
            'originals_before': len(before), 'originals_preserved': unchanged,
            'existing_messages_unchanged': messages_unchanged}
        temporary = self.data / 'entrega_resumen.tmp'
        with temporary.open('w', encoding='utf-8', newline='\n') as stream:
            json.dump(result, stream, ensure_ascii=True, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, self.data / 'entrega_resumen.json')
        return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('configurar', 'estado', 'enviar'))
    args = parser.parse_args(argv)
    runtime = None
    try:
        runtime = Delivery(BASE)
        if args.command == 'configurar':
            runtime.configure(sys.stdin.buffer)
            print('CONFIGURADO: credencial DPAPI del agente real; almacen e identidad verificados.')
            return 0
        result = runtime.send() if args.command == 'enviar' else runtime.report()
        print(json.dumps(result, indent=2, ensure_ascii=True))
        return 2 if result['health']['paused'] else 0
    except Exception as exc:
        print('ENTREGA INTERRUMPIDA: ' + type(exc).__name__ + '. Conservar almacen; no compartir credenciales.')
        return 1
    finally:
        if runtime is not None:
            runtime.close()


if __name__ == '__main__':
    raise SystemExit(main())
