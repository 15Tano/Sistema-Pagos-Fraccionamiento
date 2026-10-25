"""Paquete nuevo con emisor/vigilancia; conserva ZIPs publicados y sus fuentes."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
FILES = ['envio_vigilado.py', 'bucle_envio.py', 'vigilancia_envio.py', 'simular_envio.py',
         'verificar_envio.ps1', 'LEEME_ENVIO_VIGILADO.md', 'tests/test_envio_vigilado.py']
FROZEN = {
    'Coordinador_Ensayo_2026.10.24-1.zip': ('2e2837992f7c0b0b3374ac346ca862b25100a349f5d419caabc8a97aa9016902',
        ['outbox.py', 'protocolo.py', 'emisor.py', 'credencial.py']),
    'Entrega_Coordinador_2026.10.24-1.zip': ('bdad2b8c196c4f7e36ae84fdb60a6ea0c9824192c088ac2bfb968ea6af01581f',
        ['entregar_coordinador.py']),
    'Enlace_Candidato_2026.10.25-2.zip': ('03d16983db51a8bc421694c37e044f469e2ea33623004c1da8ade5b854de9e51',
        ['enlace_candidato.py', 'control_operativo.py', 'salud_operativa.py']),
}


def main():
    target = ROOT / 'Envio_Vigilado_2026.10.25-2.zip'
    if target.exists():
        raise FileExistsError('Conservar ZIP; publicar otra version.')
    entries = {name: (ROOT / name).read_bytes() for name in FILES}
    for name, (expected, members) in FROZEN.items():
        path = ROOT / name
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('Fuente publicada diferente: ' + name)
        with zipfile.ZipFile(path) as archive:
            for member in members:
                entries['runtime/' + member] = archive.read(member)
    manifest = {'release': '2026.10.25-2', 'scope': 'Ensayo acotado sin SDK ni instalacion permanente.',
        'files': [{'name': name, 'sha256': hashlib.sha256(value).hexdigest()} for name, value in entries.items()]}
    entries['ENVIO_SHA256SUMS.json'] = (json.dumps(manifest, indent=2) + '\n').encode('utf-8')
    (ROOT / 'ENVIO_SHA256SUMS.json').write_bytes(entries['ENVIO_SHA256SUMS.json'])
    with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries.items():
            archive.writestr(name, data)
    print(target)
    print('SHA256:', hashlib.sha256(target.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
