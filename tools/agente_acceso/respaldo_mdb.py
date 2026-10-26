"""Copia MDB exclusiva y validacion aislada. Sin SDK, HTTP ni restauracion CLI."""
import contextlib
import ctypes
import hashlib
import itertools
import json
import os
from pathlib import Path
import shutil
import subprocess
import uuid

import aplicacion_vigencias as app
import respaldo_protegido as protected
import vigencias_candidato as core

ROOT=Path(__file__).resolve().parent
CHUNK=1024*1024
MAX_MDB_BYTES=512*1024*1024
MAX_BACKUPS=32
MAX_STORE_BYTES=2*1024*1024*1024
MIN_FREE_BYTES=64*1024*1024
TABLES={
    'USERINFO':{'userid','cardno','acc_startdate','acc_enddate','set_valid_time'},
    'CHECKINOUT':{'userid'},
    'acc_levelset':{'id'},
    'acc_levelset_emp':{'employee_id','acclevelset_id'},
    'personnel_issuecard':{'userid_id','cardno'},
}


class MDBBackupError(RuntimeError):
    pass


def private_directory(folder):
    protected.checked_path(folder)
    environment={key:value for key,value in os.environ.items() if not key.upper().startswith('SANISIDRO_')}
    result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden',
        '-ExecutionPolicy','Bypass','-File',str(ROOT/'carpeta_privada_mdb.ps1'),'-Ruta',str(folder)],
        env=environment,capture_output=True,text=True,timeout=20,
        creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    if result.returncode!=0 or result.stdout.strip()!='private_directory_ok':
        raise ValueError('Directorio privado no confirmado.')


@contextlib.contextmanager
def exclusive_source(path):
    """CreateFileW GENERIC_READ/OPEN_EXISTING, share=0. Nunca abrir para escribir."""
    if os.name!='nt': raise OSError('Requiere Windows.')
    import msvcrt
    path=protected.checked_path(path)
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    create=kernel.CreateFileW
    create.argtypes=[ctypes.c_wchar_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p,
                     ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p]
    create.restype=ctypes.c_void_p
    kernel.CloseHandle.argtypes=[ctypes.c_void_p];kernel.CloseHandle.restype=ctypes.c_int
    handle=create(str(path),0x80000000,0,None,3,0x80,None)
    if handle in (None,ctypes.c_void_p(-1).value): raise OSError('No se obtuvo lectura exclusiva MDB.')
    try: descriptor=msvcrt.open_osfhandle(handle,os.O_RDONLY|os.O_BINARY)
    except BaseException:
        kernel.CloseHandle(handle);raise
    try: stream=os.fdopen(descriptor,'rb')
    except BaseException:
        os.close(descriptor);raise
    with stream: yield stream


def file_hash(path):
    digest=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda:stream.read(CHUNK),b''): digest.update(chunk)
    return digest.hexdigest()


def admit(root,size):
    root=protected.checked_path(root)
    total=0
    if root.exists():
        folders=list(itertools.islice(root.iterdir(),MAX_BACKUPS+1))
        if len(folders)>=MAX_BACKUPS: raise ValueError('Limite de respaldos MDB.')
        for folder in folders:
            protected.checked_path(folder)
            if not folder.is_dir() or str(uuid.UUID(folder.name))!=folder.name: raise ValueError('Directorio ajeno.')
            files=list(itertools.islice(folder.iterdir(),4))
            if len(files)>3: raise ValueError('Contenido ajeno.')
            for path in files:
                protected.checked_path(path)
                limit={'Database_PRO_antes.mdb':MAX_MDB_BYTES,'Database_PRO_antes.ldb':1024*1024,'manifest.json':16384}.get(path.name)
                if limit is None or not path.is_file() or path.stat().st_size>limit: raise ValueError('Archivo ajeno/excedido.')
                total+=path.stat().st_size
    if total+size+16384>MAX_STORE_BYTES: raise ValueError('Capacidad MDB agotada.')
    existing=root
    while not existing.exists(): existing=existing.parent
    if shutil.disk_usage(existing).free-size-16384<MIN_FREE_BYTES: raise ValueError('Reserva de disco insuficiente.')


def connect_copy(path,password):
    import pyodbc
    if (not isinstance(password,str) or password!=password.strip() or
            any(ord(char)<32 or char==';' for char in password)):
        raise ValueError('Credencial incompatible con este conector.')
    # ACE interpreta Dbq entre llaves como nombre literal: ruta simple validada.
    if any(char in str(path) for char in ';{}\r\n\0'): raise ValueError('Ruta ODBC incompatible.')
    # ACE tambien interpreta PWD entre llaves literalmente (MDB protegida probada).
    # No intentar variantes de clave ni inyectar separadores. No modificar r2.
    return pyodbc.connect('Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq='+str(path)+';PWD='+password+';',
                          readonly=True,autocommit=False,timeout=15)


def validate_copy(path,password,plan,*,connect=connect_copy):
    connection=connect(path,password)
    try:
        if connection.autocommit is not False: raise ValueError('Transaccion readonly requerida.')
        counts={}
        for name,required in TABLES.items():
            cursor=connection.cursor()
            try:
                cursor.execute('SELECT * FROM ['+name+'] WHERE 1 = 0')
                columns={column[0].lower() for column in cursor.description}
                if not required<=columns: raise ValueError('Esquema incompatible.')
                row=cursor.execute('SELECT COUNT(*) FROM ['+name+']').fetchone()
                if row is None or type(row[0]) is not int or row[0]<0: raise ValueError('Recuento invalido.')
                counts[name]=row[0]
            finally: cursor.close()
        before=app.AccessDates(connection).read(plan['card'])
        if before!=plan['access_before']: raise ValueError('La copia difiere del alcance preparado.')
        return {'table_counts':counts,'access_before_sha256':app.digest(before)}
    finally:
        try: connection.rollback()
        finally: connection.close()


def create_backup(source,root,password,plan,*,guard,source_open=exclusive_source,
                  private=private_directory,connect=connect_copy):
    """Biblioteca para padre bajo sync.lock/mantenimiento; no modifica la fuente.

    guard debe comprobar mantenimiento y exclusion ya adquirida. No hay entrada
    operativa ni se emite Approval; dependencias sustituibles solo en pruebas.
    """
    try:
        app.validate_plan(plan)
        plan=json.loads(core.encoded(plan))
        source=protected.checked_path(source);root=protected.checked_path(root)
        if source.suffix.lower()!='.mdb' or source.is_relative_to(root): raise ValueError('Ruta fuera de alcance.')
        guard()
        with source_open(source) as stream:
            before=os.fstat(stream.fileno())
            if not 0<before.st_size<=MAX_MDB_BYTES: raise ValueError('MDB vacia/excedida.')
            admit(root,before.st_size);root.mkdir(parents=True,exist_ok=True)
            folder=root/str(uuid.uuid4());private(folder)
            target=folder/'Database_PRO_antes.mdb'
            digest=hashlib.sha256();copied=0
            with target.open('xb') as output:
                for chunk in iter(lambda:stream.read(CHUNK),b''):
                    copied+=len(chunk)
                    if copied>before.st_size: raise ValueError('Fuente cambio durante copia.')
                    output.write(chunk);digest.update(chunk)
                output.flush();os.fsync(output.fileno())
            after=os.fstat(stream.fileno())
            if (copied!=before.st_size or target.stat().st_size!=copied or
                    before.st_size!=after.st_size or before.st_mtime_ns!=after.st_mtime_ns or
                    file_hash(target)!=digest.hexdigest()):
                raise ValueError('Copia diferente/incompleta.')
        guard()  # El bloqueo operativo debe seguir adquirido tras cerrar el archivo.
        validation=validate_copy(target,password,plan,connect=connect)
        if file_hash(target)!=digest.hexdigest(): raise ValueError('La validacion altero la copia.')
        receipt={'protocol':1,'backup_id':folder.name,'created_utc':app.utc_now().isoformat(),
                 'serial':plan['serial'],'card':plan['card'],'plan_sha256':app.digest(plan),
                 'mdb_bytes':copied,'mdb_sha256':digest.hexdigest(),'validation':validation,
                 'status':'copy_verified','approval_issued':False}
        core.durable(folder/'manifest.json',core.encoded(receipt))
        if json.loads((folder/'manifest.json').read_bytes())!=receipt: raise ValueError('Recibo distinto.')
        return receipt
    except Exception:
        # ODBC puede incluir PWD/datos personales; conservar carpeta y omitir detalle.
        raise MDBBackupError('Respaldo MDB no confirmado; conservar evidencia, no aplicar.') from None
