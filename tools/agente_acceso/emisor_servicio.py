"""Emisor independiente del servicio. SQLite/HTTP/DPAPI; sin importaciones SDK."""
import argparse
from collections import Counter
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
import uuid


def read(path):
    path = Path(path)
    for attempt in range(21):
        try:
            with path.open('rb') as stream:
                raw = stream.read(131073)
            if len(raw) > 131072:
                raise ValueError('Estado excedido.')
            return json.loads(raw.decode('utf-8-sig'))
        except PermissionError:
            if attempt == 20:
                raise
            time.sleep(.025)


def save(path, value):
    path = Path(path)
    raw = json.dumps(value, ensure_ascii=True, indent=2).encode('ascii')
    temporary = path.with_name(path.name + '.' + str(uuid.uuid4()) + '.tmp')
    try:
        with temporary.open('xb') as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        # En Windows un lector puede mantener un handle sin FILE_SHARE_DELETE.
        # Repetir SOLO replace; nunca repetir una peticion HTTP ni una escritura SDK.
        for attempt in range(21):
            try:
                os.replace(temporary, path)
                break
            except PermissionError:
                if attempt == 20:
                    raise
                time.sleep(.025)
    finally:
        if temporary.exists():
            temporary.unlink()


def utc():
    import datetime as dt
    return dt.datetime.now(dt.timezone.utc).isoformat()


def loop(box, sender, publish, stop, *, clock=time.monotonic, sleep=time.sleep, stamp=utc):
    counts = Counter()
    state = {'phase': 'starting', 'last_attempt_utc': None, 'last_ack_utc': None, 'last_outcome': None}
    def emit():
        publish(dict(state, heartbeat_utc=stamp(), outcomes=dict(counts)))
    emit()
    while not stop():
        if box.health()['paused']:
            state.update(phase='blocked', last_outcome='blocked')
            emit()
            break
        state.update(phase='sending', last_attempt_utc=stamp())
        emit()
        outcome = sender.once()  # Respeta ACK, leases, next_attempt y pausas persistidas.
        counts[outcome] += 1
        state['last_outcome'] = outcome
        if outcome == 'acked':
            state['last_ack_utc'] = stamp()
        state['phase'] = 'blocked' if outcome == 'blocked' else 'backoff' if outcome in ('retry', 'lease_reassigned') else 'idle'
        emit()
        if outcome == 'blocked':
            break
        sleep(.5)
    state['phase'] = 'stopped' if state['phase'] != 'blocked' else 'blocked'
    emit()
    return state


class ProcessSender:
    """Popen propio y canal de vida por stdin: EOF tambien detiene al huerfano."""
    def __init__(self, folder, base, *, python=sys.executable, command=None, timeout=25):
        self.folder, self.base = Path(folder), Path(base)
        self.run_id = str(uuid.uuid4())
        self.python, self.command, self.timeout = str(python), command, timeout
        self.child, self.started = None, False
        self.started_at = None

    def start(self):
        self.folder.mkdir(parents=True, exist_ok=False)
        save(self.folder / 'request.json', {'protocol': 1, 'run_id': self.run_id, 'base': str(self.base.resolve())})
        command = self.command or [self.python, '-B', str(Path(__file__).resolve()), '--worker', str(self.folder)]
        environment = {k: v for k, v in os.environ.items() if not k.upper().startswith('SANISIDRO_')}
        self.child = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, shell=False, env=environment,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        self.started = True
        self.started_at = time.monotonic()

    def snapshot(self):
        if self.child is None:
            return {'phase': 'not_started'}
        try:
            state = read(self.folder / 'sender.json')
        except FileNotFoundError:
            if self.child.poll() is None and time.monotonic() - self.started_at < 10:
                return {'phase': 'starting', 'process_exited': False}
            raise
        if state.get('pid') != self.child.pid or state.get('run_id') != self.run_id:
            raise RuntimeError('Estado del emisor de otra identidad.')
        value = dict(state)
        value['process_exited'] = self.child.poll() is not None
        return value

    def close(self):
        if not self.started:
            return True  # Popen nunca creo un hijo.
        child = self.child
        if child.stdin is not None and not child.stdin.closed:
            child.stdin.close()
        try:
            child.wait(timeout=self.timeout)
        except subprocess.TimeoutExpired:
            child.kill()  # Exclusivamente este Popen; no buscar/terminar PIDs externos.
            child.wait(timeout=5)
            return False
        try:
            result = read(self.folder / 'closed.json')
            state = read(self.folder / 'sender.json')
            return (child.returncode in (0, 2) and result == {'protocol': 1, 'pid': child.pid,
                'run_id': self.run_id, 'exit_code': child.returncode, 'report': state} and
                state.get('pid') == child.pid and state.get('run_id') == self.run_id and
                state.get('phase') == ('stopped' if child.returncode == 0 else 'blocked'))
        except (OSError, ValueError):
            return False


def parent_channel(stream):
    stopped = threading.Event()
    def watch():
        try:
            stream.buffer.read(1)
        finally:
            stopped.set()
    threading.Thread(target=watch, daemon=True).start()
    return stopped.is_set


def worker(folder):
    import entregar_coordinador as delivery_module
    folder = Path(folder)
    request = read(folder / 'request.json')
    if (set(request) != {'protocol', 'run_id', 'base'} or request['protocol'] != 1 or
            str(uuid.UUID(request['run_id'])) != request['run_id']):
        raise ValueError('Peticion de emisor invalida.')
    identity = {'protocol': 1, 'pid': os.getpid(), 'run_id': request['run_id']}
    stopped = parent_channel(sys.stdin)
    delivery, report, code = None, None, 1
    try:
        if Path(request['base']).resolve() != delivery_module.BASE.resolve():
            raise ValueError('Solo almacen real de ensayo conocido.')
        delivery = delivery_module.Delivery(delivery_module.BASE)
        # No heredar password Access/API del padre; cargar solo el token de ingesta propio.
        token = delivery.lib.secret.load(delivery.secret_file)
        transport = delivery.lib.sender.HttpTransport(delivery_module.URL, token, local_trial=True)
        sender = delivery.lib.sender.Sender(delivery.box, transport)
        def publish(value):
            nonlocal report
            report = dict(value, **identity)
            save(folder / 'sender.json', report)
        value = loop(delivery.box, sender, publish, stopped)
        code = 2 if value['phase'] == 'blocked' else 0
    except BaseException as exc:
        report = dict(identity, phase='fault', error_type=type(exc).__name__, heartbeat_utc=utc())
    finally:
        try:
            if delivery is not None:
                delivery.close()
        except BaseException as exc:
            code = 1
            report = dict(identity, phase='fault', error_type=type(exc).__name__, heartbeat_utc=utc())
        if report is not None:
            save(folder / 'sender.json', report)
            save(folder / 'closed.json', dict(identity, exit_code=code, report=report))
    return code


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker', type=Path, required=True)
    args = parser.parse_args()
    try:
        from paquete_servicio import verify_package
        verify_package()
        return worker(args.worker)
    except BaseException:
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
