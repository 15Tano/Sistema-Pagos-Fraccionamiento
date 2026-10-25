"""ZIP de ensayo acotado: fuentes permitidas, sin credenciales/datos/tareas."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
FILES = ['ensayo_coordinador.py', 'coordinador.py', 'captura_rt.py', 'referencia_vigencias.py',
         'outbox.py', 'protocolo.py', 'emisor.py', 'credencial.py', 'agente.py',
         'lanzar_lectura_coordinador.ps1', 'verificar_coordinador.ps1', 'LEEME_COORDINADOR.md',
         'referencia_r2/sincronizar_vigencias.py', 'referencia_r2/sync_runtime.py',
         'referencia_r2/c3_worker.py', 'referencia_r2/c3_panel.py', 'referencia_r2/FUENTE.json']
MANIFEST = 'COORDINADOR_SHA256SUMS.json'


def main():
    target = ROOT / 'Coordinador_Ensayo_2026.10.24-1.zip'
    if target.exists():
        raise FileExistsError('No sustituir un ZIP publicado; usar nueva version.')
    entries = {name: (ROOT / name).read_bytes() for name in FILES}
    entries['runtime/lector_eventos.py'] = (ROOT.parent / 'diagnostico_eventos' / 'lector_eventos.py').read_bytes()
    manifest = {'release': '2026.10.24-1', 'scope': 'Ensayo readonly; sin instalacion operativa.',
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
