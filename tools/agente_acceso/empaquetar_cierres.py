"""ZIP candidato con trabajadores readonly; no sustituye paquetes publicados."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
FILES = ['adaptadores_cierre.py', 'ensayo_cierres.py', 'trabajador_controlado.py',
    'control_operativo.py', 'captura_rt.py', 'coordinador.py', 'outbox.py', 'protocolo.py',
    'referencia_vigencias.py', 'referencia_r2/sincronizar_vigencias.py', 'referencia_r2/sync_runtime.py',
    'referencia_r2/c3_worker.py', 'referencia_r2/c3_panel.py', 'referencia_r2/FUENTE.json',
    'lanzar_cierres.ps1', 'verificar_cierres.ps1', 'LEEME_CIERRES.md', 'tests/test_adaptadores_cierre.py']
MANIFEST = 'CIERRES_SHA256SUMS.json'


def main():
    target = ROOT / 'Cierres_Coordinador_2026.10.24-1.zip'
    if target.exists():
        raise FileExistsError('Conservar ZIP publicado; usar nueva version.')
    entries = {name: (ROOT / name).read_bytes() for name in FILES}
    entries['runtime/lector_eventos.py'] = (ROOT.parent / 'diagnostico_eventos' / 'lector_eventos.py').read_bytes()
    manifest = {'release': '2026.10.24-1', 'scope': 'Adaptadores readonly, sin instalacion permanente.',
        'files': [{'name': name, 'sha256': hashlib.sha256(data).hexdigest()} for name, data in entries.items()]}
    (ROOT / MANIFEST).write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries.items():
            archive.writestr(name, data)
        archive.writestr(MANIFEST, (ROOT / MANIFEST).read_bytes())
    print(target)
    print('SHA256:', hashlib.sha256(target.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
