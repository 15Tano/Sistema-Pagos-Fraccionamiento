"""Publicar una sola vez el nucleo ficticio y dependencias readonly congeladas."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
OWN = ['vigencias_candidato.py', 'tests/test_vigencias_candidato.py', 'simular_vigencias.py',
       'verificar_vigencias.ps1', 'LEEME_VIGENCIAS_CANDIDATO.md']
SDK_ZIP = 'Cierres_Coordinador_2026.10.24-1.zip'
SDK_SHA = '62afc55c986178e8086035fa978c7d2241f715296f359cc02997db7698819a11'


def main():
    target = ROOT / 'Nucleo_Vigencias_2026.10.25-1.zip'
    if target.exists():
        raise FileExistsError('ZIP publicado: crear otra version, no sobrescribir.')
    archive = ROOT / SDK_ZIP
    if hashlib.sha256(archive.read_bytes()).hexdigest() != SDK_SHA:
        raise ValueError('Paquete de referencia diferente.')
    with zipfile.ZipFile(archive) as bundle:
        entries = {name: bundle.read(name) for name in bundle.namelist()}
    if len(entries) != 20 or any(name in entries for name in OWN):
        raise ValueError('Dependencias inesperadas.')
    entries.update({name: (ROOT / name).read_bytes() for name in OWN})
    manifest = {'release': '2026.10.25-1', 'scope': 'Nucleo ficticio, sin instalacion ni launcher de hardware nuevo.',
                'files': [{'name': name, 'sha256': hashlib.sha256(data).hexdigest()} for name, data in entries.items()]}
    raw = (json.dumps(manifest, indent=2) + '\n').encode('utf-8')
    entries['VIGENCIAS_SHA256SUMS.json'] = raw
    (ROOT / 'VIGENCIAS_SHA256SUMS.json').write_bytes(raw)
    with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED) as bundle:
        for name, data in entries.items():
            bundle.writestr(name, data)
    print('Archivos:', len(entries))
    print('Bytes:', target.stat().st_size)
    print('SHA256:', hashlib.sha256(target.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
