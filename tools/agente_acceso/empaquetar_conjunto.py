"""Congelar paquetes publicados completos y adaptadores nuevos; nunca sobrescribir."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
OWN = ['ensayo_conjunto.py', 'coordinacion_conjunta.py', 'simular_conjunto.py',
       'verificar_conjunto.ps1', 'LEEME_CONJUNTO.md', 'tests/test_conjunto.py',
       'lector_conjunto.py', 'lanzar_lector_conjunto.ps1']
BUNDLES = {
    'lector': ('Cierres_Coordinador_2026.10.24-1.zip', '62afc55c986178e8086035fa978c7d2241f715296f359cc02997db7698819a11'),
    'envio': ('Envio_Vigilado_2026.10.25-2.zip', '03b415a4e7aba6941d4eac219c4f986f863dbe8c1af1553591b9e611219f226b'),
}


def main():
    target = ROOT / 'Ensayo_Conjunto_2026.10.25-1.zip'
    if target.exists(): raise FileExistsError('Conservar ZIP; publicar otra version.')
    entries = {name: (ROOT / name).read_bytes() for name in OWN}
    for prefix, (name, expected) in BUNDLES.items():
        path = ROOT / name
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected: raise ValueError('ZIP publicado distinto.')
        with zipfile.ZipFile(path) as archive:
            for member in archive.namelist(): entries[prefix + '/' + member] = archive.read(member)
    manifest = {'release': '2026.10.25-1', 'scope': 'Conjunto readonly y HTTP aislado, sin instalacion.',
                'files': [{'name': name, 'sha256': hashlib.sha256(data).hexdigest()} for name, data in entries.items()]}
    entries['CONJUNTO_SHA256SUMS.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
    (ROOT / 'CONJUNTO_SHA256SUMS.json').write_bytes(entries['CONJUNTO_SHA256SUMS.json'])
    with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries.items(): archive.writestr(name, data)
    print(target)
    print('SHA256:', hashlib.sha256(target.read_bytes()).hexdigest())


if __name__ == '__main__': main()
