"""Comparar r2 y nucleo candidato contra API/Access/C3; ninguna aplicacion ni RT."""
import argparse
import csv
import datetime as dt
import hashlib
import importlib.util
import json
import logging
from pathlib import Path, PurePosixPath
import os
import signal
import shutil
import struct
import sys
import threading
import uuid

import adaptadores_cierre as closures
import vigencias_candidato as core
from captura_rt import UnsafeClosure
from referencia_vigencias import EXPECTED
from trabajador_controlado import SDKGate

ROOT = Path(__file__).resolve().parent
DATA = Path(r'C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento')
SYNC = Path(r'C:\SanIsidro\ZKSync')
OWN = {'puente_sdk_readonly.py', 'ensayo_puente_readonly.py', 'tests/test_puente_sdk_readonly.py',
       'simular_puente_readonly.py', 'verificar_puente_readonly.ps1', 'lanzar_puente_readonly.ps1',
       'LEEME_PUENTE_READONLY.md'}
MONITOR_SHA = '204fc781b9d632c0decc7e11122ebcf6b9d1729191467e26d3ce67ebfcc4c1cd'
_modules = {}


def load(name, folder):
    key = (name, str(folder))
    if key not in _modules:
        sys.path.insert(0, str(folder))
        try:
            spec = importlib.util.spec_from_file_location('_puente_' + name, folder / (name + '.py'))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            _modules[key] = module
        finally:
            sys.path.pop(0)
    return _modules[key]


def publisher():
    return load('envio_vigilado', ROOT / 'envio')


def inspector():
    return load('enlace_candidato', ROOT / 'envio' / 'runtime')


def verify_package():
    value = json.loads((ROOT / 'PUENTE_SHA256SUMS.json').read_text(encoding='utf-8-sig'))
    names = [row['name'] for row in value['files']]
    if (value['release'] != '2026.10.25-1' or len(names) != 45 or len(set(names)) != 45 or
            not OWN <= set(names) or sum(name.startswith('envio/') for name in names) != 16):
        raise ValueError('Manifiesto inesperado.')
    for row in value['files']:
        name = row['name']
        if (PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or
                '\\' in name or ':' in name or
                hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != row['sha256']):
            raise ValueError('Fuente/ruta diferente del paquete.')


def identity(state):
    if (not isinstance(state, dict) or type(state.get('pid')) is not int or state['pid'] < 1 or
            not isinstance(state.get('run_id'), str) or str(uuid.UUID(state['run_id'])) != state['run_id']):
        raise ValueError('Identidad invalida.')
    return {key: state[key] for key in ('pid', 'run_id')}


def quiet(snapshot, forbidden=()):
    for row in snapshot['processes']:
        if row['pid'] in forbidden:
            raise RuntimeError('Proceso previo presente o PID reutilizado.')
        if row['role'] == 'other_sanisidro':
            try:
                args = inspector().argv_windows(row['command'])
                scripts = [i for i, arg in enumerate(args[1:], 1) if arg.lower().endswith('.py')]
                if (len(scripts) == 1 and all(arg in ('-B', '-u', '-E', '-s') for arg in args[1:scripts[0]]) and
                        Path(args[scripts[0]]).resolve() == (SYNC / 'vigilar_sync.py').resolve() and
                        hashlib.sha256((SYNC / 'vigilar_sync.py').read_bytes()).hexdigest() == MONITOR_SHA):
                    continue
            except (OSError, ValueError, KeyError):
                pass
        if row['role'] not in ('control', 'sender', 'external'):
            raise RuntimeError('Cerrar lectores/paneles ajenos antes de continuar.')


def plan(folder):
    paths = list((Path(folder) / 'registros').glob('plan_*.csv'))
    if len(paths) != 1 or paths[0].stat().st_size > closures.MAX_RESPONSE:
        raise ValueError('Un plan readonly completo requerido.')
    with paths[0].open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != ['tag', 'vigencia_api', 'estado', 'cambiar_access', 'cambiar_c3']:
            raise ValueError('Columnas de plan inesperadas.')
        result = {}
        for row in reader:
            if (None in row or any(value is None for value in row.values()) or not core.number(row['tag']) or
                    row['tag'] in result or row['estado'] not in ('EXISTENTE', 'NO_ENCONTRADO') or
                    row['cambiar_access'] not in ('True', 'False') or row['cambiar_c3'] not in ('True', 'False')):
                raise ValueError('Plan incompleto/duplicado.')
            result[row['tag']] = {key: value for key, value in row.items() if key != 'tag'}
    if not result:
        raise ValueError('Plan vacio.')
    return result


def compare(reference, candidate):
    missing = sorted(set(reference) - set(candidate))
    added = sorted(set(candidate) - set(reference))
    changed = sorted(k for k in reference.keys() & candidate.keys() if reference[k] != candidate[k])
    return {'equal': not (missing or added or changed), 'reference_rows': len(reference),
            'candidate_rows': len(candidate), 'missing_count': len(missing), 'added_count': len(added),
            'changed_count': len(changed), 'sample_tags': (missing + added + changed)[:10],
            'reference_sha256': hashlib.sha256(core.encoded(reference)).hexdigest(),
            'candidate_sha256': hashlib.sha256(core.encoded(candidate)).hexdigest(),
            'meaning': 'Dos consultas secuenciales. Una diferencia requiere revisar API/datos/tiempos; no atribuye causa.'}


def pair(reference, candidate, folders, stop, publish):
    completed = []
    for name, cycle in (('reference', reference), ('candidate', candidate)):
        if stop():
            return {'completed': completed, 'comparison': None, 'stop_reason': 'requested'}
        publish({'stage': name, 'heartbeat_utc': closures.now()})
        cycle()
        completed.append(name)
    return {'completed': completed, 'comparison': compare(plan(folders[0]), plan(folders[1])), 'stop_reason': 'completed'}


def receipts(run_id):
    total = core.check_operations(DATA / 'cierres')
    rows = []
    for path in (DATA / 'cierres').glob('*/request.json'):
        request = closures.request_at(path)
        if request['run_id'] == run_id:
            if request['role'] != 'vigencias':
                raise ValueError('Turno ajeno en prueba de comparacion.')
            ack = closures.bounded_json(path.parent / 'parent_ack.json')
            closures.verified_closure(path.parent, ack['pid'])
            if (path.parent / 'operation.json').exists() and json.loads((path.parent / 'operation.json').read_bytes()) != {'mode': 'read'}:
                raise ValueError('Operacion no readonly.')
            rows.append({'worker_id': request['worker_id'], 'pid': ack['pid']})
    return {'total': total, 'current': sorted(rows, key=lambda item: item['worker_id'])}


def manual():
    if os.name != 'nt' or struct.calcsize('P') != 8:
        raise RuntimeError('Usar lanzador x64 con DPAPI.')
    if any(ROOT.is_relative_to(Path(p).resolve()) for p in (SYNC, r'C:\SanIsidro\GestionTags')):
        raise RuntimeError('Usar carpeta separada.')
    diag = closures.diagnostic_module()
    diag.maintenance_guard()
    for name, digest in EXPECTED.items():
        if hashlib.sha256((SYNC / name).read_bytes()).hexdigest() != digest:
            raise RuntimeError('Instalacion r2 diferente.')
    if not os.environ.get('SANISIDRO_ACCESS_PASSWORD'):
        raise RuntimeError('Usar lanzador DPAPI.')
    if (DATA / 'revision_vigencias.json').exists():
        raise core.ReviewRequired('Revision de vigencias pendiente.')
    core.check_operations(DATA / 'cierres')
    sessions = ROOT / 'datos' / 'sesiones'
    sessions.mkdir(parents=True, exist_ok=True)
    if sum(path.stat().st_size for path in sessions.rglob('*') if path.is_file()) > 64 * 1024 * 1024 or shutil.disk_usage(sessions).free < 64 * 1024 * 1024:
        raise OSError('Sin capacidad para evidencia de comparacion.')
    with publisher().own_lock(ROOT / 'puente.lock'), diag.maintenance_lock():
        quiet(inspector().inventory())
        previous_path = ROOT / 'estado_puente.json'
        if previous_path.exists() and publisher().read(previous_path).get('phase') != 'stopped':
            raise RuntimeError('Ejecucion anterior incompleta.')
        session = sessions / str(uuid.uuid4())
        session.mkdir()
        state = {'pid': os.getpid(), 'run_id': session.name, 'phase': 'running', 'started_utc': closures.now()}
        def publish(extra):
            state.update(extra)
            publisher().save(previous_path, state)
            publisher().save(session / 'estado.json', state)
        publish({'stage': 'starting'})
        event = threading.Event()
        old_signal = signal.signal(signal.SIGINT, lambda *_: event.set())
        def stopped():
            try:
                maintenance = publisher().read(diag.GESTOR / 'mantenimiento.json')
                if maintenance.get('active') is not True or (diag.GESTOR / 'revision_pendiente.json').exists():
                    return True
            except (OSError, ValueError):
                return True
            try:
                return event.is_set() or publisher().read(ROOT / 'detener_puente.json') == identity(state)
            except (OSError, ValueError):
                return event.is_set()
        result = None
        try:
            gate = SDKGate()
            reference = closures.SafeReferenceProbe(os.environ['SANISIDRO_ACCESS_PASSWORD'], gate,
                DATA / 'cierres', r'C:\Users\Dell\Python32\python.exe', session.name)
            reference.module.ROOT = session / 'referencia'
            (reference.module.ROOT / 'registros').mkdir(parents=True)
            def safe_error(message, *args):
                logging.error(message, *(type(v).__name__ if isinstance(v, BaseException) else v for v in args))
            reference.module.logging = type('SafeLogging', (), {'info': staticmethod(logging.info), 'error': staticmethod(safe_error)})
            exchange = core.Exchange(gate, DATA / 'cierres', session.name,
                lambda folder, digest: [r'C:\Users\Dell\Python32\python.exe', '-B',
                    str(ROOT / 'puente_sdk_readonly.py'), '--worker', str(folder), '--sha256', digest])
            candidate = core.ReferenceCycle(os.environ['SANISIDRO_ACCESS_PASSWORD'], exchange,
                session / 'candidato', apply=False)
            print('PUENTE SOLO LECTURA: una comparacion r2 y otra candidata. Sin RT ni aplicar fechas.', flush=True)
            result = pair(reference, candidate, (reference.module.ROOT, candidate.module.ROOT), stopped, publish)
            proof = receipts(session.name)
            quiet(inspector().inventory(), [row['pid'] for row in proof['current']])
            if len(proof['current']) != len(result['completed']):
                raise UnsafeClosure('Recibos de esta ejecucion no coinciden.')
            result |= {'phase': 'stopped', 'receipts': proof, 'error_type': None}
        except (Exception, KeyboardInterrupt) as exc:
            # Conservador: no declarar cierre final con un fallo no revisado.
            result = {'phase': 'fault', 'error_type': type(exc).__name__, 'trial_passed': False}
        finally:
            signal.signal(signal.SIGINT, old_signal)
            result = result or {'phase': 'fault', 'error_type': 'IncompleteRun', 'trial_passed': False}
            result |= identity(state) | {'ended_utc': closures.now()}
            result['trial_passed'] = (result['phase'] == 'stopped' and result.get('comparison') is not None and result['comparison']['equal'])
            publisher().save(session / 'resultado.json', result)
            publish({'phase': result['phase'], 'stage': 'finished', 'heartbeat_utc': closures.now()})
        print(json.dumps(result, indent=2))
        print('Evidencia: ' + str(session))
        print('FIN puente. Verificar cierre antes de reanudar.' if result['phase'] == 'stopped' else
              'PUENTE NO CONFIRMADO. Conservar mantenimiento y evidencia.')
        return 0 if result['trial_passed'] else 1


def verify_closed():
    state = publisher().read(ROOT / 'estado_puente.json')
    target = identity(state)
    result = publisher().read(ROOT / 'datos' / 'sesiones' / target['run_id'] / 'resultado.json')
    if state.get('phase') != 'stopped' or result.get('phase') != 'stopped' or identity(result) != target:
        raise RuntimeError('Prueba no cerrada.')
    with closures.diagnostic_module().maintenance_lock():
        proof = receipts(target['run_id'])
        if proof != result['receipts'] or (DATA / 'revision_vigencias.json').exists():
            raise UnsafeClosure('Cambio de recibos/revision pendiente.')
        forbidden = [target['pid']] + [row['pid'] for row in proof['current']]
        quiet(inspector().inventory(), forbidden)
        if publisher().read(ROOT / 'estado_puente.json') != state:
            raise RuntimeError('Cambio de ejecucion durante comprobacion.')
    print(json.dumps({'status': 'cierre_puente_confirmado', **target, 'checked_utc': closures.now()}, indent=2))
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--mantenimiento', action='store_true')
    mode.add_argument('--detener', action='store_true')
    mode.add_argument('--verificar-cierre', action='store_true')
    args = parser.parse_args()
    stage = 'verify_package'
    try:
        verify_package()
        stage = 'verify_closure' if args.verificar_cierre else 'stop_request' if args.detener else 'readonly_preflight_or_run'
        if args.verificar_cierre:
            return verify_closed()
        if args.detener:
            state = publisher().read(ROOT / 'estado_puente.json')
            if state.get('phase') != 'running':
                raise RuntimeError('Prueba no activa.')
            publisher().save(ROOT / 'detener_puente.json', identity(state))
            print('Parada solicitada; esperar FIN puente y verificar cierre.')
            return 0
        return manual()
    except (Exception, KeyboardInterrupt) as exc:
        print(json.dumps({'status': 'puente_no_confirmado', 'stage': stage, 'error_type': type(exc).__name__}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
