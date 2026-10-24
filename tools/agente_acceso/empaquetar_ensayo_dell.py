"""Empaqueta exclusivamente cliente manual de fixtures, sin datos ni credenciales."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
FILES = ['ensayo_dell.py', 'outbox.py', 'protocolo.py', 'credencial.py', 'emisor.py',
         'LEEME_ENSAYO_DELL.md', 'verificar_ensayo_dell.ps1']
MANIFEST = 'ENSAYO_DELL_SHA256SUMS.json'


def main():
    target = ROOT / 'Ensayo_Emisor_Dell_2026.10.24-1.zip'
    if target.exists():
        raise FileExistsError('Conservar ZIP publicado; cambiar release para una entrega nueva.')
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
