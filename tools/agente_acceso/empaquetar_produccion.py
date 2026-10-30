"""Construye release nuevo; conserva ZIP historicos y excluye datos/SDK/secretos."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parent
BASE='Latencia_Candidata_2026.10.28-2.zip'
BASE_SHA='13cb02aa744951926a30aa7faaf71fbada55e9157316a3459a5ef42b078dc8fc'
MODULES=('produccion_config.py','produccion_r2.py','produccion_worker.py','produccion_emisor.py',
    'produccion_instalador.py','produccion_dell.py','produccion_paquete.py','runner_produccion.py',
    'archivo_cierres.py','verificar_produccion.ps1','LEEME_PRODUCCION.md',
    'tests/test_produccion_r2.py','tests/produccion_worker_ficticio.py','tests/test_instalacion_produccion.py',
    'tests/test_emisor_produccion.py','tests/test_configurar_produccion.py')


def entries():
    if hashlib.sha256((ROOT/BASE).read_bytes()).hexdigest()!=BASE_SHA: raise ValueError('Base historica distinta.')
    with zipfile.ZipFile(ROOT/BASE) as archive:
        if len(archive.namelist())!=170 or archive.testzip() is not None: raise ValueError('Base invalida.')
        files={name:archive.read(name) for name in archive.namelist()}
    files.pop('OPERATIVA_SHA256SUMS.json')
    for name in MODULES: files[name]=(ROOT/name).read_bytes()
    manifest={'release':'2026.10.30-1','scope':'production_r2_reference','base':{'name':BASE,'sha256':BASE_SHA},
        'files':[{'name':name,'sha256':hashlib.sha256(raw).hexdigest()} for name,raw in sorted(files.items())]}
    if not 170<=len(files)<=200: raise ValueError('Cantidad de fuentes fuera del instalador.')
    files['OPERATIVA_SHA256SUMS.json']=(json.dumps(manifest,indent=2)+'\n').encode('utf-8')
    return files


def write(path):
    files=entries();path=Path(path)
    with zipfile.ZipFile(path,'x',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for name,raw in sorted(files.items()):
            info=zipfile.ZipInfo(name,date_time=(2026,10,30,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o600<<16;archive.writestr(info,raw)
    return {'file':str(path),'bytes':path.stat().st_size,'files':len(files),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'manifest_sha256':hashlib.sha256(files['OPERATIVA_SHA256SUMS.json']).hexdigest()}


if __name__=='__main__': print(json.dumps(write(ROOT/'Lecturas_Produccion_2026.10.30-1.zip'),indent=2))
