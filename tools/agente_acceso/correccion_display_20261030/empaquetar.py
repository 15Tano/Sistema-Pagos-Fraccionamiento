"""Release separado: los bytes del ZIP permanente original no se modifican."""
import hashlib
import json
from pathlib import Path
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BASE = ROOT / 'Lecturas_Produccion_2026.10.30-1.zip'
BASE_SHA = '1f933dd4376833d03d08476d70a1434bd0e8f5acd9a4262963183340c7e77f60'
DELTAS = {
    'latencia_politicas.py': (b'max_gap=1.5', b'max_gap=3.0'),
    'produccion_paquete.py': (b"RELEASE='2026.10.30-1'", b"RELEASE='2026.10.30-2'"),
    'runner_produccion.py': (b"version='produccion-r2-2026.10.30-1'", b"version='produccion-r2-2026.10.30-2'"),
}
ADDITIONS = ('actualizar_display.py', 'LEEME_CORRECCION_DISPLAY.md', 'tests/test_correccion_display.py')


def entries():
    if hashlib.sha256(BASE.read_bytes()).hexdigest() != BASE_SHA:
        raise ValueError('ZIP permanente original distinto.')
    with zipfile.ZipFile(BASE) as archive:
        if len(archive.namelist()) != 185 or archive.testzip() is not None:
            raise ValueError('ZIP original incompleto.')
        files = {name: archive.read(name) for name in archive.namelist()}
    old = json.loads(files.pop('OPERATIVA_SHA256SUMS.json'))
    if {r['name']: r['sha256'] for r in old['files']} != {
            name: hashlib.sha256(raw).hexdigest() for name, raw in files.items()}:
        raise ValueError('Manifest original distinto.')
    for name, (before, after) in DELTAS.items():
        if files[name].count(before) != 1:
            raise ValueError('Ancla distinta: ' + name)
        files[name] = files[name].replace(before, after)
    for name in ADDITIONS:
        files[name] = (HERE / name).read_bytes()
    value = {'release': '2026.10.30-2', 'scope': 'production_r2_reference',
        'base': {'name': BASE.name, 'sha256': BASE_SHA},
        'changed_base_sources': list(DELTAS),
        'files': [{'name': name, 'sha256': hashlib.sha256(raw).hexdigest()} for name, raw in sorted(files.items())]}
    files['OPERATIVA_SHA256SUMS.json'] = (json.dumps(value, indent=2) + '\n').encode()
    return files


def write(path):
    files = entries()
    path = Path(path)
    with zipfile.ZipFile(path, 'x', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, raw in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 30, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            archive.writestr(info, raw)
    return {'file': str(path), 'files': len(files), 'bytes': path.stat().st_size,
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'manifest_sha256': hashlib.sha256(files['OPERATIVA_SHA256SUMS.json']).hexdigest()}


if __name__ == '__main__':
    print(json.dumps(write(ROOT / 'Lecturas_Correccion_Display_2026.10.30-2.zip'), indent=2))
