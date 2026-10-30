"""Verificacion de esta publicacion; sin importar SDK, red o credenciales."""
import hashlib
import json
from pathlib import Path,PurePosixPath

ROOT=Path(__file__).resolve().parent
RELEASE='2026.10.28-2'
CRITICAL={'latencia_dell.py','sdk_latencia.py','servicio_latencia.py','emisor_latencia.py',
    'latencia_politicas.py','resumen_latencia.py','servicio_integrado.py','captura_rt.py',
    'paquete_latencia.py','simular_latencia.py','verificar_latencia.ps1','lanzar_latencia.ps1',
    'tests/test_latencia_candidata.py','tests/test_latencia_procesos.py','tests/test_latencia_dell.py',
    'tests/latencia_proceso_ficticio.py','referencia_vigencias.py','aplicacion_vigencias.py',
    'comparar_validacion.py','tests/test_referencia_rapida.py',
    'baseline_latencia1/referencia_vigencias.py','baseline_latencia1/aplicacion_vigencias.py'}


def verify_package():
    path=ROOT/'LATENCIA_SHA256SUMS.json'
    if path.stat().st_size>131072:raise ValueError('Manifiesto excedido.')
    manifest=json.loads(path.read_bytes())
    names=[row['name'] for row in manifest['files']]
    if (manifest['release']!=RELEASE or len(names)!=len(set(names)) or
            not CRITICAL<=set(names) or not 150<=len(names)<=200):
        raise ValueError('Manifiesto inesperado.')
    for row in manifest['files']:
        name=row['name']
        if (not name or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or
                ':' in name or '\\' in name or (ROOT/name).is_symlink() or
                hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=row['sha256']):
            raise ValueError('Fuente o ruta diferente.')
    return manifest
