"""Propiedad de sync.lock y permisos de conexion de hijos ligados al padre nativo.

No es autorizacion de fechas. No instala, habilita tareas ni sustituye DLL.
Las publicaciones de diagnostico siguen exigiendo mantenimiento como antes.
"""
import contextlib
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import time
import uuid

import adaptadores_cierre as closures
import respaldo_protegido as protected
import vigencias_candidato as core
from control_operativo import stamp
from emisor_servicio import read, save

SYNC = Path(r'C:\SanIsidro\ZKSync')


class OwnershipError(PermissionError):
    pass


def native_identity(pid):
    """PID mas nacimiento de kernel, imagen y proceso vivo; no confiar solo en PID."""
    if os.name != 'nt' or type(pid) is not int or pid < 1:
        raise OwnershipError('Identidad nativa Windows requerida.')
    from ctypes import wintypes
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.GetProcessTimes.argtypes = [wintypes.HANDLE, *([ctypes.POINTER(wintypes.FILETIME)] * 4)]
    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    handle = kernel.OpenProcess(0x1000 | 0x100000, False, pid)
    if not handle:
        raise OwnershipError('Padre no accesible.')
    try:
        if kernel.WaitForSingleObject(handle, 0) != 258:
            raise OwnershipError('Padre ya termino.')
        values = [wintypes.FILETIME() for _ in range(4)]
        if not kernel.GetProcessTimes(handle, *(ctypes.byref(value) for value in values)):
            raise OwnershipError('Nacimiento no confirmado.')
        length = wintypes.DWORD(32768)
        buffer = ctypes.create_unicode_buffer(length.value)
        if not kernel.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(length)):
            raise OwnershipError('Imagen no confirmada.')
        birth = (values[0].dwHighDateTime << 32) | values[0].dwLowDateTime
        return {'pid': pid, 'birth_ticks': str(birth), 'image': str(Path(buffer.value).resolve()).casefold()}
    finally:
        kernel.CloseHandle(handle)


@contextlib.contextmanager
def sync_lock(path):
    import msvcrt
    path = protected.checked_path(path)
    # Exigir archivo instalado: nunca crear/borrar el lock ni truncarlo.
    with path.open('r+b') as stream:
        stream.seek(0)
        msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        try:
            yield
        finally:
            stream.seek(0)
            msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)


def require_locked(path):
    import msvcrt
    with protected.checked_path(path).open('r+b') as stream:
        stream.seek(0)
        try:
            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            return
        msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
    raise OwnershipError('sync.lock no esta retenido.')


def file_digest(path):
    path = protected.checked_path(path)
    if path.stat().st_size > 1024 * 1024:
        raise OwnershipError('Fuente excedida.')
    return hashlib.sha256(path.read_bytes()).hexdigest()


class Owner:
    def __init__(self, root, *, startup_guard, recover_closed=lambda:None, identity=native_identity, crypt=protected.dpapi):
        if not callable(startup_guard):
            raise ValueError('Comprobacion operativa explicita requerida.')
        self.root = protected.checked_path(root)
        self.data = self.root / 'acceso-datos'
        self.guard_start = startup_guard
        self.recover_closed = recover_closed
        self.identity, self.crypt = identity, crypt
        self.active = False
        self.run_id = str(uuid.uuid4())
        self.folder = self.data / 'sesiones' / self.run_id

    def __enter__(self):
        self.guard_start()
        self.lock = sync_lock(self.root / 'sync.lock')
        self.lock.__enter__()
        try:
            self.guard_start()
            self.recover_closed()  # Solo archivos ya catalogados, bajo el lock, antes de verificar ledger caliente.
            core.check_operations(self.data / 'cierres')
            self.folder.mkdir(parents=True, exist_ok=False)
            self.record = {'protocol': 1, 'purpose': 'sdk_owner', 'run_id': self.run_id,
                'root': str(self.root.resolve()), 'native': self.identity(os.getpid()),
                'entry_sha256': file_digest(self.root / 'sincronizar_vigencias.py'),
                'config_sha256': file_digest(self.root / 'servicio-config.json'),
                'nonce': secrets.token_hex(32), 'serial': core.SERIAL}
            encrypted = self.crypt(core.encoded(self.record))
            core.durable(self.folder / 'owner.dpapi', encrypted)
            self.cap_hash = hashlib.sha256(encrypted).hexdigest()
            save(self.folder / 'owner.json', {'protocol': 1, 'phase': 'running',
                'run_id': self.run_id, 'pid': os.getpid(), 'cap_sha256': self.cap_hash})
            self.active = True
            return self
        except BaseException:
            self.lock.__exit__(None, None, None)
            raise

    def guard(self):
        # Mantenimiento solicita parar ENTRE planes. No rechazar a mitad de C3/Access.
        if (not self.active or file_digest(self.root / 'sincronizar_vigencias.py') != self.record['entry_sha256'] or
                file_digest(self.root / 'servicio-config.json') != self.record['config_sha256']):
            raise OwnershipError('Propietario/fuente ya no activos.')
        if any((self.data / name).exists() for name in ('revision_vigencias.json', 'cierre_inseguro.json')):
            raise OwnershipError('Cierre/revision operativa pendiente.')

    def grant(self, folder, operation_sha256):
        self.guard()
        folder = protected.checked_path(folder)
        if folder.parent.resolve() != (self.data / 'cierres').resolve():
            raise OwnershipError('Trabajador fuera del almacen operativo.')
        request = closures.request_at(folder / 'request.json')
        if not re.fullmatch('[a-f0-9]{64}', operation_sha256):
            raise OwnershipError('Operacion sin digest.')
        payload = {'protocol': 1, 'purpose': 'sdk_child', 'owner_run_id': self.run_id,
            'owner_cap_sha256': self.cap_hash, 'worker_id': request['worker_id'],
            'worker_run_id': request['run_id'], 'role': request['role'],
            'operation_sha256': operation_sha256, 'created_utc': closures.now()}
        core.durable(folder / 'owner_grant.dpapi', self.crypt(core.encoded(payload)))

    def __exit__(self, kind, value, trace):
        try:
            self.active = False
            save(self.folder / 'owner.json', {'protocol': 1, 'phase': 'closed',
                'run_id': self.run_id, 'pid': os.getpid(), 'cap_sha256': self.cap_hash})
        finally:
            self.lock.__exit__(kind, value, trace)


def checked_worker(folder, operation_sha256, *, root=SYNC, identity=native_identity,
                   crypt=protected.dpapi, locked=require_locked, utc=closures.now):
    """Comprobar antes de abrir DLL y antes de cada lectura; sin fechas concedidas."""
    root = protected.checked_path(root)
    folder = protected.checked_path(folder)
    if folder.parent.resolve() != (root / 'acceso-datos' / 'cierres').resolve():
        raise OwnershipError('Ruta de trabajador ajena.')
    request = closures.request_at(folder / 'request.json')
    path = folder / 'owner_grant.dpapi'
    if path.stat().st_size > 16384:
        raise OwnershipError('Permiso excedido.')
    grant = json.loads(crypt(path.read_bytes(), decrypt=True))
    expected_keys = {'protocol', 'purpose', 'owner_run_id', 'owner_cap_sha256', 'worker_id',
                     'worker_run_id', 'role', 'operation_sha256', 'created_utc'}
    if (set(grant) != expected_keys or type(grant['protocol']) is not int or grant['protocol'] != 1 or
            grant['purpose'] != 'sdk_child' or grant['operation_sha256'] != operation_sha256 or
            grant['worker_id'] != request['worker_id'] or grant['worker_run_id'] != request['run_id'] or
            grant['role'] != request['role'] or str(uuid.UUID(grant['owner_run_id'])) != grant['owner_run_id']):
        raise OwnershipError('Permiso de otra operacion.')
    age = (stamp(utc()) - stamp(grant['created_utc'])).total_seconds()
    if not 0 <= age <= 180:
        raise OwnershipError('Permiso de conexion vencido/futuro.')
    if any((folder / name).exists() for name in ('closed.json', 'parent_ack.json')):
        raise OwnershipError('Trabajador ya cerrado.')
    session = protected.checked_path(root / 'acceso-datos' / 'sesiones' / grant['owner_run_id'])
    cap_path = protected.checked_path(session / 'owner.dpapi')
    if cap_path.stat().st_size > 16384 or hashlib.sha256(cap_path.read_bytes()).hexdigest() != grant['owner_cap_sha256']:
        raise OwnershipError('Capacidad de otra sesion.')
    record = json.loads(crypt(cap_path.read_bytes(), decrypt=True))
    if (set(record) != {'protocol', 'purpose', 'run_id', 'root', 'native', 'entry_sha256', 'config_sha256', 'nonce', 'serial'} or
            type(record['protocol']) is not int or record['protocol'] != 1 or record['purpose'] != 'sdk_owner' or
            record['run_id'] != grant['owner_run_id'] or record['serial'] != core.SERIAL or
            record['root'] != str(root.resolve()) or not re.fullmatch('[a-f0-9]{64}', record['nonce']) or
            record['entry_sha256'] != file_digest(root / 'sincronizar_vigencias.py') or
            record['config_sha256'] != file_digest(root / 'servicio-config.json')):
        raise OwnershipError('Capacidad ajena/inconsistente.')
    state = read(session / 'owner.json')
    if state != {'protocol': 1, 'phase': 'running', 'run_id': record['run_id'],
                 'pid': record['native']['pid'], 'cap_sha256': grant['owner_cap_sha256']}:
        raise OwnershipError('Sesion ya cerrada o sustituida.')
    if identity(record['native']['pid']) != record['native']:
        raise OwnershipError('Nacimiento/imagen del padre no coinciden.')
    locked(root / 'sync.lock')
    return record
