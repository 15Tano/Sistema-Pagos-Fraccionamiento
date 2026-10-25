"""Congelar puente readonly y dependencias publicadas, sin sobrescribir ZIP."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
OWN = ['puente_sdk_readonly.py','ensayo_puente_readonly.py','tests/test_puente_sdk_readonly.py',
       'simular_puente_readonly.py','verificar_puente_readonly.ps1','lanzar_puente_readonly.ps1','LEEME_PUENTE_READONLY.md']
BUNDLES = [('Cierres_Coordinador_2026.10.24-1.zip','62afc55c986178e8086035fa978c7d2241f715296f359cc02997db7698819a11',''),
           ('Envio_Vigilado_2026.10.25-2.zip','03b415a4e7aba6941d4eac219c4f986f863dbe8c1af1553591b9e611219f226b','envio/')]


def main():
    target=ROOT/'Puente_Readonly_2026.10.25-1.zip'
    if target.exists(): raise FileExistsError('Publicar otra version; no sobrescribir.')
    entries={}
    for name,digest,prefix in BUNDLES:
        path=ROOT/name
        if hashlib.sha256(path.read_bytes()).hexdigest()!=digest: raise ValueError('Paquete publicado diferente.')
        with zipfile.ZipFile(path) as bundle:
            for name in bundle.namelist(): entries[prefix+name]=bundle.read(name)
    core=ROOT/'Nucleo_Vigencias_2026.10.25-1.zip'
    if hashlib.sha256(core.read_bytes()).hexdigest()!='2370108844b2276a30765746c5319180cb3c8a59f44d53066deeb453fb87ea65': raise ValueError('Nucleo publicado diferente.')
    with zipfile.ZipFile(core) as bundle:
        for name in ('vigencias_candidato.py','tests/test_vigencias_candidato.py'): entries[name]=bundle.read(name)
    if any(name in entries for name in OWN): raise ValueError('Ruta propia repetida.')
    entries.update({name:(ROOT/name).read_bytes() for name in OWN})
    if len(entries)!=45: raise ValueError('Fuentes inesperadas.')
    manifest={'release':'2026.10.25-1','scope':'Puente SDK readonly; sin aplicacion ni instalacion.',
              'files':[{'name':name,'sha256':hashlib.sha256(data).hexdigest()} for name,data in entries.items()]}
    raw=(json.dumps(manifest,indent=2)+'\n').encode('utf-8')
    (ROOT/'PUENTE_SHA256SUMS.json').write_bytes(raw);entries['PUENTE_SHA256SUMS.json']=raw
    with zipfile.ZipFile(target,'x',compression=zipfile.ZIP_DEFLATED) as bundle:
        for name,data in entries.items(): bundle.writestr(name,data)
    print('Archivos:',len(entries));print('Bytes:',target.stat().st_size)
    print('SHA256:',hashlib.sha256(target.read_bytes()).hexdigest())


if __name__=='__main__': main()
