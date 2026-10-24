"""ZIP de compatibilidad sin servidor, SDK ni configuracion operativa."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
FILES = ['preflight_dell.py', 'outbox.py', 'protocolo.py', 'credencial.py',
         'LEEME_PREFLIGHT.md', 'verificar_preflight.ps1']
MANIFEST = 'PREFLIGHT_SHA256SUMS.json'


def main():
    target = ROOT / 'Preflight_Emisor_2026.10.23-1.zip'
    if target.exists():
        raise FileExistsError('Conservar el ZIP original; usar otro release para cambiarlo.')
    manifest = {'release': '2026.10.23-1', 'files': [
        {'name': name, 'sha256': hashlib.sha256((ROOT / name).read_bytes()).hexdigest()} for name in FILES]}
    (ROOT / MANIFEST).write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in FILES + [MANIFEST]:
            archive.write(ROOT / name, arcname=name)
    print(target)
    print('SHA256:', hashlib.sha256(target.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
