"""Paquete piloto autocontenido; base congelada sin sustituir publicaciones."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parent
BASE='Preparacion_Operativa_2026.10.26-1.zip'
BASE_SHA='fc83b5e49e8204a390e0f79bff2af5bcf0233ec95d3bdf52ab813df0bd058a0a'
TARGET='Piloto_Vigencias_2026.10.26-2.zip'
ADDITIONS=('piloto_vigencias.py','piloto_vigencias_dell.py','piloto_sdk_worker.py','paquete_piloto.py',
    'lanzar_piloto_vigencias.ps1','verificar_piloto.ps1','simular_piloto.py','LEEME_PILOTO_VIGENCIAS.md',
    'tests/test_piloto_vigencias.py','tests/test_piloto_procesos.py','tests/test_piloto_entrada.py','tests/piloto_sdk_ficticio.py')


def main():
    if hashlib.sha256((ROOT/BASE).read_bytes()).hexdigest()!=BASE_SHA:raise ValueError('Base distinta.')
    with zipfile.ZipFile(ROOT/BASE) as previous:
        names=previous.namelist()
        if len(names)!=150 or len(names)!=len(set(names)):raise ValueError('Base inesperada.')
        files={name:previous.read(name) for name in names}
    for name in ADDITIONS:
        if name in files:raise ValueError('No sustituir una fuente publicada.')
        files[name]=(ROOT/name).read_bytes()
    manifest={'release':'2026.10.26-2','scope':'piloto_acotado_un_tag_con_consentimiento_explicito',
        'base':{'name':BASE,'sha256':BASE_SHA,'entries_preserved':150},
        'files':[{'name':name,'sha256':hashlib.sha256(raw).hexdigest()} for name,raw in sorted(files.items())]}
    raw=json.dumps(manifest,indent=2,ensure_ascii=False).encode()+b'\n';files['PILOTO_SHA256SUMS.json']=raw
    target=ROOT/TARGET
    with zipfile.ZipFile(target,'x',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for name,value in sorted(files.items()):
            info=zipfile.ZipInfo(name,date_time=(2026,10,26,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o600<<16;archive.writestr(info,value)
    (ROOT/'PILOTO_SHA256SUMS.json').write_bytes(raw)
    value={'name':TARGET,'bytes':target.stat().st_size,'entries':len(files),
        'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'manifest_sha256':hashlib.sha256(raw).hexdigest(),
        'base_entries_preserved':150}
    (ROOT/'PILOTO_PAQUETE.json').write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(value,indent=2))


if __name__=='__main__':main()
