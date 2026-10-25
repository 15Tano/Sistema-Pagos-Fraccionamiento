"""Publica candidatos sin instalador y sin sustituir paquetes existentes."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
FILES = ['control_operativo.py', 'salud_operativa.py', 'trabajador_controlado.py',
         'revisar_operacion.py', 'verificar_operacion.ps1', 'LEEME_OPERACION.md',
         'simular_operacion.py', 'tests/test_operacion.py']
MANIFEST = 'OPERACION_SHA256SUMS.json'


def main():
    target = ROOT / 'Integracion_Operativa_2026.10.24-3.zip'
    if target.exists():
        raise FileExistsError('Conservar ZIP publicado; usar nueva version.')
    manifest = {'release': '2026.10.24-3', 'scope': 'Componentes candidatos, inspector readonly y simulacion sin SDK; no instalador.',
                'files': [{'name': name, 'sha256': hashlib.sha256((ROOT / name).read_bytes()).hexdigest()} for name in FILES]}
    (ROOT / MANIFEST).write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in FILES + [MANIFEST]:
            archive.write(ROOT / name, arcname=name)
    print(target)
    print('SHA256:', hashlib.sha256(target.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
