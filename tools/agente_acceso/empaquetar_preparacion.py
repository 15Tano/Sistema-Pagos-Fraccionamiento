"""Construccion reproducible; nunca reemplazar un ZIP ya emitido."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parent
BASE='Servicio_Integrado_2026.10.26-2.zip'
BASE_SHA='2e8a4aed431ec6f96223c1ff4c1f6845bc0765bf66334d81b09d8d0d0e289507'
TARGET='Preparacion_Operativa_2026.10.26-1.zip'
MODULES=('almacen_operativo.py','archivo_cierres.py','config_operativa.py','emisor_operativo.py',
    'guardia_gestor_operativo.py','instalacion_operativa.py','operacion_nativa.py','preparar_operacion.py',
    'runner_operativo.py','rutas_operativas.py','sdk_operativo.py','sesion_operativa.py','vigilancia_operativa.py',
    'ensayo_capacidad_operativa.py','simular_operacion_preparada.py','verificar_preparacion.ps1',
    'LEEME_PREPARACION_OPERATIVA.md')
TESTS=('test_sesion_operativa.py','test_almacen_operativo.py','test_archivo_cierres.py',
    'test_instalacion_operativa.py','test_vigilancia_operativa.py','test_guardias_operativas.py',
    'test_sdk_operativo.py','sdk_operativo_ficticio.py')
REFERENCES=('iniciar_oculto.ps1','vigilar_sync.py','gt_backend.py','mantenimiento.ps1')


def main():
    if hashlib.sha256((ROOT/BASE).read_bytes()).hexdigest()!=BASE_SHA:raise ValueError('Base diferente.')
    with zipfile.ZipFile(ROOT/BASE) as previous:
        names=previous.namelist()
        if len(names)!=117 or len(names)!=len(set(names)):raise ValueError('Base inesperada.')
        files={name:previous.read(name) for name in names}
    additions=list(MODULES)+['tests/'+name for name in TESTS]+['referencia_operacion/'+name for name in REFERENCES]
    additions+=['gestor_candidato/'+name for name in ('gt_backend.py','mantenimiento.ps1','gt_guard_operativo.py')]
    for name in additions:
        if name in files:raise ValueError('No sustituir una fuente publicada.')
        files[name]=(ROOT/name).read_bytes()
    manifest={'release':'2026.10.26-1','scope':'preparacion_local_no_instala_ni_activa',
        'base':{'name':BASE,'sha256':BASE_SHA,'entries_preserved':117},
        'files':[{'name':name,'sha256':hashlib.sha256(raw).hexdigest()} for name,raw in sorted(files.items())]}
    raw=json.dumps(manifest,indent=2,ensure_ascii=False).encode('utf-8')+b'\n'
    files['OPERATIVA_SHA256SUMS.json']=raw
    path=ROOT/TARGET
    if path.exists():raise FileExistsError('ZIP previo conservado; usar otra version tras emitir.')
    with zipfile.ZipFile(path,'x',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for name,content in sorted(files.items()):
            info=zipfile.ZipInfo(name,date_time=(2026,10,26,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o600<<16;archive.writestr(info,content)
    (ROOT/'OPERATIVA_SHA256SUMS.json').write_bytes(raw)
    value={'name':TARGET,'bytes':path.stat().st_size,'entries':len(files),
        'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'manifest_sha256':hashlib.sha256(raw).hexdigest(),'base_entries_preserved':117}
    (ROOT/'PREPARACION_PAQUETE.json').write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(value,indent=2))


if __name__=='__main__':main()
