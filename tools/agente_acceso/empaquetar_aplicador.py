"""Publicacion inmutable del aplicador candidato, sin launcher de escritura."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parent
OWN=['aplicacion_vigencias.py','puente_sdk_fechas.py','preparar_aplicacion.py',
     'tests/test_aplicacion_vigencias.py','tests/test_preparacion_aplicacion.py','simular_aplicador.py',
     'verificar_aplicador.ps1','lanzar_preparacion_aplicacion.ps1','LEEME_APLICADOR_CANDIDATO.md']


def main():
    target=ROOT/'Aplicador_Candidato_2026.10.25-2.zip'
    if target.exists(): raise FileExistsError('Crear otra version; conservar ZIP publicado.')
    old=ROOT/'Puente_Readonly_2026.10.25-1.zip'
    if hashlib.sha256(old.read_bytes()).hexdigest()!='347a629e28ba5be4bcebc7f8ed46abe9649025ff89806b241a6059fc839acd00': raise ValueError('Puente publicado diferente.')
    with zipfile.ZipFile(old) as bundle: entries={name:bundle.read(name) for name in bundle.namelist()}
    if any(name in entries for name in OWN): raise ValueError('Ruta propia repetida.')
    entries.update({name:(ROOT/name).read_bytes() for name in OWN})
    if len(entries)!=55: raise ValueError('Fuentes inesperadas.')
    manifest={'release':'2026.10.25-2','scope':'Aplicador candidato sin launcher de escritura; preparador readonly.',
              'files':[{'name':name,'sha256':hashlib.sha256(data).hexdigest()} for name,data in entries.items()]}
    raw=(json.dumps(manifest,indent=2)+'\n').encode()
    (ROOT/'APLICADOR_SHA256SUMS.json').write_bytes(raw);entries['APLICADOR_SHA256SUMS.json']=raw
    with zipfile.ZipFile(target,'x',compression=zipfile.ZIP_DEFLATED) as bundle:
        for name,data in entries.items(): bundle.writestr(name,data)
    print('Archivos:',len(entries));print('Bytes:',target.stat().st_size)
    print('SHA256:',hashlib.sha256(target.read_bytes()).hexdigest())


if __name__=='__main__': main()
