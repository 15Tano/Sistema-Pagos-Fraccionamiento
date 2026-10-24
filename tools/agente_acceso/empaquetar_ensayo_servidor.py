"""Empaqueta fuentes Laravel confirmadas en Git; sin datos ni dependencias."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
EXACT = {'backend/artisan', 'backend/composer.json', 'backend/composer.lock',
         'backend/bootstrap/app.php', 'backend/bootstrap/providers.php', 'backend/public/index.php',
         'backend/database/migrations/2026_10_23_210000_create_control_acceso_ingestion_tables.php'}


def main():
    target = HERE / 'Ensayo_Acceso_Servidor_2026.10.23-1.tar.gz'
    if target.exists():
        raise FileExistsError('Conservar el paquete original y usar otro release.')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', commit, '--', 'backend'],
                                    cwd=ROOT, text=True).splitlines()
    contents = {}
    for name in names:
        if name in EXACT or name.startswith(('backend/app/', 'backend/config/', 'backend/routes/')):
            if '\n' in name or '\\' in name:
                raise ValueError('Nombre no permitido.')
            contents[name] = subprocess.check_output(['git', 'show', commit + ':' + name], cwd=ROOT)
    if not EXACT <= contents.keys():
        raise ValueError('Snapshot incompleto.')
    for name in ['preparar_ensayo.sh', 'iniciar_ensayo.sh', 'router_ensayo.php', 'LEEME.md']:
        contents[name] = (HERE / 'ensayo_servidor' / name).read_bytes()
    contents['FUENTE.json'] = (json.dumps({'release': '2026.10.23-1', 'source_commit': commit}, indent=2) + '\n').encode()
    checksums = ''.join(hashlib.sha256(data).hexdigest() + '  ' + name + '\n' for name, data in sorted(contents.items()))
    contents['SHA256SUMS'] = checksums.encode('utf-8')
    with tarfile.open(target, 'w:gz') as archive:
        for name, data in contents.items():
            entry = tarfile.TarInfo(name)
            entry.size = len(data)
            entry.mode = 0o644
            archive.addfile(entry, io.BytesIO(data))
    print(target)
    print('source_commit:', commit)
    print('files:', len(contents))
    print('SHA256:', hashlib.sha256(target.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
