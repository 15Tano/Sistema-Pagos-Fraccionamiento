"""Adaptadores readonly con recibos de cierre; no cargan SDK al importarse."""
import argparse
import csv
import ctypes
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import uuid

import captura_rt
from captura_rt import RTClient, UnsafeClosure, atomic_json, diagnostic_module
from control_operativo import stamp
from referencia_vigencias import load_reference
from trabajador_controlado import SDKGate, UnsafeSDKClosure, run_closed_worker

ROOT = Path(__file__).resolve().parent
SDK_HASH = '82bda08dbbab24b918ebe7de68eeb3e4fb952f275eecc992cb9148c5384a413a'
MAX_RESPONSE = 16 * 1024 * 1024
MAX_LEDGER = 64 * 1024 * 1024


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='microseconds')


def bounded_json(path, limit=8192):
    if path.stat().st_size > limit:
        raise ValueError('Archivo excede limite.')
    value = json.loads(path.read_text(encoding='utf-8-sig'))
    if not isinstance(value, dict):
        raise ValueError('Objeto requerido.')
    return value


def request_at(path):
    path = Path(path).resolve()
    value = bounded_json(path)
    if (set(value) != {'protocol', 'role', 'run_id', 'worker_id', 'receipts_dir'} or
            type(value['protocol']) is not int or value['protocol'] != 1 or
            value['role'] not in ('rt', 'vigencias') or
            any(str(uuid.UUID(value[key])) != value[key] for key in ('run_id', 'worker_id')) or
            path.name != 'request.json' or path.parent.name != value['worker_id']):
        raise ValueError('Solicitud de trabajador invalida.')
    if value['role'] == 'rt':
        expected = path.parent.parent.parent / 'originales'
        if not isinstance(value['receipts_dir'], str) or Path(value['receipts_dir']).resolve() != expected.resolve():
            raise ValueError('Directorio RT ajeno a este ensayo.')
    elif value['receipts_dir'] is not None:
        raise ValueError('Inventario no recibe directorio RT.')
    return value


def new_session(base, run_id, role):
    base = Path(base)
    base.mkdir(parents=True, exist_ok=True)
    size = sum(path.stat().st_size for path in base.rglob('*') if path.is_file())
    if size + MAX_RESPONSE > MAX_LEDGER or shutil.disk_usage(base).free < MAX_RESPONSE + 64 * 1024 * 1024:
        raise OSError('Sin capacidad para otro trabajador/recibo.')
    key = str(uuid.uuid4())
    folder = base / key
    folder.mkdir()
    atomic_json(folder / 'request.json', {'protocol': 1, 'role': role, 'run_id': run_id,
        'worker_id': key, 'receipts_dir': str((base.parent / 'originales').resolve()) if role == 'rt' else None})
    request_at(folder / 'request.json')
    return folder


def write_closure(folder, request, *, started, closed, operation_ok, sdk_sha256,
                  error_type=None, response=None):
    atomic_json(Path(folder) / 'closed.json', {
        'protocol': 1, 'role': request['role'], 'run_id': request['run_id'],
        'worker_id': request['worker_id'], 'pid': os.getpid(), 'closed': closed,
        'operation_ok': operation_ok, 'error_type': error_type, 'sdk_sha256': sdk_sha256,
        'started_utc': started, 'ended_utc': now(),
        'response_bytes': len(response) if response is not None else None,
        'response_sha256': hashlib.sha256(response).hexdigest() if response is not None else None,
    })


def verified_closure(folder, expected_pid):
    folder = Path(folder)
    request = request_at(folder / 'request.json')
    value = bounded_json(folder / 'closed.json')
    required = {'protocol', 'role', 'run_id', 'worker_id', 'pid', 'closed', 'operation_ok',
                'error_type', 'sdk_sha256', 'started_utc', 'ended_utc', 'response_bytes', 'response_sha256'}
    if (set(value) != required or type(value['protocol']) is not int or value['protocol'] != 1 or
            type(value['pid']) is not int or type(expected_pid) is not int or expected_pid < 1 or value['pid'] != expected_pid or
            value['closed'] is not True or type(value['operation_ok']) is not bool or
            value['sdk_sha256'] != SDK_HASH or
            any(value[key] != request[key] for key in ('role', 'run_id', 'worker_id')) or
            stamp(value['ended_utc']) < stamp(value['started_utc'])):
        raise ValueError('Recibo de cierre no confirmado.')
    if value['operation_ok'] and request['role'] == 'vigencias':
        response = (folder / 'response.json').read_bytes() if (folder / 'response.json').stat().st_size <= MAX_RESPONSE else None
        if (response is None or type(value['response_bytes']) is not int or len(response) != value['response_bytes'] or
                hashlib.sha256(response).hexdigest() != value['response_sha256'] or value['error_type'] is not None):
            raise ValueError('Inventario y recibo no coinciden.')
    elif value['response_bytes'] is not None or value['response_sha256'] is not None:
        raise ValueError('Respuesta inesperada.')
    if ((value['operation_ok'] and value['error_type'] is not None) or
            (not value['operation_ok'] and (not isinstance(value['error_type'], str) or not value['error_type']))):
        raise ValueError('Resultado de trabajador incoherente.')
    return value


def acknowledge(folder, pid):
    verified_closure(folder, pid)
    atomic_json(Path(folder) / 'parent_ack.json', {'protocol': 1, 'pid': pid, 'exit_code': 0,
        'closure_sha256': hashlib.sha256((Path(folder) / 'closed.json').read_bytes()).hexdigest()})


def check_ledger(base):
    """No reiniciar SDK tras padre caido o cierre sin confirmacion del padre."""
    base = Path(base)
    if (base.parent / 'cierre_inseguro.json').exists():
        raise UnsafeClosure('Cierre inseguro previo requiere revision.')
    if not base.exists():
        return 0
    count = 0
    try:
        for folder in base.iterdir():
            if not folder.is_dir():
                raise ValueError('Entrada inesperada en ledger.')
            ack = bounded_json(folder / 'parent_ack.json')
            if (set(ack) != {'protocol', 'pid', 'exit_code', 'closure_sha256'} or
                    type(ack['protocol']) is not int or ack['protocol'] != 1 or
                    type(ack['exit_code']) is not int or ack['exit_code'] != 0 or
                    ack['closure_sha256'] != hashlib.sha256((folder / 'closed.json').read_bytes()).hexdigest()):
                raise ValueError('Falta confirmacion durable del padre.')
            verified_closure(folder, ack['pid'])
            count += 1
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as exc:
        raise UnsafeClosure('Trabajador anterior incompleto; conservar evidencia.') from exc
    return count


def fatal(gate, base, run_id, reason):
    gate.fault = True
    try:
        atomic_json(Path(base).parent / 'cierre_inseguro.json', {
            'run_id': run_id, 'pid': os.getpid(), 'reason': reason, 'checked_utc': now()})
    finally:
        raise UnsafeClosure('Cierre/identidad SDK pendientes de revision; no abrir otro cliente.')


def parse_inventory(raw, code):
    if type(code) is not int or code < 1:
        raise ValueError('Inventario SDK vacio/invalido.')
    reader = csv.DictReader(io.StringIO(raw.decode('utf-8', errors='strict')))
    fields = {'CardNo', 'Pin', 'StartTime', 'EndTime'}
    if not reader.fieldnames or not fields <= set(reader.fieldnames) or len(reader.fieldnames) != len(set(reader.fieldnames)):
        raise ValueError('Campos de inventario invalidos.')
    result = {}
    for row in reader:
        if None in row or any(value is None for value in row.values()) or not row['CardNo'] or row['CardNo'] in result:
            raise ValueError('Inventario incompleto/duplicado.')
        result[row['CardNo']] = {key: row[key] for key in fields}
    if len(result) != code:
        raise ValueError('Recuento SDK distinto de filas.')
    return result


class ControllerIdentityError(RuntimeError):
    pass


def inventory_worker(folder, request):
    started, sdk, directory, handle, sdk_hash = now(), None, None, None, None
    clean, response, operation_ok, error = True, None, False, None
    try:
        diag = diagnostic_module()
        diag.maintenance_guard()
        sdk, directory, info = diag.load_sdk()
        sdk_hash = info['sha256']
        handle = sdk.Connect(diag.CONNECTION)
        if not handle:
            raise RuntimeError('Conexion rechazada.')
        serial = ctypes.create_string_buffer(4096)
        code = sdk.GetDeviceParam(handle, serial, len(serial), b'~SerialNumber')
        if code < 0 or b'\0' not in serial.raw or serial.value != ('~SerialNumber=' + diag.SERIAL).encode('ascii'):
            raise ControllerIdentityError('Serial no confirmado.')
        buffer = ctypes.create_string_buffer(4 * 1024 * 1024)
        code = sdk.GetDeviceData(handle, buffer, len(buffer), b'user', b'*', b'', b'')
        if b'\0' not in buffer.raw:
            raise ValueError('Inventario sin terminador.')
        result = parse_inventory(buffer.value, code)
        response = json.dumps(result, ensure_ascii=True, separators=(',', ':')).encode('ascii')
        if len(response) > MAX_RESPONSE:
            raise ValueError('Inventario demasiado grande.')
        # Solo cuatro campos utiles; nunca persistir Password/Group del inventario.
        with (Path(folder) / 'response.json').open('xb') as stream:
            stream.write(response)
            stream.flush()
            os.fsync(stream.fileno())
        operation_ok = True
    except Exception as exc:
        error, response = type(exc).__name__, None
    finally:
        try:
            if handle:
                clean = False
                sdk.Disconnect(handle)
                clean = True
        except BaseException:
            clean = False
        finally:
            try:
                if directory is not None:
                    directory.close()
            except BaseException:
                clean = False
        write_closure(folder, request, started=started, closed=clean, operation_ok=operation_ok,
                      sdk_sha256=sdk_hash, error_type=error, response=response)
    return 0 if clean else 1


def rt_worker(folder, request):
    started, clean, error, sdk_hash = now(), False, None, None
    try:
        captura_rt.worker(Path(request['receipts_dir']))
        info = bounded_json(Path(request['receipts_dir']).parent / 'sdk_compatibilidad.json', 16384)
        sdk_hash = info['sha256']
        clean = True  # worker() ya retorno de Disconnect y directory.close.
    except BaseException as exc:
        error = type(exc).__name__
    write_closure(folder, request, started=started, closed=clean, operation_ok=clean,
                  sdk_sha256=sdk_hash, error_type=error)
    return 0 if clean else 1


class SafeReferenceProbe:
    def __init__(self, password, gate, base, python32, run_id, *, worker_timeout=300):
        self.password, self.gate, self.base = password, gate, Path(base)
        self.python32, self.run_id = str(python32), run_id
        self.worker_timeout = worker_timeout
        self.module = load_reference()
        (Path(self.module.ROOT) / 'registros').mkdir(exist_ok=True)
        self.module.worker = self.read_inventory

    def read_inventory(self, payload):
        if payload != {'mode': 'read'}:
            raise ValueError('Este adaptador no permite escrituras SDK.')
        folder = new_session(self.base, self.run_id, 'vigencias')
        try:
            child = run_closed_worker(self.gate, 'vigencias',
                [self.python32, '-B', str(Path(__file__).resolve()), '--worker', str(folder / 'request.json')],
                verify_closed=lambda worker: bool(verified_closure(folder, worker.pid)), timeout=self.worker_timeout)
            acknowledge(folder, child.pid)
        except Exception:
            fatal(self.gate, self.base, self.run_id, 'vigencias_close_unconfirmed')
        closed = verified_closure(folder, child.pid)
        if not closed['operation_ok']:
            if closed['error_type'] in ('ControllerIdentityError', 'OSError', 'PermissionError', 'FileNotFoundError'):
                fatal(self.gate, self.base, self.run_id, 'controller_identity_unconfirmed')
            raise RuntimeError('Lectura de inventario interrumpida; SDK cerrado y evidencia conservada.')
        return bounded_json(folder / 'response.json', MAX_RESPONSE)

    def __call__(self):
        self.module.cycle(self.password, False, None)


class SafeRTClient:
    def __init__(self, gate, base, python32, run_id, *, client_factory=RTClient):
        self.gate, self.base, self.python32, self.run_id = gate, Path(base), str(python32), run_id
        self.factory, self.client, self.folder, self.acquired = client_factory, None, None, False

    def connect(self):
        try:
            self.gate.acquire('rt')
            self.acquired = True
        except (RuntimeError, UnsafeSDKClosure):
            fatal(self.gate, self.base, self.run_id, 'rt_turn_unavailable')
        try:
            self.folder = new_session(self.base, self.run_id, 'rt')
            self.client = self.factory(self.base.parent / 'originales', self.python32,
                worker_command=[self.python32, '-B', str(Path(__file__).resolve()), '--worker', str(self.folder / 'request.json')])
            self.client.connect()
        except BaseException as exc:
            self.close()
            if isinstance(exc, UnsafeClosure):
                fatal(self.gate, self.base, self.run_id, 'rt_connect_unconfirmed')
            raise

    def read(self):
        if not self.acquired or self.client is None:
            raise RuntimeError('RT no conectado.')
        try:
            return self.client.read()
        except UnsafeClosure:
            fatal(self.gate, self.base, self.run_id, 'rt_call_unconfirmed')

    def close(self):
        if not self.acquired:
            return
        clean = False
        try:
            if self.client is None:
                raise UnsafeClosure('Inicio del trabajador sin cierre confirmado.')
            self.client.close()
            acknowledge(self.folder, self.client.process.pid)
            clean = True
        except BaseException:
            fatal(self.gate, self.base, self.run_id, 'rt_close_unconfirmed')
        finally:
            self.acquired = False
            self.gate.release('rt', clean=clean)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker', type=Path, required=True)
    args = parser.parse_args()
    try:
        request = request_at(args.worker)
        return (rt_worker if request['role'] == 'rt' else inventory_worker)(args.worker.parent, request)
    except Exception:
        # Sin traceback, payloads, argumentos ni datos de inventario.
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
