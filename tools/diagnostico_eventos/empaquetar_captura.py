"""Paquete aislado de captura, sin modificar ZIP diagnosticos publicados."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
FILES = ['captura_controlada.py', 'lector_eventos.py', 'test_captura.py', 'test_lector.py',
         'LEEME_CAPTURA.md', 'verificar_captura.ps1']
MANIFEST = 'CAPTURA_SHA256SUMS.json'


def main():
    target = ROOT / 'Captura_Tag_C3_2026.10.24-1.zip'
    if target.exists():
        raise FileExistsError('Conservar ZIP publicado; usar otra version.')
    manifest = {'release': '2026.10.24-1', 'files': [
        {'name': name, 'sha256': hashlib.sha256((ROOT / name).read_bytes()).hexdigest()} for name in FILES]}
    (ROOT / MANIFEST).write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in FILES + [MANIFEST]:
            archive.write(ROOT / name, arcname=name)
    print(target)
    print('SHA256:', hashlib.sha256(target.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
