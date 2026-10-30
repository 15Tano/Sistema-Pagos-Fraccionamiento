"""Instalacion real de Lecturas. Configurar/preflight sin mantenimiento; plan/install con gestor pausado."""
import argparse
import base64
from datetime import datetime,timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys

import credencial
from emisor import HttpTransport
from emisor_servicio import read,save,utc
import operacion_nativa as native
import produccion_config as config
from produccion_instalador import Installer
from produccion_r2 import check_ledger
from respaldo_mdb import private_directory
from respaldo_protegido import checked_path
import sesion_operativa as ownership

ROOT=Path(__file__).resolve().parent
SYNC=ownership.SYNC
SECRET=ROOT/'datos'/'credencial_produccion'/'ingesta.dpapi'


def verify():
    from produccion_paquete import verify_package
    verify_package()
    return hashlib.sha256((ROOT/'OPERATIVA_SHA256SUMS.json').read_bytes()).hexdigest()


def platform():
    if os.name!='nt' or struct.calcsize('P')!=8: raise PermissionError('Usar Python64 del usuario Dell.')
    import ctypes
    if not ctypes.windll.shell32.IsUserAnAdmin(): raise PermissionError('Usar PowerShell como administrador.')
    if not SYNC.is_dir(): raise PermissionError('Raiz instalada ausente.')


def credential_input(raw):
    if len(raw)>8192: raise ValueError('Entrada excedida.')
    ids=re.findall(r'^agent_id:\s*([0-9a-f-]+)\s*$',raw,re.M)
    tokens=re.findall(r'^token:\s*(sica_[0-9a-f]{64})\s*$',raw,re.M)
    if ids!=[config.AGENT] or len(tokens)!=1: raise ValueError('Credencial/identidad ajenas a produccion.')
    return credencial.validate(tokens[0])


def configure(raw):
    token=credential_input(raw)
    parent=SECRET.parent
    if parent.exists():
        if not SECRET.is_file() or credencial.load(SECRET)!=token: raise PermissionError('Configuracion anterior distinta; no sobrescribir.')
    else:
        private_directory(parent)
        credencial.store(SECRET,token)
    # Prueba de autenticacion: cuerpo vacio invalido; exige422 y NO crea datos ficticios.
    save(parent/'https.json',{'status':'checking','agent_id':config.AGENT})
    status,_,_=HttpTransport(config.URL,token,timeout=15).send('estado',b'{}')
    if status!=422: raise PermissionError('HTTPS/autenticacion no confirmados; credencial conservada, no instalar.')
    save(parent/'https.json',{'status':'verified','agent_id':config.AGENT,'serial':config.SERIAL,'url':config.URL,
        'credential_sha256':hashlib.sha256(SECRET.read_bytes()).hexdigest(),'checked_utc':utc(),'http_status':422})
    return {'status':'production_credential_and_https_verified','agent_id':config.AGENT,'serial':config.SERIAL,
        'http_expected':422,'synthetic_events_sent':False,'sdk_opened':False,'tasks_changed':False}


def https_proof():
    proof=read(SECRET.parent/'https.json')
    from control_operativo import stamp
    age=(datetime.now(timezone.utc)-stamp(proof.get('checked_utc'))).total_seconds()
    if (proof.get('status')!='verified' or proof.get('agent_id')!=config.AGENT or proof.get('serial')!=config.SERIAL or
            proof.get('url')!=config.URL or proof.get('http_status')!=422 or not -30<=age<=3600 or
            proof.get('credential_sha256')!=hashlib.sha256(SECRET.read_bytes()).hexdigest()):
        raise PermissionError('Repetir configurar para comprobar HTTPS de esta credencial.')
    return proof


def task_xml():
    source="""$ErrorActionPreference='Stop'; [Console]::OutputEncoding=New-Object Text.UTF8Encoding($false); $v=@{}; foreach($n in @('SanIsidro-Vigencias','SanIsidro-Vigilancia')) {$v[$n]=[string](Export-ScheduledTask -TaskName $n -ErrorAction Stop)}; $v|ConvertTo-Json -Compress"""
    encoded=base64.b64encode(source.encode('utf-16le')).decode()
    result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-EncodedCommand',encoded],
        capture_output=True,timeout=30,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),
        env={k:v for k,v in os.environ.items() if not k.upper().startswith('SANISIDRO_')})
    if result.returncode or len(result.stdout)>262144: raise RuntimeError('XML de tareas no confirmado.')
    return json.loads(result.stdout.decode('utf-8-sig'))


def guard():
    native.maintenance_guard(SYNC)
    from respaldo_real_mdb import quiet
    quiet()
    check_ledger(SYNC/'acceso-datos'/'cierres')


def installer(): return Installer(SYNC,ROOT,guard=guard,private=private_directory)


def preflight(release):
    library=installer().library
    for name,digest in library.ROOT_FILES.items():
        if library.sha(SYNC/name)!=digest: raise PermissionError('Fuente r2 distinta.')
    for name,digest in library.GESTOR_FILES.items():
        if library.sha(SYNC.parent/'GestionTags'/name)!=digest: raise PermissionError('Gestor distinto.')
    if any((SYNC/name).exists() for name in ('enlace-integrado.json','revision_instalacion.json','servicio-config.json','activacion-integrada.json')):
        raise PermissionError('Instalacion/configuracion previa; revisar antes de repetir.')
    native.task_contract(native.inventory(SYNC),maintenance=False)
    state=read(SYNC/'registros'/'estado.json')
    if state.get('protocol')!=2 or state.get('phase') not in ('idle','cycle') or state.get('consecutive_errors')!=0:
        raise PermissionError('Salud r2 requiere revision.')
    from control_operativo import stamp
    age=(datetime.now(timezone.utc)-stamp(state.get('last_ok_utc'))).total_seconds()
    if not -30<=age<=180: raise PermissionError('Ultimo ciclo r2 no reciente.')
    dll=Path(r'C:\Program Files (x86)\ZKTeco\ZKAccess3.5\NewSDK\plcommpro.dll')
    from adaptadores_cierre import SDK_HASH
    if hashlib.sha256(dll.read_bytes()).hexdigest()!=SDK_HASH: raise PermissionError('SDK instalado diferente.')
    # Solo metadatos/codigo: DPAPI se comprueba en configurar, no aqui.
    if not SECRET.is_file(): raise PermissionError('Configurar identidad propia antes de instalar.')
    https_proof()
    if (SYNC/'acceso-datos').exists(): raise PermissionError('Almacen previo; no adoptar ni reetiquetar.')
    if shutil.disk_usage(SYNC).free<8*1024**3: raise OSError('Reserva de disco insuficiente.')
    return {'status':'production_preflight_ok','release_sha256':release,'dates_engine':config.ENGINE,
        'sources_r2_match':True,'manager_match':True,'tasks_match':True,'sdk_hash_match':True,'pid':state['pid'],
        'last_ok_utc':state.get('last_ok_utc'),'credential_read':False,'sdk_opened':False,'tasks_changed':False,
        'next':'Preparar mantenimiento en gestor, cerrar lectores y generar plan.'}


def staged_credential():
    https_proof()
    token=credencial.load(SECRET)
    destination=SYNC/'acceso-datos'/'credencial-ingesta.dpapi'
    if destination.exists():
        if credencial.load(destination)!=token: raise PermissionError('Credencial instalada distinta.')
    else: credencial.store(destination,token)


def plan_output(value,release):
    return {'status':'production_installation_plan','plan_sha256':installer().library.digest(value),
        'release_sha256':release,'dates_engine':config.ENGINE,'root':str(SYNC),
        'changes':['entrada ZKSync','vigilancia (conserva r2)','guardias del gestor'],
        'preserves':['tareas y principal','motor r2 y su retorno','datos/credenciales instalados','colas de ensayo'],
        'agent_id':config.AGENT,'serial':config.SERIAL,'sdk_opened':False,'dates_applied':False}


def install(plan_digest,release):
    guard()
    with ownership.sync_lock(SYNC/'sync.lock'):
        guard();xml=task_xml();helper=installer();plan=helper.plan(xml)
        if helper.library.digest(plan)!=plan_digest: raise PermissionError('Plan cambio; revisar de nuevo.')
        token=credencial.load(SECRET)
        if (SYNC/'acceso-datos').exists(): raise PermissionError('Almacen previo; conservar y revisar.')
        private_directory(SYNC/'acceso-datos')
        credencial.store(SYNC/'acceso-datos'/'credencial-ingesta.dpapi',token)
        result=helper.stage(plan,xml,approved_sha256=plan_digest)
        activated=helper.activate(release,approved_sha256=release,credential_check=staged_credential)
        save(ROOT/'datos'/'instalacion.json',dict(result,**activated))
        return dict(result,**activated,next='Cerrar y reabrir gestor; Terminar y reanudar. Comprobar dos ciclos y lecturas web.')


def verify_closed():
    guard()
    with ownership.sync_lock(SYNC/'sync.lock'):
        guard()
    return {'status':'production_closure_confirmed','safe_to_resume':True,'sdk_opened':False,'tasks_changed':False}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    choice=parser.add_mutually_exclusive_group(required=True)
    for name in ('configurar','preflight','plan','instalar','verificar-cierre','plan-reversion','revertir','estado'):
        choice.add_argument('--'+name,action='store_true')
    parser.add_argument('--plan-sha256')
    args=parser.parse_args()
    try:
        release=verify();platform()
        if args.configurar: value=configure(sys.stdin.read(8193))
        elif args.preflight: value=preflight(release)
        elif args.plan:
            guard();xml=task_xml();value=plan_output(installer().plan(xml),release)
        elif args.instalar:
            if not re.fullmatch('[a-f0-9]{64}',args.plan_sha256 or ''): raise PermissionError('Falta hash del plan revisado.')
            value=install(args.plan_sha256,release)
        elif args.verificar_cierre: value=verify_closed()
        elif args.estado:
            state=read(SYNC/'registros'/'estado.json');operation=read(SYNC/'registros'/'operacion.json')
            value={'scope':'saved_production_state','vigencias':state,'operation':operation}
        else:
            guard();helper=installer();link=read(SYNC/'enlace-integrado.json')
            plan=helper.library.rollback_plan(SYNC,link['installation_id'],guard=guard)
            if args.plan_reversion:
                value={'status':'production_rollback_plan','plan_sha256':helper.library.digest(plan),'preserve_all_data':True}
            else:
                with ownership.sync_lock(SYNC/'sync.lock'):
                    value=helper.rollback(approved_sha256=args.plan_sha256)
        print(json.dumps(value,indent=2));return 0
    except BaseException as exc:
        print(json.dumps({'status':'production_not_confirmed','error_type':type(exc).__name__,
            'note':'Conservar estado/evidencia; no borrar marcas ni forzar tareas. No pegar credenciales.'},indent=2))
        return 1


if __name__=='__main__': raise SystemExit(main())
