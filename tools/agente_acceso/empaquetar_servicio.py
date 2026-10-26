"""Publicar la union sin modificar los95archivos del transporte anterior."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parent
OWN=['servicio_integrado.py','ciclo_operativo.py','respaldo_ciclo.py','emisor_servicio.py',
     'paquete_servicio.py','servicio_integrado_dell.py','simular_servicio.py',
     'verificar_servicio.ps1','lanzar_servicio_integrado.ps1','LEEME_SERVICIO_INTEGRADO.md',
     'tests/test_servicio_integrado.py','tests/test_ciclo_operativo.py',
     'tests/test_servicio_procesos.py','tests/test_ciclo_operativo_ace.py',
     'tests/test_servicio_dell.py','tests/servicio_proceso_ficticio.py',
     'tests/test_agente.py','tests/test_coordinador.py',
     'emisor.py','credencial.py','entregar_coordinador.py']


def main():
    target=ROOT/'Servicio_Integrado_2026.10.26-2.zip'
    if target.exists(): raise FileExistsError('Conservar publicacion; crear otra version.')
    previous=ROOT/'Transporte_Aplicador_2026.10.25-1.zip'
    if hashlib.sha256(previous.read_bytes()).hexdigest()!='12ddba273e71fce75e19defab9b33fd02a170d15551ad1056bf8794a0c7b45d9':
        raise ValueError('Transporte publicado diferente.')
    with zipfile.ZipFile(previous) as archive:
        entries={name:archive.read(name) for name in archive.namelist()}
    if len(entries)!=95 or any(name in entries for name in OWN):
        raise ValueError('Fuentes inesperadas/repetidas.')
    entries.update({name:(ROOT/name).read_bytes() for name in OWN})
    manifest={'release':'2026.10.26-2','scope':'Servicio unificado; entrada Dell readonly, sin instalacion ni aplicacion real.',
              'files':[{'name':name,'sha256':hashlib.sha256(data).hexdigest()} for name,data in entries.items()]}
    raw=(json.dumps(manifest,indent=2)+'\n').encode()
    (ROOT/'SERVICIO_SHA256SUMS.json').write_bytes(raw)
    entries['SERVICIO_SHA256SUMS.json']=raw
    with zipfile.ZipFile(target,'x',compression=zipfile.ZIP_DEFLATED) as archive:
        for name,data in entries.items(): archive.writestr(name,data)
    print('Archivos:',len(entries));print('Bytes:',target.stat().st_size)
    print('SHA256:',hashlib.sha256(target.read_bytes()).hexdigest())


if __name__=='__main__': main()
