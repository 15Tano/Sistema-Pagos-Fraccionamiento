"""Supervisor manual acotado de emisor sin SDK; usa solo backend aislado."""
import argparse
import contextlib
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
import uuid

from bucle_envio import run_sender
from vigilancia_envio import combined

ROOT = Path(__file__).resolve().parent
BASE = Path(r'C:\SanIsidro\CoordinadorEnsayo_20261024')
DESTINATION = 'http://127.0.0.1:18881/api/control-acceso/agente'
RELEASE = '2026.10.25-2'
FILES = {'envio_vigilado.py', 'bucle_envio.py', 'vigilancia_envio.py', 'simular_envio.py',
         'verificar_envio.ps1', 'LEEME_ENVIO_VIGILADO.md', 'tests/test_envio_vigilado.py',
         'runtime/entregar_coordinador.py', 'runtime/enlace_candidato.py',
         'runtime/control_operativo.py', 'runtime/salud_operativa.py',
         'runtime/outbox.py', 'runtime/protocolo.py', 'runtime/emisor.py', 'runtime/credencial.py'}


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def read(path, maximum=131072):
    path = Path(path)
    if path.stat().st_size > maximum:
        raise ValueError('Archivo excede limite.')
    value = json.loads(path.read_text(encoding='utf-8-sig'))
    if not isinstance(value, dict):
        raise ValueError('Objeto requerido.')
    return value


def save(path, value):
    path = Path(path)
    temporary = path.with_name(path.name + '.' + str(uuid.uuid4()) + '.tmp')
    operation = 'create_snapshot'
    try:
        with temporary.open('x', encoding='utf-8') as stream:
            json.dump(value, stream, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        operation = 'replace_snapshot'
        # Windows puede impedir replace mientras otro proceso mantiene un lector
        # sin FILE_SHARE_DELETE. Reintentar solo el reemplazo, nunca HTTP/ACK.
        for attempt in range(21):
            try:
                os.replace(temporary, path)
                break
            except PermissionError:
                if attempt == 20:
                    raise
                time.sleep(.05)
    except PermissionError as exc:
        exc.snapshot_operation = operation
        exc.snapshot_role = path.name if path.name in (
            'sender.json', 'closed.json', 'vigilancia.json', 'resultado.json',
            'request.json', 'estado_envio.json', 'detener_envio.json') else 'other_snapshot'
        raise
    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass  # No ocultar la causa original; no tocar el destino anterior.


def verify_package():
    manifest = read(ROOT / 'ENVIO_SHA256SUMS.json')
    rows = manifest['files']
    if manifest['release'] != RELEASE or len(rows) != len(FILES) or {r['name'] for r in rows} != FILES:
        raise ValueError('Manifiesto inesperado.')
    for row in rows:
        if hashlib.sha256((ROOT / row['name']).read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Fuentes diferentes del paquete.')


def load_runtime(name):
    # runtime solo contiene fuentes publicadas verificadas; no hay modulos SDK.
    path = ROOT / 'runtime' / (name + '.py')
    sys.path.insert(0, str(path.parent))
    try:
        spec = importlib.util.spec_from_file_location('_envio_' + name, path)
        result = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(result)
        return result
    finally:
        sys.path.pop(0)


@contextlib.contextmanager
def own_lock(path):
    import msvcrt
    with Path(path).open('a+b') as stream:
        if stream.tell() == 0:
            stream.write(b'0')
            stream.flush()
        stream.seek(0)
        msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        try:
            yield
        finally:
            stream.seek(0)
            msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)


def request_at(folder):
    folder = Path(folder).resolve()
    if folder.parent != (ROOT / 'datos' / 'sesiones').resolve() or str(uuid.UUID(folder.name)) != folder.name:
        raise ValueError('Solicitud fuera de sesiones propias.')
    value = read(folder / 'request.json', 8192)
    if (set(value) != {'protocol', 'parent_pid', 'run_id', 'seconds'} or value['protocol'] != 1 or
            type(value['parent_pid']) is not int or value['parent_pid'] < 1 or value['run_id'] != folder.name or
            type(value['seconds']) is not int or not 5 <= value['seconds'] <= 180):
        raise ValueError('Solicitud invalida.')
    return value


def parent_channel(stream, request):
    # Pipe heredado propio: EOF por muerte del padre solicita salida tras llamada en curso.
    line = stream.readline(4097)
    if len(line) > 4096 or json.loads(line) != {'parent_pid': request['parent_pid'], 'run_id': request['run_id']}:
        raise ValueError('Canal del propietario no confirmado.')
    stopped = threading.Event()
    def watch():
        try:
            stream.readline(4097)  # Cierre/EOF o mensaje posterior: terminar, nunca cambiar identidad.
        finally:
            stopped.set()
    threading.Thread(target=watch, daemon=True).start()
    return stopped.is_set


def worker(folder):
    request = request_at(folder)
    stop = parent_channel(sys.stdin, request)
    delivery, code, report, stage = None, 1, None, 'runtime'
    identity = {'pid': os.getpid(), 'run_id': request['run_id']}
    try:
        if stop():
            raise RuntimeError('El propietario ya termino.')
        module = load_runtime('entregar_coordinador')
        if module.URL != DESTINATION:
            raise ValueError('Solo backend aislado por tunel loopback18881.')
        if not (BASE / 'datos' / 'lectura_mantenimiento' / 'outbox.sqlite').is_file():
            raise RuntimeError('Falta almacen existente; no inicializar.')
        stage = 'open_store'
        delivery = module.Delivery(BASE)
        # Token solo se descifra en el hijo y nunca se pasa por argumentos/entorno/salida.
        stage = 'credential'
        transport = delivery.lib.sender.HttpTransport(module.URL,
            delivery.lib.secret.load(delivery.secret_file), local_trial=True, timeout=5)
        stage = 'sender_loop'
        report = run_sender(delivery, transport, identity, request['seconds'],
            lambda value: save(folder / 'sender.json', value), stop)
        code = 2 if report['stop_reason'] == 'blocked' else 0
    except BaseException as exc:
        report = {'protocol': 1, **identity, 'phase': 'fault', 'heartbeat_utc': now(),
                  'error_type': type(exc).__name__, 'error_stage': stage,
                  'os_errno': getattr(exc, 'errno', None) if type(getattr(exc, 'errno', None)) is int else None,
                  'os_winerror': getattr(exc, 'winerror', None) if type(getattr(exc, 'winerror', None)) is int else None,
                  'snapshot_operation': getattr(exc, 'snapshot_operation', None),
                  'snapshot_role': getattr(exc, 'snapshot_role', None)}
        save(folder / 'sender.json', report)
    finally:
        if delivery is not None:
            delivery.close()
        save(folder / 'closed.json', {'protocol': 1, **identity, 'exit_code': code, 'report': report})
    return code


def supervise(folder, request, observe, stopped, *, worker_command=None, clock=time.monotonic,
              sleep=time.sleep, grace=15):
    command = worker_command or [sys.executable, '-B', str(ROOT / 'envio_vigilado.py'), '--worker', str(folder)]
    child, clean, forced = None, False, False
    observed, watch, failure = None, None, None
    started = clock()
    try:
        child = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, text=True, encoding='utf-8',
            env={k: v for k, v in os.environ.items() if not k.upper().startswith('SANISIDRO_')},
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        identity = {'pid': child.pid, 'run_id': request['run_id']}
        child.stdin.write(json.dumps({'parent_pid': request['parent_pid'], 'run_id': request['run_id']}) + '\n')
        child.stdin.flush()
        next_observation = started
        while child.poll() is None and clock() - started < request['seconds'] and not stopped():
            if clock() >= next_observation:
                try:
                    observed = observe()
                except Exception as exc:
                    observed = {'status': 'desconocido', 'error_type': type(exc).__name__}
                next_observation = clock() + 10
            try:
                sender = read(folder / 'sender.json')
            except (OSError, ValueError):
                sender = None
            watch = combined(observed, sender, identity, dt.datetime.now(dt.timezone.utc))
            save(folder / 'vigilancia.json', watch)
            sleep(.25)
    except BaseException as exc:
        failure = type(exc).__name__
        raise
    finally:
        if child is not None:
            if child.stdin is not None:
                try:
                    child.stdin.close()  # Parada cooperativa del hijo; no toca SDK ni sync.lock.
                except OSError:
                    pass
            try:
                child.wait(timeout=grace)
            except subprocess.TimeoutExpired:
                forced = True
                child.kill()  # Solo este hijo HTTP sin SDK. Lease/UUID permiten recuperar pendientes.
                child.wait(timeout=5)
            try:
                closure = read(folder / 'closed.json')
                nested = closure.get('report')
                clean = (type(closure.get('protocol')) is int and closure['protocol'] == 1 and
                         type(closure.get('pid')) is int and closure['pid'] == child.pid and
                         closure.get('run_id') == request['run_id'] and
                         type(closure.get('exit_code')) is int and closure['exit_code'] == child.returncode and
                         child.returncode in (0, 2) and not forced and isinstance(nested, dict) and
                         nested.get('pid') == child.pid and nested.get('run_id') == request['run_id'] and
                         nested.get('phase') == ('blocked' if child.returncode == 2 else 'stopped'))
            except (OSError, ValueError):
                closure = None
            try:
                last_sender = read(folder / 'sender.json')
            except (OSError, ValueError):
                last_sender = None
            watch = combined(observed, last_sender, identity, dt.datetime.now(dt.timezone.utc), expected_stopped=clean)
            if not clean or failure is not None:
                watch['emisor'] = {'status': 'degradado', 'reason': 'supervisor_or_closure_fault'}
            save(folder / 'vigilancia.json', watch)
            fault = closure.get('report') if isinstance(closure, dict) else None
            error = None
            if (isinstance(fault, dict) and fault.get('phase') == 'fault' and fault.get('pid') == child.pid and
                    fault.get('run_id') == request['run_id']):
                error = {k: fault.get(k) for k in ('error_type', 'error_stage', 'os_errno', 'os_winerror',
                                                 'snapshot_operation', 'snapshot_role')}
            result = {'scope': 'supervisor_ensayo_emisor_sin_sdk', 'phase': 'stopped' if clean and failure is None else 'fault',
                'pid': os.getpid(), 'run_id': request['run_id'], 'worker_pid': child.pid,
                'worker_exit_code': child.returncode, 'worker_closure_confirmed': clean,
                'forced_own_sender_exit': forced, 'supervisor_error_type': failure,
                'ended_utc': now(), 'sender_report': closure.get('report') if clean else None, 'worker_error': error,
                'last_watch': watch}
            save(folder / 'resultado.json', result)
    return result


def manual(seconds):
    if os.name != 'nt' or type(seconds) is not int or not 5 <= seconds <= 180:
        raise ValueError('Windows, ensayo5..180s.')
    if any(ROOT.is_relative_to(Path(path).resolve()) for path in (r'C:\SanIsidro\ZKSync', r'C:\SanIsidro\GestionTags')):
        raise RuntimeError('Usar carpeta separada.')
    sessions = ROOT / 'datos' / 'sesiones'
    sessions.mkdir(parents=True, exist_ok=True)
    if (sum(p.stat().st_size for p in sessions.rglob('*') if p.is_file()) > 64 * 1024 * 1024 or
            shutil.disk_usage(sessions).free < 64 * 1024 * 1024):
        raise OSError('Sin capacidad para evidencia de ensayo.')
    with own_lock(ROOT / 'envio_supervisor.lock'):
        run_id = str(uuid.uuid4())
        folder = sessions / run_id
        folder.mkdir()
        request = {'protocol': 1, 'parent_pid': os.getpid(), 'run_id': run_id, 'seconds': seconds}
        save(folder / 'request.json', request)
        save(ROOT / 'estado_envio.json', {'pid': os.getpid(), 'run_id': run_id, 'phase': 'running'})
        stop_file = ROOT / 'detener_envio.json'
        def stopped():
            try:
                return read(stop_file) == {'pid': os.getpid(), 'run_id': run_id}
            except (OSError, ValueError):
                return False
        observer = load_runtime('enlace_candidato')
        try:
            result = supervise(folder, request, observer.health, stopped)
        finally:
            # El lock se libera solo tras recoger/supervisar salida del hijo.
            save(ROOT / 'estado_envio.json', {'pid': os.getpid(), 'run_id': run_id,
                'phase': 'stopped' if (folder / 'resultado.json').exists() and read(folder / 'resultado.json')['phase'] == 'stopped' else 'fault'})
        print(json.dumps(result, indent=2))
        print('Evidencia: ' + str(folder))
        return 0 if result['phase'] == 'stopped' and result['worker_exit_code'] == 0 else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--ensayo', action='store_true')
    mode.add_argument('--detener', action='store_true')
    mode.add_argument('--worker', type=Path)
    parser.add_argument('--seconds', type=int, default=120)
    args = parser.parse_args()
    try:
        verify_package()
        if args.worker:
            return worker(args.worker)
        if args.detener:
            value = read(ROOT / 'estado_envio.json')
            if value['phase'] != 'running' or type(value['pid']) is not int or value['pid'] < 1 or str(uuid.UUID(value['run_id'])) != value['run_id']:
                raise ValueError('Supervisor no activo o identidad invalida.')
            save(ROOT / 'detener_envio.json', {k: value[k] for k in ('pid', 'run_id')})
            print('Parada de emisor solicitada. Esperar resultado del supervisor; no afecta polling.')
            return 0
        return manual(args.seconds)
    except (Exception, KeyboardInterrupt) as exc:
        print('ENVIO NO CONFIRMADO: ' + type(exc).__name__ + '. Conservar cola/evidencia; no cambiar polling.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
