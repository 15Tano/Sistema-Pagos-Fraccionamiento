"""Verificacion del release permanente, sin instalar, conectar o descifrar datos."""
import hashlib
import json
from pathlib import Path,PurePosixPath

ROOT=Path(__file__).resolve().parent
RELEASE='2026.10.30-1'
CRITICAL={'produccion_config.py','produccion_r2.py','produccion_worker.py','produccion_emisor.py',
    'produccion_instalador.py','produccion_dell.py','produccion_paquete.py','runner_produccion.py',
    'sesion_operativa.py','archivo_cierres.py','almacen_operativo.py','instalacion_operativa.py',
    'referencia_r2/sincronizar_vigencias.py','referencia_r2/c3_worker.py','referencia_r2/c3_panel.py',
    'referencia_r2/sync_runtime.py','referencia_r2/FUENTE.json','carpeta_privada_mdb.ps1',
    'gestor_candidato/gt_backend.py','gestor_candidato/mantenimiento.ps1','gestor_candidato/gt_guard_operativo.py'}


def verify_package(root=ROOT):
    root=Path(root);path=root/'OPERATIVA_SHA256SUMS.json'
    if path.stat().st_size>131072: raise ValueError('Manifiesto excedido.')
    value=json.loads(path.read_bytes())
    names=[row['name'] for row in value['files']]
    if (value.get('release')!=RELEASE or value.get('scope')!='production_r2_reference' or
            not 170<=len(names)<=200 or len(names)!=len(set(n.casefold() for n in names)) or
            not CRITICAL<=set(names)):
        raise ValueError('Release/manifest de produccion distintos.')
    for row in value['files']:
        name=row['name'];parts=PurePosixPath(name)
        if (not name or parts.as_posix()!=name or parts.is_absolute() or '..' in parts.parts or
                ':' in name or '\\' in name or '\0' in name or
                hashlib.sha256((root/name).read_bytes()).hexdigest()!=row['sha256']):
            raise ValueError('Fuente de produccion distinta.')
    return value
