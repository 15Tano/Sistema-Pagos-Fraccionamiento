"""Compatibilidad local, sin SDK, red, tareas ni credenciales reales."""
import datetime as dt
import getpass
import json
from pathlib import Path
import secrets
import sqlite3
import struct
import sys
import tempfile

from credencial import load, store
from outbox import Outbox
from protocolo import digest, now, validate_ack


def main():
    root = Path(__file__).resolve().parent
    directory = root / 'registros' / (dt.datetime.now().strftime('%Y%m%d_%H%M%S_') + secrets.token_hex(4))
    report = {'status': 'incomplete', 'python': sys.version.split()[0], 'python_executable': sys.executable,
              'bits': struct.calcsize('P') * 8, 'sqlite': sqlite3.sqlite_version,
              'windows_user': getpass.getuser(), 'started_utc': now(), 'checks': {}}
    temporary = None
    box = other = None
    stage = 'crear_carpeta_aislada'

    def check(name, result):
        report['checks'][name] = bool(result)
        if not result:
            raise RuntimeError('Comprobacion no aprobada.')

    try:
        directory.mkdir(parents=True, exist_ok=False)
        temporary = tempfile.TemporaryDirectory(dir=directory, prefix='temporal_')
        folder = Path(temporary.name).resolve()
        clock = [dt.datetime.now(dt.timezone.utc).timestamp()]
        stage = 'sqlite_en_disco'
        box = Outbox(folder / 'ensayo.sqlite', '10000000-0000-4000-8000-000000000001',
                     'ENSAYO-SIN-C3', clock=lambda: clock[0])
        box.ensure_capture_capacity()
        check('sqlite_wal', box.db.execute('PRAGMA journal_mode').fetchone()[0] == 'wal')
        check('sqlite_full', box.db.execute('PRAGMA synchronous').fetchone()[0] == 2)
        check('sqlite_fk', box.db.execute('PRAGMA foreign_keys').fetchone()[0] == 1)
        # La tarjeta y la fecha pertenecen a un fixture, no a una lectura real.
        raw = b'2026-10-23 19:49:05,42,12345678,2,0,1,4\r\n'
        instant = now()
        response_id = box.capture(raw, 'rt', 1, instant, instant)
        message_id = box.build_batch()
        original = dict(box.db.execute('SELECT * FROM messages').fetchone())
        box.close()
        box = None
        stage = 'reabrir_y_recuperar'
        box = Outbox(folder / 'ensayo.sqlite', clock=lambda: clock[0])
        persisted = box.db.execute('SELECT raw FROM responses WHERE id=?', (response_id,)).fetchone()[0]
        message = box.db.execute('SELECT * FROM messages WHERE id=?', (message_id,)).fetchone()
        check('original_recuperado', persisted == raw)
        check('lote_identico_al_reabrir', message['body'] == original['body'] and message['sha256'] == digest(message['body']))
        first = box.claim()
        other = Outbox(folder / 'ensayo.sqlite', clock=lambda: clock[0])
        check('lease_exclusivo', other.claim() is None)
        clock[0] += 61  # Reloj inyectado del ensayo, no cambia el reloj de Windows.
        recovered = other.claim()
        check('lease_recuperable', recovered is not None and recovered['id'] == message_id and recovered['attempts'] == 2)
        check('propietario_anterior_rechazado', not box.finish(first, ack={'simulado': True}))
        stage = 'ack_simulado_sin_red'
        payload = json.loads(recovered['body'])
        ack = {'protocol_version': 1, 'status': 'accepted', 'agent_id': payload['agent_id'],
               'batch_id': payload['batch_id'], 'content_sha256': recovered['sha256'],
               'responses_stored': 1, 'rows_stored': 1, 'events_stored': 1, 'statuses_stored': 0,
               'responses_pending_interpretation': 0, 'server_received_at_utc': now()}
        validate_ack(201, ack, payload, recovered['sha256'])
        check('ack_simulado_guardado', other.finish(recovered, ack=ack))
        check('original_conservado_tras_ack', other.health()['responses'] == 1 and other.health()['pending_count'] == 0)
        check('sqlite_integridad', other.db.execute('PRAGMA quick_check').fetchone()[0] == 'ok')
        stage = 'dpapi_usuario_actual'
        fake_token = 'sica_' + secrets.token_hex(32)
        encrypted = folder / 'ficticia.dpapi'
        store(encrypted, fake_token)
        check('dpapi_cifrado_sin_texto_claro', fake_token.encode('ascii') not in encrypted.read_bytes())
        check('dpapi_recuperado_mismo_usuario', load(encrypted) == fake_token)
        report['status'] = 'compatible_local'
    except Exception as error:
        report['failed_stage'] = stage
        report['error_type'] = type(error).__name__
    finally:
        if other is not None:
            other.close()
        if box is not None:
            box.close()
        if temporary is not None:
            try:
                # Comprobar destino absoluto antes de la limpieza recursiva.
                if not Path(temporary.name).resolve().is_relative_to(directory.resolve()):
                    raise RuntimeError('Temporal fuera del ensayo.')
                temporary.cleanup()
                report['temporary_files_removed'] = True
            except Exception as error:
                report.update(status='incomplete', failed_stage='limpieza_temporal', error_type=type(error).__name__)
        report['ended_utc'] = now()
        report['scope'] = 'Sin SDK, red, tareas, cambios de reloj ni credenciales reales.'
    if directory.is_dir():
        (directory / 'resumen.json').write_text(json.dumps(report, ensure_ascii=True, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True, indent=2))
    print('Evidencia:', directory)
    return 0 if report['status'] == 'compatible_local' else 1


if __name__ == '__main__':
    raise SystemExit(main())
