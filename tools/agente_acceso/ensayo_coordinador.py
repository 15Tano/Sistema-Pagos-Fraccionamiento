"""Simulacion sin SDK por defecto; lectura real acotada solo en mantenimiento."""
import argparse
import datetime as dt
import hashlib
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import struct
import sys
import uuid

from captura_rt import (RTClient, UnsafeClosure, atomic_json, capacity,
                        diagnostic_module, persist_receipt, recover)
from coordinador import Coordinator
from outbox import Outbox
from protocolo import identifier

ROOT = Path(__file__).resolve().parent
SYNC = Path(r'C:\SanIsidro\ZKSync')
MANUAL = ROOT / 'datos' / 'lectura_mantenimiento'
PYTHON32 = Path(r'C:\Users\Dell\Python32\python.exe')
SERIAL = 'CO2K225060027'


def load_observed():
    try:
        value = json.loads((SYNC / 'registros' / 'estado.json').read_text(encoding='utf-8-sig'))
        return value if isinstance(value, dict) else None
    except (OSError, ValueError):
        return None


def stop_requested(folder, run_id):
    try:
        request = json.loads((folder / 'detener.json').read_text(encoding='utf-8-sig'))
        return request.get('pid') == os.getpid() and request.get('run_id') == run_id
    except (OSError, ValueError, AttributeError):
        return False


def request_stop():
    state = json.loads((MANUAL / 'estado.json').read_text(encoding='utf-8'))
    if state['phase'] == 'fault':
        print('Cierre inseguro registrado; revisar trabajador y evidencia antes de reanudar.')
        return
    if state['phase'] == 'stopped':
        print('El ensayo ya termino; no se cambio ninguna tarea.')
        return
    atomic_json(MANUAL / 'detener.json', {'pid': state['pid'], 'run_id': state['run_id']})
    print('PARADA SOLICITADA. Esperar Cierre coordinador antes de reanudar desde el gestor.')


def simulate():
    print('Simulando 150 segundos virtuales; sin SDK, red, Access ni tareas. Espere el resultado.', flush=True)
    folder = ROOT / 'datos' / ('simulacion_' + dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
    receipts = folder / 'originales'
    receipts.mkdir(parents=True)
    instant = [0.0]
    epoch = dt.datetime.now(dt.timezone.utc)
    stamp = lambda: (epoch + dt.timedelta(seconds=instant[0])).isoformat(timespec='microseconds')
    events, clients = [], []
    snapshot = {'protocol': 2, 'pid': 4242, 'phase': 'idle', 'consecutive_errors': 0,
                'last_ok_utc': '2026-10-24T00:00:00Z'}  # Fixture; nunca estado real.
    def probe():
        if any(not c.closed for c in clients):
            raise RuntimeError('Solapamiento SDK en simulacion.')
        events.append({'operation': 'cycle_probe', 'at': instant[0]})
        instant[0] += 2
    class SimulatedRT:
        def __init__(self):
            self.closed = False
            clients.append(self)
        def connect(self):
            if any(c is not self and not c.closed for c in clients):
                raise RuntimeError('Solapamiento entre lectores.')
            events.append({'operation': 'rt_connect', 'at': instant[0]})
        def read(self):
            raw = (b'2026-10-24 00:00:01,42,12345678,1,0,0,4\r\n' if not any(
                e['operation'] == 'rt_read' for e in events) else b'2026-10-24 00:00:02,0,0,0,255,0,0\r\n')
            start = stamp()
            instant[0] += .05
            key = persist_receipt(receipts, raw + b'\0' * (65536 - len(raw)), 1, start, stamp(),
                                  '2026-10-24T00:00:02-06:00', 'Central Standard Time (Mexico)')
            from captura_rt import receipt
            events.append({'operation': 'rt_read', 'at': instant[0]})
            return receipt(receipts, key)
        def close(self):
            self.closed = True
            events.append({'operation': 'rt_close', 'at': instant[0]})
    box = Outbox(folder / 'outbox.sqlite', '40000000-0000-4000-8000-000000000001', 'TEST-C3-001')
    try:
        run = Coordinator(box, probe, SimulatedRT, before_rt=lambda: capacity(receipts),
            observed_state=lambda: dict(snapshot), clock=lambda: instant[0],
            sleep=lambda seconds: instant.__setitem__(0, instant[0] + seconds), utc_now=stamp,
            sink=lambda state: atomic_json(folder / 'estado.json', state))
        state = run.run(seconds=150)
        before = box.health()['responses']
        recovered = recover(receipts, box)
        checks = {
            'ciclos_readonly_simulados': state['cycle_probe']['completed'] >= 2 and state['cycle_probe']['total_errors'] == 0,
            'clientes_cerrados': all(c.closed for c in clients),
            'originales_recuperados_sin_duplicar': recovered == before == box.health()['responses'],
            'hashes_originales': all(hashlib.sha256(row['raw']).hexdigest() == json.loads(row['metadata'])['sha256']
                                      for row in box.db.execute('SELECT raw,metadata FROM responses')),
            'vigencias_observadas_sin_reescribir': all(json.loads(row[0])['vigencias'] == snapshot
                for row in box.db.execute("SELECT body FROM messages WHERE endpoint='estado'")),
        }
        result = {'scope': 'simulacion_sin_sdk_red_access_tareas', 'checks': checks,
                  'clock': 'virtual_150_seconds', 'state': state, 'health': box.health(),
                  'events': events}
        atomic_json(folder / 'resultado.json', result)
        print(json.dumps({'result': 'simulation_ok' if all(checks.values()) else 'simulation_failed',
                          'checks': checks, 'health': box.health(), 'evidence': str(folder)}, indent=2))
        return 0 if all(checks.values()) else 1
    finally:
        box.close()


def manual(agent, seconds):
    if os.name != 'nt' or struct.calcsize('P') != 8:
        raise RuntimeError('La comparacion Access requiere el Python x64 instalado.')
    if ROOT.is_relative_to(SYNC.resolve()) or ROOT.is_relative_to(Path(r'C:\SanIsidro\GestionTags').resolve()):
        raise RuntimeError('Ejecutar desde carpeta nueva, fuera de instalaciones operativas.')
    # El ID debe provisionarse aparte para el serial real, no usar el TEST-C3-001.
    if agent == '6b293548-0312-4d06-9c1d-3a7e79c9c5a0':
        raise ValueError('El agente ficticio anterior no corresponde al serial real.')
    password = os.environ.get('SANISIDRO_ACCESS_PASSWORD')
    if password is None:
        raise RuntimeError('Usar el lanzador de ensayo con la credencial DPAPI instalada.')
    from referencia_vigencias import EXPECTED, ReferenceProbe
    for name, digest in EXPECTED.items():
        if hashlib.sha256((SYNC / name).read_bytes()).hexdigest() != digest:
            raise ValueError('Instalacion r2 distinta de la referencia; no ejecutar ensayo.')
    probe = ReferenceProbe(password)
    diag = diagnostic_module()
    run_id = str(uuid.uuid4())
    MANUAL.mkdir(parents=True, exist_ok=True)
    receipts = MANUAL / 'originales'
    handler = RotatingFileHandler(MANUAL / 'comparacion.log', maxBytes=2000000, backupCount=2, encoding='utf-8')
    logging.getLogger().addHandler(handler)
    logging.getLogger().setLevel(logging.INFO)
    box, unsafe = None, False
    try:
        with diag.maintenance_lock():
            box = Outbox(MANUAL / 'outbox.sqlite', agent, SERIAL)
            recovered = recover(receipts, box)
            def stopped():
                if stop_requested(MANUAL, run_id):
                    return True
                try:
                    maintenance = json.loads((diag.GESTOR / 'mantenimiento.json').read_text(encoding='utf-8-sig'))
                    return not maintenance.get('active') or (diag.GESTOR / 'revision_pendiente.json').exists()
                except (OSError, ValueError):
                    return True
            def sink(state):
                atomic_json(MANUAL / 'estado.json', state | {'run_id': run_id})
            run = Coordinator(box, probe, lambda: RTClient(receipts, PYTHON32),
                before_rt=lambda: capacity(receipts), stop=stopped,
                observed_state=load_observed, sink=sink)
            print('ENSAYO SOLO LECTURA: no aplicar fechas. Mantener gestor en mantenimiento.', flush=True)
            print('Recuperados de originales: ' + str(recovered), flush=True)
            state = run.run(seconds=seconds)
            print(json.dumps({'cycle_probe': state['cycle_probe'], 'reader_error': state['reader_error'],
                              'storage_error': state['storage_error'], 'health': box.health()}, indent=2))
            return 0 if not state['cycle_probe']['consecutive_errors'] and not state['reader_error'] and not state['storage_error'] else 1
    except UnsafeClosure:
        unsafe = True
        raise
    finally:
        if box is not None:
            box.close()
        logging.getLogger().removeHandler(handler)
        handler.close()
        if unsafe:
            print('CIERRE SDK NO CONFIRMADO LIMPIAMENTE. No reanudar automaticamente; revisar trabajador y evidencia.', flush=True)
        else:
            print('Cierre coordinador. Ahora Terminar y reanudar en el gestor y comprobar dos ciclos correctos.', flush=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--simular', action='store_true')
    mode.add_argument('--mantenimiento', action='store_true')
    mode.add_argument('--detener', action='store_true')
    parser.add_argument('--agente')
    parser.add_argument('--seconds', type=int, default=150)
    args = parser.parse_args(argv)
    try:
        if args.detener:
            request_stop()
            return 0
        if args.mantenimiento:
            if not args.agente or identifier(args.agente) != args.agente or not 5 <= args.seconds <= 180:
                raise ValueError('Proveer UUID de agente de ensayo del serial real y plazo de 5..180 s.')
            return manual(args.agente, args.seconds)
        return simulate()
    except (Exception, KeyboardInterrupt) as exc:
        print('ENSAYO INTERRUMPIDO: ' + type(exc).__name__ + '. Conservar evidencia; no compartir secretos.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
