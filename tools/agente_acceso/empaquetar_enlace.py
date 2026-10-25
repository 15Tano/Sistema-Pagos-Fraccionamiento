"""Empaquetar controles candidatos sin sustituir ZIPs publicados."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
FILES = ['enlace_candidato.py', 'panel_coordinador.ps1', 'mantenimiento_candidato.ps1',
         'control_operativo.py', 'salud_operativa.py', 'verificar_enlace.ps1', 'LEEME_ENLACE.md',
         'enlace_funciones.ps1', 'simular_enlace.py', 'tests/test_enlace_candidato.py', 'tests/enlace_ficticio.ps1']


def main():
    target = ROOT / 'Enlace_Candidato_2026.10.25-2.zip'
    if target.exists():
        raise FileExistsError('Conservar ZIP existente; publicar nueva version.')
    old = ROOT / 'Cierres_Coordinador_2026.10.24-1.zip'
    if hashlib.sha256(old.read_bytes()).hexdigest() != '62afc55c986178e8086035fa978c7d2241f715296f359cc02997db7698819a11':
        raise ValueError('ZIP de cierres distinto de referencia publicada.')
    entries = {name: (ROOT / name).read_bytes() for name in FILES}
    with zipfile.ZipFile(old) as archive:
        entries['cierres_manifest_referencia.json'] = archive.read('CIERRES_SHA256SUMS.json')
    manifest = {'release': '2026.10.25-2', 'scope': 'Control candidato y simulacion ficticia; no instalador.',
        'files': [{'name': name, 'sha256': hashlib.sha256(data).hexdigest()} for name, data in entries.items()]}
    entries['ENLACE_SHA256SUMS.json'] = (json.dumps(manifest, indent=2) + '\n').encode('utf-8')
    for name in ('cierres_manifest_referencia.json', 'ENLACE_SHA256SUMS.json'):
        (ROOT / name).write_bytes(entries[name])
    with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries.items():
            archive.writestr(name, data)
    print(target)
    print('SHA256:', hashlib.sha256(target.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
