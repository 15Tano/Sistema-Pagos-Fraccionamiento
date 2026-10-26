"""Verificacion de fuentes sin importar modulos SDK ni credenciales."""
import hashlib
import json
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent
RELEASE = '2026.10.26-2'
CRITICAL = {'servicio_integrado.py', 'ciclo_operativo.py', 'respaldo_ciclo.py',
            'emisor_servicio.py', 'servicio_integrado_dell.py', 'paquete_servicio.py',
            'lanzar_servicio_integrado.ps1', 'simular_servicio.py', 'verificar_servicio.ps1',
            'emisor.py', 'credencial.py', 'entregar_coordinador.py'}


def verify_package():
    path = ROOT / 'SERVICIO_SHA256SUMS.json'
    if path.stat().st_size > 131072:
        raise ValueError('Manifiesto excedido.')
    manifest = json.loads(path.read_bytes())
    names = [row['name'] for row in manifest['files']]
    if (manifest['release'] != RELEASE or not CRITICAL <= set(names) or
            len(names) != len(set(names)) or not 100 <= len(names) <= 160):
        raise ValueError('Manifiesto inesperado.')
    for row in manifest['files']:
        name = row['name']
        if (not name or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or
                ':' in name or '\\' in name or hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != row['sha256']):
            raise ValueError('Fuente o ruta diferente.')
    return manifest
