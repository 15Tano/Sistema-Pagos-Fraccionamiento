"""Supervisor acotado de paquetes readonly/HTTP congelados; no instala tareas."""
import argparse
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import signal
import shutil
import subprocess
import sys
import threading
import uuid

from coordinacion_conjunta import coordinate

ROOT = Path(__file__).resolve().parent
DATA = Path(r'C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento')
SDK_STATE = DATA / 'estado_cierres.json'
SDK_STOP = DATA / 'detener_cierres.json'
PYTHON32 = r'C:\Users\Dell\Python32\python.exe'
RELEASE = '2026.10.25-1'
MONITOR = Path(r'C:\SanIsidro\ZKSync\vigilar_sync.py')
MONITOR_HASH = '204fc781b9d632c0decc7e11122ebcf6b9d1729191467e26d3ce67ebfcc4c1cd'
OWN = {'ensayo_conjunto.py', 'coordinacion_conjunta.py', 'simular_conjunto.py',
       'verificar_conjunto.ps1', 'LEEME_CONJUNTO.md', 'tests/test_conjunto.py',
       'lector_conjunto.py', 'lanzar_lector_conjunto.ps1'}
_modules = {}


def load(name, folder):
    key = (name, str(folder))
    if key not in _modules:
        sys.path.insert(0, str(folder))
        try:
            spec = importlib.util.spec_from_file_location('_conjunto_' + name, folder / (name + '.py'))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            _modules[key] = module
        finally:
            sys.path.pop(0)
    return _modules[key]


def emitter():
    return load('envio_vigilado', ROOT / 'envio')


def sdk_control():
    return load('adaptadores_cierre', ROOT / 'lector')


def inspector():
    return load('enlace_candidato', ROOT / 'envio' / 'runtime')


def verify_package():
    manifest = json.loads((ROOT / 'CONJUNTO_SHA256SUMS.json').read_text(encoding='utf-8-sig'))
    rows = manifest['files']
    names = [row['name'] for row in rows]
    if (manifest['release'] != RELEASE or len(names) != len(set(names)) or len(names) != len(OWN) + 36 or
            set(n for n in names if '/' not in n or n.startswith('tests/')) != OWN or
            sum(n.startswith('lector/') for n in names) != 20 or sum(n.startswith('envio/') for n in names) != 16):
        raise ValueError('Manifiesto inesperado.')
    for row in rows:
        name = row['name']
        if PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or '\\' in name:
            raise ValueError('Ruta de paquete invalida.')
        if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Fuente distinta del paquete.')


def stamp(value):
    value = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if value.tzinfo is None or value.utcoffset() != dt.timedelta(0):
        raise ValueError('UTC explicito requerido.')
    return value


def identity(value):
    if (not isinstance(value, dict) or type(value.get('pid')) is not int or value['pid'] < 1 or
            not isinstance(value.get('run_id'), str) or str(uuid.UUID(value['run_id'])) != value['run_id']):
        raise ValueError('Identidad invalida.')
    return {k: value[k] for k in ('pid', 'run_id')}


def script_entry(args):
    positions = [i for i, arg in enumerate(args[1:], 1) if arg.lower().endswith('.py')]
    if len(positions) != 1 or any(arg not in ('-B', '-u', '-E', '-s') for arg in args[1:positions[0]]):
        return None
    return Path(args[positions[0]]).resolve()


def safe_inventory():
    snapshot = inspector().inventory()
    # Vigilar r2 no usa SDK. Excepcion SOLO para ruta/bytes conocidos; no ignorar
    # procesos desconocidos ni emisores mientras todavia estan vivos.
    for row in snapshot['processes']:
        if row.get('role') != 'other_sanisidro':
            continue
        try:
            args = inspector().argv_windows(row['command'])
            if script_entry(args) == MONITOR.resolve() and hashlib.sha256(MONITOR.read_bytes()).hexdigest() == MONITOR_HASH:
                row['role'] = 'external'
        except (OSError, ValueError, KeyError):
            pass
    return snapshot


def native_sdk_process(pid, started):
    if type(pid) is not int or pid < 1:
        return False
    # PID es entero validado; commandline solo se usa internamente para validar ruta.
    command = "$ErrorActionPreference='Stop'; $p=Get-CimInstance Win32_Process -Filter 'ProcessId=" + str(pid) + "'; if($null -eq $p){exit 2}; [pscustomobject]@{name=$p.Name;command=$p.CommandLine;created_utc=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress"
    process = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command],
        capture_output=True, timeout=25, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        env={k: v for k, v in os.environ.items() if not k.upper().startswith('SANISIDRO_')})
    if process.returncode:
        return False
    row = json.loads(process.stdout.decode('utf-8-sig'))
    args = inspector().argv_windows(row['command'])
    delta = (stamp(started) - stamp(row['created_utc'])).total_seconds()
    return (row.get('name', '').lower() in ('python.exe', 'pythonw.exe') and
            script_entry(args) == (ROOT / 'lector_conjunto.py').resolve() and
            '--mantenimiento' in args and 0 <= delta <= 300)


class Hooks:
    def __init__(self, session, started, previous):
        self.session, self.started, self.previous = session, started, previous
        self.children = {}

    def start(self, role, seconds):
        if role == 'sdk':
            command = ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                       str(ROOT / 'lanzar_lector_conjunto.ps1'), '-Seconds', str(seconds)]
        else:
            command = [PYTHON32, '-B', str(ROOT / 'envio' / 'envio_vigilado.py'), '--ensayo', '--seconds', str(seconds)]
        process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            env={k: v for k, v in os.environ.items() if not k.upper().startswith('SANISIDRO_')},
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        self.children[role] = process
        return process

    def bind(self, role, process):
        path = SDK_STATE if role == 'sdk' else ROOT / 'envio' / 'estado_envio.json'
        try:
            value = emitter().read(path)
        except (OSError, ValueError):
            return None
        target = identity(value)
        if role == 'sender':
            return target if target['pid'] == process.pid and value.get('phase') == 'running' else None
        if (target == self.previous or stamp(value['started_utc']) < stamp(self.started) or
                not stamp(value['started_utc']) <= stamp(value['heartbeat_utc']) <= dt.datetime.now(dt.timezone.utc) or
                value.get('scope') != 'ensayo_coordinador_sin_escrituras_sdk' or
                value.get('adapter_version') != '2026.10.24-1' or value.get('phase') in ('stopped', 'fault')):
            return None
        return target if native_sdk_process(target['pid'], value['started_utc']) else None

    def request(self, role, target):
        path = SDK_STATE if role == 'sdk' else ROOT / 'envio' / 'estado_envio.json'
        if identity(emitter().read(path)) != target:
            raise RuntimeError('Cambio de ejecucion antes de parada.')
        emitter().save(SDK_STOP if role == 'sdk' else ROOT / 'envio' / 'detener_envio.json', target)

    def health(self):
        return inspector().outbox_health()

    def proof(self, role, target, returncode):
        if role == 'sender':
            path = ROOT / 'envio' / 'datos' / 'sesiones' / target['run_id'] / 'resultado.json'
            value = emitter().read(path)
            if (identity(value) != target or value.get('phase') != 'stopped' or
                    value.get('worker_closure_confirmed') is not True or value.get('forced_own_sender_exit') is not False or
                    returncode not in (0, 1) or value.get('worker_exit_code') not in (0, 2)):
                raise RuntimeError('Salida del supervisor/hijo HTTP no confirmada.')
            return value
        value = emitter().read(SDK_STATE)
        if (identity(value) != target or value.get('phase') != 'stopped' or
                value.get('scope') != 'ensayo_coordinador_sin_escrituras_sdk' or
                value.get('adapter_version') != '2026.10.24-1' or
                value.get('stop_reason') not in ('limit', 'requested') or
                value.get('sdk_gate') != {'fault': False, 'active': None} or returncode not in (0, 1)):
            raise RuntimeError('Cierre del lector no confirmado.')
        module = sdk_control()
        with module.diagnostic_module().maintenance_lock():
            inspector().require_no_readers(safe_inventory(), target['pid'])
            count = module.check_ledger(DATA / 'cierres')
            requests = [emitter().read(path, 8192) for path in (DATA / 'cierres').glob('*/request.json')]
            inventories = sum(r.get('run_id') == target['run_id'] and r.get('role') == 'vigencias' for r in requests)
            completed = value.get('cycle_probe', {}).get('completed')
            if type(completed) is not int or completed < 0 or inventories < completed or emitter().read(SDK_STATE) != value:
                raise RuntimeError('Recibos de esta ejecucion/estado final no confirmados.')
        return {'identity': target, 'closures_acknowledged_total': count, 'state': value}

    def unsafe_sdk(self):
        emitter().save(DATA / 'cierre_inseguro.json', {'reason': 'joint_sdk_exit_unconfirmed',
            'pid': os.getpid(), 'checked_utc': emitter().now()})

    def publish(self, value):
        value = {'scope': 'ensayo_conjunto_readonly', 'pid': os.getpid(),
                 'run_id': self.session.name, 'heartbeat_utc': emitter().now(), **value}
        emitter().save(self.session / 'estado.json', value)


def manual(seconds):
    if os.name != 'nt' or not 5 <= seconds <= 150:
        raise ValueError('Windows y ventana5..150s.')
    if any(ROOT.is_relative_to(Path(p).resolve()) for p in (r'C:\SanIsidro\ZKSync', r'C:\SanIsidro\GestionTags')):
        raise RuntimeError('Usar carpeta separada.')
    if not (DATA / 'outbox.sqlite').is_file():
        raise RuntimeError('Falta almacen existente.')
    module = sdk_control()
    module.diagnostic_module().maintenance_guard()
    module.check_ledger(DATA / 'cierres')
    previous = identity(emitter().read(SDK_STATE))
    if emitter().read(SDK_STATE).get('phase') != 'stopped':
        raise RuntimeError('Ensayo anterior no detenido.')
    sessions = ROOT / 'datos' / 'sesiones'
    sessions.mkdir(parents=True, exist_ok=True)
    if sum(p.stat().st_size for p in sessions.rglob('*') if p.is_file()) > 64 * 1024 * 1024 or shutil.disk_usage(sessions).free < 64 * 1024 * 1024:
        raise OSError('Sin capacidad para evidencia conjunta.')
    with emitter().own_lock(ROOT / 'conjunto.lock'):
        if (ROOT / 'revision_conjunto.json').exists():
            raise RuntimeError('Ensayo conjunto anterior pendiente de revision.')
        if (ROOT / 'estado_conjunto.json').exists() and emitter().read(ROOT / 'estado_conjunto.json').get('phase') != 'stopped':
            raise RuntimeError('Ejecucion conjunta anterior incompleta; conservar evidencia.')
        session = sessions / str(uuid.uuid4())
        session.mkdir()
        run = {'pid': os.getpid(), 'run_id': session.name, 'phase': 'running'}
        emitter().save(ROOT / 'estado_conjunto.json', run)
        hooks = Hooks(session, emitter().now(), previous)
        stop_event = threading.Event()
        old_signal = signal.signal(signal.SIGINT, lambda *_: stop_event.set())
        def stopped():
            try:
                return stop_event.is_set() or emitter().read(ROOT / 'detener_conjunto.json') == identity(run)
            except (OSError, ValueError):
                return stop_event.is_set()
        try:
            print('CONJUNTO SOLO LECTURA. Mantener mantenimiento; esperar FIN conjunto. Parada propia con --detener.', flush=True)
            result = coordinate(hooks, seconds, stopped)
            library = emitter().load_runtime('entregar_coordinador')
            delivery = library.Delivery(Path(r'C:\SanIsidro\CoordinadorEnsayo_20261024'))
            try:
                integrity = delivery.report()
            finally:
                delivery.close()
            result |= {'pid': os.getpid(), 'run_id': session.name, 'ended_utc': emitter().now(),
                       'queue': integrity['health'], 'final_integrity_report': integrity,
                       'delivery_complete': integrity['health']['pending_count'] == 0 and not integrity['health']['paused']}
            sdk_state = (result.get('sdk_proof') or {}).get('state', {})
            result['reader_ok'] = (result['sdk_returncode'] == 0 and sdk_state.get('reader_error') is None and
                sdk_state.get('storage_error') is None and sdk_state.get('cycle_probe', {}).get('total_errors') == 0)
            result['sender_ok'] = (result['sender_returncode'] == 0 and
                (result.get('sender_proof') or {}).get('worker_exit_code') == 0)
            result['trial_passed'] = result['phase'] == 'stopped' and result['reader_ok'] and result['sender_ok'] and result['delivery_complete']
            emitter().save(session / 'resultado.json', result)
            if result['phase'] != 'stopped':
                emitter().save(ROOT / 'revision_conjunto.json', identity(run))
            emitter().save(ROOT / 'estado_conjunto.json', run | {'phase': result['phase']})
            print(json.dumps(result, indent=2))
            print('Evidencia: ' + str(session))
            print('FIN conjunto. Verificar cierre conjunto antes de reanudar por gestor.' if result['phase'] == 'stopped' else
                  'CIERRE CONJUNTO NO CONFIRMADO. Conservar mantenimiento y evidencia.')
            return 0 if result['trial_passed'] else 1
        finally:
            signal.signal(signal.SIGINT, old_signal)


def verify_closed():
    run = emitter().read(ROOT / 'estado_conjunto.json')
    target = identity(run)
    if run.get('phase') != 'stopped' or (ROOT / 'revision_conjunto.json').exists():
        raise RuntimeError('Ensayo conjunto no terminado o pendiente de revision.')
    session = ROOT / 'datos' / 'sesiones' / target['run_id']
    result = emitter().read(session / 'resultado.json')
    if identity(result) != target or result.get('safe_to_resume_candidate') is not True:
        raise RuntimeError('Resultado conjunto no confirmado.')
    snapshot = safe_inventory()
    inspector().require_no_readers(snapshot, target['pid'])
    pids = {result['sdk_launcher_pid'], result['sdk_identity']['pid'], result['sender_identity']['pid'],
            result['sender_proof']['worker_pid']}
    if any(p['pid'] in pids for p in snapshot['processes']):
        raise RuntimeError('Proceso propio aun presente o PID reutilizado.')
    hooks = Hooks(session, emitter().now(), None)
    hooks.proof('sender', result['sender_identity'], result['sender_returncode'])
    hooks.proof('sdk', result['sdk_identity'], result['sdk_returncode'])
    if emitter().read(ROOT / 'estado_conjunto.json') != run:
        raise RuntimeError('Cambio de ejecucion durante comprobacion.')
    print(json.dumps({'status': 'cierre_conjunto_confirmado', **target, 'checked_utc': emitter().now()}, indent=2))
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--mantenimiento', action='store_true')
    mode.add_argument('--detener', action='store_true')
    mode.add_argument('--verificar-cierre', action='store_true')
    parser.add_argument('--seconds', type=int, default=150)
    args = parser.parse_args()
    try:
        verify_package()
        if args.verificar_cierre:
            return verify_closed()
        if args.detener:
            value = emitter().read(ROOT / 'estado_conjunto.json')
            if value['phase'] != 'running':
                raise RuntimeError('Ensayo no activo o pendiente de revision.')
            emitter().save(ROOT / 'detener_conjunto.json', identity(value))
            print('Parada conjunta solicitada. Esperar FIN conjunto, no reanudar antes.')
            return 0
        return manual(args.seconds)
    except (Exception, KeyboardInterrupt) as exc:
        print('CONJUNTO NO CONFIRMADO: ' + type(exc).__name__ + '. Conservar mantenimiento/evidencia.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
