"""Complemento de entrega; no reemplaza paquetes ni bibliotecas del coordinador."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
FILES = ['entregar_coordinador.py', 'LEEME_ENTREGA.md', 'verificar_entrega.ps1']
MANIFEST = 'ENTREGA_SHA256SUMS.json'


def main():
    target = ROOT / 'Entrega_Coordinador_2026.10.24-1.zip'
    if target.exists():
        raise FileExistsError('Conservar ZIP publicado; usar nueva version.')
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
