"""Candidato separado basado exclusivamente en el ZIP Display-2 publicado."""
import hashlib
import json
from pathlib import Path
import zipfile

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
BASE=ROOT/'Lecturas_Correccion_Display_2026.10.30-2.zip'
BASE_SHA='e130384297c7c4ea859c2d5a157fea0ed3d9d4732b994fc9bc3930605ea3a812'
OLD='3eca5b039d106d5dbe383074b940d321fbe438b5a38a9964569a9316200e1a6e'
RELEASE='2026.10.31-3'
ADDITIONS=('actualizar_almacen.py','LEEME_CORRECCION_ALMACEN.md','tests/test_correccion_almacen.py')
CHANGED=('almacen_operativo.py','archivo_cierres.py','runner_operativo.py','tests/test_almacen_operativo.py')


def sha(raw): return hashlib.sha256(raw).hexdigest()


def replace_once(text, before, after):
    if text.count(before)!=1: raise ValueError('Ancla de construccion distinta: '+before[:60])
    return text.replace(before,after)


def entries():
    if sha(BASE.read_bytes())!=BASE_SHA: raise ValueError('ZIP base distinto.')
    with zipfile.ZipFile(BASE) as archive:
        if archive.testzip() is not None: raise ValueError('CRC base distinto.')
        files={name:archive.read(name) for name in archive.namelist()}
    if sha(files['OPERATIVA_SHA256SUMS.json'])!=OLD: raise ValueError('Manifest base distinto.')
    manifest=json.loads(files.pop('OPERATIVA_SHA256SUMS.json'))
    if {r['name']:r['sha256'] for r in manifest['files']}!={name:sha(raw) for name,raw in files.items()}:
        raise ValueError('Fuentes base distintas.')
    for name in CHANGED:
        if name not in files: raise ValueError('Fuente base ausente.')
        files[name]=(ROOT/name).read_bytes()
    for name,before,after in (
        ('produccion_paquete.py',b"RELEASE='2026.10.30-2'",b"RELEASE='2026.10.31-3'"),
        ('runner_produccion.py',b"version='produccion-r2-2026.10.30-2'",b"version='produccion-r2-2026.10.31-3'")):
        files[name]=replace_once(files[name],before,after)
    changed=(*CHANGED,'produccion_paquete.py','runner_produccion.py')
    expected={name:sha(files[name]) for name in changed}

    # Materializar un instalador estatico basado en el revisado de Display-2.
    # El candidato final contiene codigo Python ordinario, no exec de parches.
    source=files['actualizar_display.py'].decode('utf-8')
    source=source.replace("'59bf55874a0101e3c049be8d1add3285e08e5c56db4e16a58aed3f913f658dfc'",repr(OLD))
    source=source.replace("'1f933dd4376833d03d08476d70a1434bd0e8f5acd9a4262963183340c7e77f60'",repr(BASE_SHA))
    source=source.replace("RELEASE = '2026.10.30-2'",f'RELEASE = {RELEASE!r}')
    start=source.index('ADDITIONS = ');end=source.index('\n\n\ndef sha',start)
    additions_literal='{'+', '.join(repr(name) for name in sorted(ADDITIONS))+'}'
    source=source[:start]+f'ADDITIONS = {additions_literal}\nALLOWED_DELTA_HASHES = {expected!r}'+source[end:]
    source=source.replace("OLD, '2026.10.30-1'", "OLD, '2026.10.30-2'")
    start=source.index('            expected = before\n');end=source.index('\n        return target, candidate',start)
    source=source[:start]+'''            expected = ALLOWED_DELTA_HASHES.get(name, sha(before))
            if sha((self.payload / name).read_bytes()) != expected:
                raise ValueError('La actualizacion contiene otros cambios.')'''+source[end:]
    source=replace_once(source,"'max_gap_before_seconds': 1.5, 'max_gap_after_seconds': 3.0,\n            'empty_states_required': 2, 'recent_empty_grace_seconds': 2,",
        "'scan_policy': 'windows_scandir', 'cross_call_size_cache': False,")
    for before,after in (('display_readiness','storage_scan'),('display_update','storage_update'),
            ('previous_display_release','previous_storage_release'),('actualizaciones_display','actualizaciones_almacen')):
        source=source.replace(before,after)
    source=source.replace('Actualizar solo la tolerancia RT','Actualizar solo el recorrido de archivos')
    (HERE/'actualizar_almacen.py').write_text(source,encoding='utf-8',newline='\n')

    tests=files['tests/test_correccion_display.py'].decode('utf-8')
    start=tests.index('class ReadinessCorrectionTests');end=tests.index('class UpdateTests',start)
    tests=tests[:start]+tests[end:]
    tests=tests.replace('import actualizar_display as app','import actualizar_almacen as app')
    tests=tests.replace('SI_DISPLAY_BASE_ZIP','SI_STORAGE_BASE_ZIP').replace('pruebas_correccion_display','pruebas_correccion_almacen')
    tests=tests.replace("self.assertEqual(3.0, plan['max_gap_after_seconds'])", "self.assertEqual('windows_scandir', plan['scan_policy'])")
    tests=tests.replace("self.assertEqual(2, plan['recent_empty_grace_seconds'])", "self.assertFalse(plan['cross_call_size_cache'])")
    tests=tests.replace('display_update_installed_waiting_resume','storage_update_installed_waiting_resume')
    tests=tests.replace('actualizaciones_display','actualizaciones_almacen')
    (HERE/'tests').mkdir(exist_ok=True)
    (HERE/'tests'/'test_correccion_almacen.py').write_text(tests,encoding='utf-8',newline='\n')
    for name in ADDITIONS: files[name]=(HERE/name).read_bytes()
    value={'release':RELEASE,'scope':'production_r2_reference','base':{'name':BASE.name,'sha256':BASE_SHA},
        'changed_base_sources':list(changed),
        'files':[{'name':name,'sha256':sha(raw)} for name,raw in sorted(files.items())]}
    files['OPERATIVA_SHA256SUMS.json']=(json.dumps(value,indent=2)+'\n').encode()
    return files


def write(path):
    files=entries()
    with zipfile.ZipFile(path,'x',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for name,raw in sorted(files.items()):
            info=zipfile.ZipInfo(name,date_time=(2026,10,31,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o600<<16
            archive.writestr(info,raw)
    return {'file':str(path),'files':len(files),'bytes':Path(path).stat().st_size,
        'sha256':sha(Path(path).read_bytes()),'manifest_sha256':sha(files['OPERATIVA_SHA256SUMS.json'])}


if __name__=='__main__':
    print(json.dumps(write(ROOT/'Lecturas_Correccion_Almacen_2026.10.31-3.zip'),indent=2))
