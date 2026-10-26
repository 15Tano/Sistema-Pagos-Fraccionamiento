"""Snapshot selectivo DPAPI de C3/permisos y fechas Access; sin SDK ni CLI."""
import copy
import datetime as dt
import hashlib
import importlib.util
import json
import itertools
from pathlib import Path
import shutil
import uuid

import aplicacion_vigencias as app
import vigencias_candidato as core
import adaptadores_cierre as closures

MAX_BYTES=1024*1024
MAX_SNAPSHOTS=1024
MAX_STORE_BYTES=256*1024*1024
MIN_FREE_BYTES=64*1024*1024
CRYPTO_SHA='06d9e15b02a58fe0b8cc3fd10f2b3e1df531f1e753df82e2b7b75fdcb998744a'
_crypto=None


class ProtectedBackupError(RuntimeError):
    pass


def checked_path(path):
    """No seguir symlinks/junctions/reparse points, incluidos los ancestros."""
    path=Path(path).absolute()
    for part in (path,*path.parents):
        try: attributes=getattr(part.lstat(),'st_file_attributes',0)
        except FileNotFoundError: attributes=0
        if part.is_symlink() or attributes&0x400:
            raise ValueError('Ruta redirigida.')
    return path


def dpapi(data,decrypt=False):
    global _crypto
    if _crypto is None:
        root=Path(__file__).resolve().parent
        path=root/'envio'/'runtime'/'credencial.py'
        if not path.exists(): path=root/'credencial.py'  # Solo desarrollo local; mismo hash publicado.
        if hashlib.sha256(path.read_bytes()).hexdigest()!=CRYPTO_SHA:
            raise ProtectedBackupError('Protector diferente de referencia.')
        spec=importlib.util.spec_from_file_location('_snapshot_dpapi',path)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);_crypto=module.crypt
    return _crypto(data,decrypt=decrypt)


def permissions(rows,pin):
    if not isinstance(rows,list): raise ValueError('Permisos invalidos.')
    for row in rows:
        if (not isinstance(row,dict) or set(row)!={'Pin','AuthorizeTimezoneId','AuthorizeDoorId'} or
                row['Pin']!=pin or not all(core.number(v) for v in row.values())):
            raise ValueError('Permisos fuera del usuario.')
    if len({core.encoded(row) for row in rows})!=len(rows): raise ValueError('Permisos duplicados.')
    return sorted(copy.deepcopy(rows),key=core.encoded)


def validate(snapshot):
    if (not isinstance(snapshot,dict) or set(snapshot)!={'protocol','snapshot_id','created_utc','sdk_sha256','plan','user','permissions'} or
            type(snapshot['protocol']) is not int or snapshot['protocol']!=1 or snapshot['sdk_sha256']!=closures.SDK_HASH or
            str(uuid.UUID(snapshot['snapshot_id']))!=snapshot['snapshot_id']):
        raise ValueError('Snapshot invalido.')
    stamp=dt.datetime.fromisoformat(snapshot['created_utc'])
    if stamp.tzinfo is None or stamp.utcoffset()!=dt.timedelta(0): raise ValueError('UTC requerido.')
    plan=snapshot['plan'];app.validate_plan(plan);user=snapshot['user']
    if (not isinstance(user,dict) or set(user)!=core.USER_FIELDS or not all(core.text(v) for v in user.values()) or
            {key:user[key] for key in core.FIELDS}!=plan['c3_before']):
        raise ValueError('Usuario distinto del plan.')
    if snapshot['permissions']!=permissions(snapshot['permissions'],user['Pin']):
        raise ValueError('Permisos no canonicos.')


class Store:
    def __init__(self,root,*,crypt=dpapi,clock=app.utc_now):
        self.root=Path(root);self.crypt=crypt;self.clock=clock

    def admit(self,bytes_needed):
        # El padre debe conservar sync.lock/gate durante respaldo e intento.
        # No borrar snapshots, ni siquiera incompletos, para admitir otro cambio.
        root=checked_path(self.root);total=0
        if root.exists():
            folders=list(itertools.islice(root.iterdir(),MAX_SNAPSHOTS+1))
            if len(folders)>=MAX_SNAPSHOTS: raise ValueError('Limite de respaldos.')
            for folder in folders:
                checked_path(folder)
                if not folder.is_dir() or str(uuid.UUID(folder.name))!=folder.name:
                    raise ValueError('Contenido ajeno al almacen.')
                files=list(itertools.islice(folder.iterdir(),3))
                if len(files)>2: raise ValueError('Contenido ajeno al snapshot.')
                for path in files:
                    checked_path(path)
                    limit=8192 if path.name=='manifest.json' else MAX_BYTES
                    if path.name not in ('manifest.json','snapshot.dpapi') or not path.is_file() or path.stat().st_size>limit:
                        raise ValueError('Archivo ajeno/excedido.')
                    total+=path.stat().st_size
        if total+bytes_needed>MAX_STORE_BYTES: raise ValueError('Capacidad de respaldos agotada.')
        existing=root
        while not existing.exists(): existing=existing.parent
        if shutil.disk_usage(existing).free-bytes_needed<MIN_FREE_BYTES:
            raise ValueError('Reserva de disco insuficiente.')

    def seal(self,plan,user,permits):
        try:
            value={'protocol':1,'snapshot_id':str(uuid.uuid4()),'created_utc':self.clock().isoformat(),
                   'sdk_sha256':closures.SDK_HASH,'plan':copy.deepcopy(plan),'user':copy.deepcopy(user),
                   'permissions':permissions(permits,user.get('Pin'))}
            validate(value);raw=core.encoded(value)
            if len(raw)>MAX_BYTES: raise ValueError('Snapshot excedido.')
            encrypted=self.crypt(raw)
            if not isinstance(encrypted,bytes) or not 0<len(encrypted)<=MAX_BYTES or encrypted==raw:
                raise ValueError('Cifrado no confirmado.')
            if self.crypt(encrypted,decrypt=True)!=raw: raise ValueError('Roundtrip de proteccion distinto.')
            self.admit(len(encrypted)+8192)
            folder=self.root/value['snapshot_id'];folder.mkdir(parents=True,exist_ok=False)
            meta={'protocol':1,'snapshot_id':value['snapshot_id'],'created_utc':value['created_utc'],
                  'serial':core.SERIAL,'card':plan['card'],'plan_sha256':app.digest(plan),
                  'cipher_sha256':hashlib.sha256(encrypted).hexdigest()}
            core.durable(folder/'snapshot.dpapi',encrypted)
            core.durable(folder/'manifest.json',core.encoded(meta))
            # Leer desde disco y descifrar otra vez antes de permitir el siguiente paso.
            if self.open(value['snapshot_id'],plan_sha256=meta['plan_sha256'])!=value:
                raise ValueError('Snapshot persistido distinto.')
            return meta
        except Exception:
            # No imprimir errores de DPAPI ni valores privados del SDK.
            raise ProtectedBackupError('Respaldo protegido no confirmado; no escribir.') from None

    def open(self,snapshot_id,*,plan_sha256=None):
        try:
            if not isinstance(snapshot_id,str) or str(uuid.UUID(snapshot_id))!=snapshot_id:
                raise ValueError('Identificador invalido.')
            checked_path(self.root)
            folder=checked_path(self.root/snapshot_id)
            if folder.is_symlink() or folder.resolve().parent!=self.root.resolve(): raise ValueError('Directorio ajeno.')
            manifest=folder/'manifest.json';cipher=folder/'snapshot.dpapi'
            checked_path(manifest);checked_path(cipher)
            if not manifest.is_file() or not cipher.is_file() or manifest.stat().st_size>8192 or cipher.stat().st_size>MAX_BYTES:
                raise ValueError('Archivo ajeno/excedido.')
            meta=json.loads(manifest.read_bytes());encrypted=cipher.read_bytes()
            if (set(meta)!={'protocol','snapshot_id','created_utc','serial','card','plan_sha256','cipher_sha256'} or
                    type(meta['protocol']) is not int or meta['protocol']!=1 or meta['snapshot_id']!=snapshot_id or
                    meta['serial']!=core.SERIAL or hashlib.sha256(encrypted).hexdigest()!=meta['cipher_sha256'] or
                    (plan_sha256 is not None and meta['plan_sha256']!=plan_sha256)):
                raise ValueError('Manifiesto distinto.')
            raw=self.crypt(encrypted,decrypt=True)
            if not isinstance(raw,bytes) or len(raw)>MAX_BYTES: raise ValueError('Descifrado excedido.')
            value=json.loads(raw);validate(value)
            if (value['snapshot_id']!=snapshot_id or value['created_utc']!=meta['created_utc'] or
                    value['plan']['card']!=meta['card'] or app.digest(value['plan'])!=meta['plan_sha256']):
                raise ValueError('Contexto protegido distinto.')
            return value  # Solo en memoria del proceso autorizado; nunca imprimir este objeto.
        except Exception:
            raise ProtectedBackupError('No se pudo verificar/abrir el respaldo con este contexto.') from None
