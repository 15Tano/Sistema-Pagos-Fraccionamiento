"""Verificacion autocontenida: no importa SDK ni abre credenciales."""
import hashlib
import json
from pathlib import Path,PurePosixPath

ROOT=Path(__file__).resolve().parent
RELEASE='2026.10.26-2'
CRITICAL={'piloto_vigencias.py','piloto_vigencias_dell.py','piloto_sdk_worker.py',
          'paquete_piloto.py','lanzar_piloto_vigencias.ps1','verificar_piloto.ps1','simular_piloto.py'}


def verify_package():
    path=ROOT/'PILOTO_SHA256SUMS.json'
    if path.stat().st_size>131072:raise ValueError('Manifiesto excedido.')
    value=json.loads(path.read_bytes());names=[row['name'] for row in value['files']]
    if value['release']!=RELEASE or not CRITICAL<=set(names) or len(names)!=len(set(names)) or not 155<=len(names)<=200:
        raise ValueError('Manifiesto piloto distinto.')
    for row in value['files']:
        name=row['name'];parts=PurePosixPath(name)
        if not name or parts.as_posix()!=name or parts.is_absolute() or '..' in parts.parts or ':' in name or '\\' in name:
            raise ValueError('Ruta fuera del paquete.')
        if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=row['sha256']:raise ValueError('Fuente de piloto alterada.')
    return value
