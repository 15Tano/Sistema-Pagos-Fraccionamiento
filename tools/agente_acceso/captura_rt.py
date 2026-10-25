"""RT x86 de ensayo: originales en disco antes del IPC; ninguna escritura SDK."""
import argparse
import ctypes
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import sys
import threading
import uuid

from protocolo import identifier, utc

ROOT = Path(__file__).resolve().parent
MAX_RECEIPTS_BYTES = 128 * 1024 * 1024
RESERVE_BYTES = 64 * 1024 * 1024


class UnsafeClosure(RuntimeError):
    """No iniciar otro cliente SDK despues de un cierre no confirmado."""


def atomic_json(path, data):
    temporary = path.with_suffix('.tmp')
    with temporary.open('w', encoding='utf-8', newline='\n') as stream:
        json.dump(data, stream, ensure_ascii=True, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def capacity(folder):
    folder.mkdir(parents=True, exist_ok=True)
    size = sum(path.stat().st_size for path in folder.iterdir() if path.is_file())
    if size + 2 * 65536 > MAX_RECEIPTS_BYTES or shutil.disk_usage(folder).free < RESERVE_BYTES + 2 * 65536:
        raise OSError('Sin capacidad para guardar otro original RT.')


def persist_receipt(folder, raw_buffer, code, started, ended, local_time, timezone):
    key = str(uuid.uuid4())
    terminated = b'\0' in raw_buffer
    payload = raw_buffer.split(b'\0', 1)[0] if terminated else raw_buffer
    for suffix, data in [('buffer.bin', raw_buffer), ('payload.bin', payload)]:
        with (folder / (key + '.' + suffix)).open('xb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
    atomic_json(folder / (key + '.json'), {
        'response_id': key, 'sdk_return_code': code, 'started_utc': started, 'ended_utc': ended,
        'pc_local_time': local_time, 'windows_timezone': timezone, 'terminated': terminated,
        'payload_sha256': hashlib.sha256(payload).hexdigest(),
        'buffer_sha256': hashlib.sha256(raw_buffer).hexdigest(), 'buffer_bytes': len(raw_buffer)})
    return key


def receipt(folder, key):
    if identifier(key) != key:
        raise ValueError('UUID de original invalido.')
    meta = json.loads((folder / (key + '.json')).read_text(encoding='utf-8'))
    buffer = (folder / (key + '.buffer.bin')).read_bytes()
    payload = (folder / (key + '.payload.bin')).read_bytes()
    if (meta['response_id'] != key or not 0 < len(buffer) <= 65536 or
            type(meta['sdk_return_code']) is not int or
            hashlib.sha256(buffer).hexdigest() != meta['buffer_sha256'] or
            hashlib.sha256(payload).hexdigest() != meta['payload_sha256'] or
            len(buffer) != meta['buffer_bytes'] or type(meta['terminated']) is not bool or
            meta['terminated'] != (b'\0' in buffer) or payload != buffer.split(b'\0', 1)[0]):
        raise ValueError('Original o metadatos no coinciden.')
    if utc(meta['ended_utc']) < utc(meta['started_utc']):
        raise ValueError('Tiempos de captura invalidos.')
    return meta | {'raw': payload}


def capture_in_outbox(box, item):
    box.capture(item['raw'], 'rt', item['sdk_return_code'], item['started_utc'], item['ended_utc'],
                response_id=item['response_id'], pc_local_time=item['pc_local_time'],
                windows_timezone=item['windows_timezone'])


def recover(folder, box):
    folder.mkdir(parents=True, exist_ok=True)
    # No consumir mas RT si quedo un original incompleto de una interrupcion.
    keys = {p.name.split('.')[0] for p in folder.iterdir() if p.is_file()}
    count = 0
    for key in sorted(keys):
        item = receipt(folder, key)
        box.ensure_capture_capacity()
        capture_in_outbox(box, item)  # Mismo UUID: repeticion idempotente.
        count += 1
    return count


def diagnostic_module():
    path = ROOT / 'runtime' / 'lector_eventos.py'
    if not path.exists():
        path = ROOT.parent / 'diagnostico_eventos' / 'lector_eventos.py'
    spec = importlib.util.spec_from_file_location('_diagnostico_c3', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def worker(folder):
    diag = diagnostic_module()
    sdk, directory, info = diag.load_sdk()  # PE/hash/exports x86 ya validados en caseta.
    handle = None
    try:
        atomic_json(folder.parent / 'sdk_compatibilidad.json', info)
        for line in sys.stdin:
            try:
                command = json.loads(line)['command']
                if command == 'close':
                    break
                if command == 'connect':
                    if handle:
                        raise RuntimeError('Cliente ya conectado.')
                    diag.maintenance_guard()
                    handle = sdk.Connect(diag.CONNECTION)
                    if not handle:
                        raise RuntimeError('Conexion SDK rechazada.')
                    buffer = ctypes.create_string_buffer(4096)
                    code = sdk.GetDeviceParam(handle, buffer, len(buffer), b'~SerialNumber')
                    if code < 0 or b'\0' not in buffer.raw or buffer.value != ('~SerialNumber=' + diag.SERIAL).encode('ascii'):
                        raise RuntimeError('Identidad de controlador no confirmada.')
                    result = {'serial': diag.SERIAL}
                elif command == 'read' and handle:
                    capacity(folder)
                    buffer = ctypes.create_string_buffer(65536)
                    started = dt.datetime.now(dt.timezone.utc).isoformat(timespec='microseconds')
                    local = dt.datetime.now().astimezone().isoformat()
                    code = sdk.GetRTLog(handle, buffer, len(buffer))
                    ended = dt.datetime.now(dt.timezone.utc).isoformat(timespec='microseconds')
                    # No parsear ni responder antes de guardar bytes y metadatos.
                    try:
                        timezone = diag.pc_timezone()
                    except OSError:
                        timezone = None
                    key = persist_receipt(folder, buffer.raw, code, started, ended, local, timezone)
                    result = {'response_id': key}
                else:
                    raise RuntimeError('Comando RT no permitido.')
                print(json.dumps({'ok': True, 'result': result}), flush=True)
            except Exception as exc:
                print(json.dumps({'ok': False, 'error_type': type(exc).__name__}), flush=True)
                break
    finally:
        try:
            if handle:
                sdk.Disconnect(handle)
        finally:
            directory.close()


class RTClient:
    def __init__(self, folder, python32, *, worker_command=None):
        self.folder = Path(folder)
        self.folder.mkdir(parents=True, exist_ok=True)
        self.stderr = (self.folder.parent / 'rt_worker.stderr.log').open('a', encoding='utf-8')
        environment = {key: value for key, value in os.environ.items() if not key.upper().startswith('SANISIDRO_')}
        try:
            command = worker_command or [str(python32), '-B', str(Path(__file__).resolve()), '--worker', str(self.folder)]
            self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=self.stderr, text=True, env=environment,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except BaseException:
            self.stderr.close()
            raise
        self.replies = queue.Queue()
        self.thread = threading.Thread(target=self._read_replies, daemon=True)
        self.thread.start()

    def _read_replies(self):
        try:
            for line in self.process.stdout:
                self.replies.put(line)
        finally:
            self.replies.put(None)

    def _call(self, command):
        self.process.stdin.write(json.dumps({'command': command}) + '\n')
        self.process.stdin.flush()
        try:
            line = self.replies.get(timeout=25)
        except queue.Empty as exc:
            raise UnsafeClosure('SDK no respondio; comprobar cierre antes de otro ciclo.') from exc
        if line is None:
            raise RuntimeError('Trabajador SDK termino; revisar evidencia.')
        response = json.loads(line)
        if not response['ok']:
            raise RuntimeError('Trabajador SDK interrumpido: ' + response['error_type'])
        return response['result']

    def connect(self):
        self._call('connect')

    def read(self):
        result = self._call('read')
        return receipt(self.folder, result['response_id'])

    def close(self):
        forced = False
        if self.stderr.closed:
            return
        try:
            if self.process.poll() is None:
                try:
                    self.process.stdin.write('{"command":"close"}\n')
                    self.process.stdin.flush()
                except OSError:
                    pass
                try:
                    self.process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    forced = True
                    self.process.kill()  # Solo este trabajador, sin descendientes.
                    self.process.wait(timeout=10)
            if forced or self.process.returncode != 0:
                raise UnsafeClosure('Trabajador no termino limpiamente; no iniciar otro SDK.')
        finally:
            self.thread.join(timeout=1)
            for stream in (self.process.stdin, self.process.stdout):
                stream.close()
            self.stderr.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker', type=Path, required=True)
    worker(parser.parse_args().worker)
