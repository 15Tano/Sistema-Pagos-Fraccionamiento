"""Generar copias candidatas minimas; nunca editar GestionTags instalado/local."""
import hashlib
from pathlib import Path

ROOT=Path(__file__).resolve().parent
EXPECTED={'gt_backend.py':'5ded829ecd5467f4f08553baf44698d3dd21afdbbf0970a8fffe8735e5e74749',
          'mantenimiento.ps1':'840c500933e644fb9545c88091a287416a018b7c3e16434d634138531b97b4f4'}


def main():
    target=ROOT/'gestor_candidato';target.mkdir(exist_ok=True)
    for name,digest in EXPECTED.items():
        raw=(ROOT.parent/'gestion_tags'/name).read_bytes()
        if hashlib.sha256(raw).hexdigest()!=digest: raise ValueError('Fuente de gestor diferente; no generar parche.')
        reference=ROOT/'referencia_operacion'/name
        if reference.exists() and reference.read_bytes()!=raw: raise ValueError('Referencia anterior distinta.')
        reference.write_bytes(raw)
        newline=b'\r\n' if b'\r\n' in raw else b'\n'
        if name=='gt_backend.py':
            anchor=b'def paused():'+newline
            if raw.count(anchor)!=1: raise ValueError('Ancla de paused distinta.')
            replacement=(b'def paused(*, allow_partial_review=True):'+newline+
                b'    from gt_guard_operativo import require_closed'+newline+
                b'    require_closed(allow_partial_review=allow_partial_review)'+newline)
            raw=raw.replace(anchor,replacement)
            anchor=b'    paused()'+newline+b"    review=ROOT/'revision_pendiente.json'"
            if raw.count(anchor)!=1: raise ValueError('Ancla de apply distinta.')
            raw=raw.replace(anchor,b'    paused(allow_partial_review=False)'+newline+b"    review=ROOT/'revision_pendiente.json'")
        else:
            check=r"""& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B (Join-Path $root 'gt_guard_operativo.py')
    if($LASTEXITCODE -ne 0){throw 'Cierre operativo sin confirmar; conservar mantenimiento.'}
""".replace('\n',newline.decode()).encode()
            anchor=b"    Write-Output 'Polling pausado; no habia proceso activo.'"
            if raw.count(anchor)!=1:raise ValueError('Ancla de polling inactivo distinta.')
            raw=raw.replace(anchor,b'    '+check+anchor)
            anchor=b"Write-Output 'Polling pausado entre ciclos. Se puede consultar o aplicar un tag.'"
            if raw.count(anchor)!=1:raise ValueError('Ancla de pausa completada distinta.')
            raw=raw.replace(anchor,check+anchor)
            anchor=b'    # V1 no acepta parada cooperativa.'
            insertion=(b"    if(Test-Path (Join-Path $syncRoot 'enlace-integrado.json')){throw 'Estado protocol2 no confirmado; no se interrumpio el servicio integrado.'}"+newline)
            if raw.count(anchor)!=1:raise ValueError('Ancla V1 distinta.')
            raw=raw.replace(anchor,insertion+anchor)
            anchor=b'    if($previous.wasEnabled){'+newline
            if raw.count(anchor)!=1: raise ValueError('Ancla de reanudar distinta.')
            insertion=r"""    & 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B (Join-Path $root 'gt_guard_operativo.py') --reanudar
    if($LASTEXITCODE -ne 0){throw 'Cierre operativo sin confirmar; no se reanudo el polling.'}
""".replace('\n',newline.decode()).encode()
            raw=raw.replace(anchor,insertion+anchor)
        (target/name).write_bytes(raw)
    (target/'gt_guard_operativo.py').write_bytes((ROOT/'guardia_gestor_operativo.py').read_bytes())
    print('Copias candidatas de gestor generadas; ninguna instalacion modificada.')


if __name__=='__main__': main()
