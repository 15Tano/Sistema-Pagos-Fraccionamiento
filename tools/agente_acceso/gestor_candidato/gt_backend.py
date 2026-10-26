"""Gestor por tag: preparar, comprobar en copia MDB y aplicar sin depender de r2."""
import datetime as dt
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import uuid

from gt_access import Access
from gt_crypto import crypt
from gt_model import build_plan, value
from gt_utils import (ROOT, SYNC_ROOT, DB_PATH, BACKUP_ROOT, PYTHON32, API_URL,
                      TEMPLATE_CARD, card_number, api_values, pack, unpack,
                      digest, lock, save_json, copy_exclusive)


def encrypted_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(crypt(json.dumps(pack(data), ensure_ascii=True).encode()))


def encrypted_read(path):
    return unpack(json.loads(crypt(path.read_bytes(), decrypt=True).decode()))


def c3(request):
    temp_root=ROOT/'temporales'; temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as folder:
        source, target=Path(folder)/'consulta.dpapi',Path(folder)/'respuesta.dpapi'
        encrypted_write(source, request)
        environment=dict(os.environ)
        for key in ('SANISIDRO_ACCESS_PASSWORD','SANISIDRO_API_TOKEN'):
            environment.pop(key,None)
        process=subprocess.run([PYTHON32,str(ROOT/'gt_worker.py'),str(source),str(target)],
                               capture_output=True,timeout=180,env=environment,
                               creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        if process.returncode or not target.exists():
            # El traceback del SDK no se copia a la interfaz ni puede revelar registros.
            raise RuntimeError('La controladora no completo la operacion. Si se estaba escribiendo, revisa el respaldo antes de reanudar.')
        return encrypted_read(target)


def api_now():
    headers={'Accept':'application/json','Cache-Control':'no-cache'}
    token=os.environ.get('SANISIDRO_API_TOKEN')
    if token: headers['Authorization']='Bearer '+token
    try:
        with urllib.request.urlopen(urllib.request.Request(API_URL,headers=headers),timeout=30) as response:
            return api_values(json.loads(response.read().decode('utf-8')))
    except Exception as exc:
        raise RuntimeError('No se pudo validar la API. No se autorizan cambios sin consultarla correctamente.') from exc


def access_state(card,password):
    connection=Access(DB_PATH,password)
    try: return connection.state(card)
    finally: connection.close()


def paused(*, allow_partial_review=True):
    from gt_guard_operativo import require_closed
    require_closed(allow_partial_review=allow_partial_review)
    record=ROOT/'mantenimiento.json'
    if not record.exists() or not json.loads(record.read_text(encoding='utf-8-sig')).get('active'):
        raise RuntimeError('Primero pulsa Preparar mantenimiento.')


def load_reference(card,password,access,panel):
    backup={'user':None,'members':[],'issued':[],'c3':{}}
    old_mdb=BACKUP_ROOT/'Database_PRO_antes.mdb'
    old_panel=BACKUP_ROOT/'controladora_antes.dpapi'
    if access['user'] is None or card not in panel['usuarios']:
        if not old_mdb.exists() or not old_panel.exists():
            raise ValueError('Falta el respaldo completo de la depuracion. No se creara un registro sin descartar una recuperacion historica.')
        backup['c3']=encrypted_read(old_panel)
    if access['user'] is None and old_mdb.exists():
        source=Access(old_mdb,password)
        try:
            old=source.state(card)
            backup.update({k:old[k] for k in ('user','members','issued')})
            backup['reserved_userids']=[value(r,'USERID') for r in old['identities']]
        finally: source.close()
    if access['user'] is None and card in backup['c3'].get('usuarios',{}) and backup['user'] is None:
        raise ValueError('El respaldo del equipo contiene el tag pero su registro Access no existe. Requiere revision.')
    if card not in panel['usuarios'] and backup['user'] is not None and card not in backup['c3'].get('usuarios',{}):
        raise ValueError('Falta el registro del equipo en el respaldo historico. No se inventaran sus permisos.')
    template={}
    missing_local=access['user'] is None and backup['user'] is None
    missing_panel=card not in panel['usuarios'] and card not in backup['c3'].get('usuarios',{})
    if missing_local or missing_panel:
        source=Access(DB_PATH,password)
        try:
            reference=source.user(TEMPLATE_CARD)
            if reference is None: raise ValueError('No existe el tag de referencia para altas nuevas.')
            pin=str(value(reference,'Badgenumber'))
            permits=[r for r in panel['permisos'] if r['Pin']==pin]
            if TEMPLATE_CARD not in panel['usuarios'] or panel['usuarios'][TEMPLATE_CARD]['Pin']!=pin:
                raise ValueError('La referencia de Access y de la controladora no coincide.')
            if len(permits)!=1 or permits[0]['AuthorizeDoorId']!='3' or permits[0]['AuthorizeTimezoneId']!='2':
                raise ValueError('La referencia no coincide con las dos plumas comprobadas. No se inventaran permisos.')
            memberships=source.members(value(reference,'USERID'))
            if len(memberships)!=1: raise ValueError('La referencia no tiene un unico nivel de acceso.')
            level=value(memberships[0],'acclevelset_id')
            if not source.select('SELECT id FROM acc_levelset WHERE id = ?',level):
                raise ValueError('Falta el nivel local de la referencia.')
            template={'user':reference,'permits':permits,'level_id':level,'members':memberships}
        finally: source.close()
    return backup,template


def public_plan(plan,access,panel):
    end=plan['api_end']
    access_end=value(access['user'] or {},'acc_enddate')
    current=panel['usuarios'].get(plan['card'],{})
    return {'tag':plan['card'],'api':end.strftime('%d/%m/%Y 23:59:59') if end else 'No aparece',
            'access':'Existe' if access['user'] else ('Recuperable del respaldo' if plan['access_action']=='recuperar registro' else 'Nuevo'),
            'c3':'Existe' if plan['card'] in panel['usuarios'] else ('Recuperable del respaldo' if plan['c3_action'].startswith('recuperar') else 'Nuevo'),
            'local_name':str(value(access['user'] or plan['access_target'],'name','') or ''),
            'access_end':access_end.strftime('%d/%m/%Y') if isinstance(access_end,dt.datetime) else str(access_end or 'Sin fecha'),
            'c3_end':current.get('EndTime','Sin registro'),
            'access_action':plan['access_action'],'c3_action':plan['c3_action'],
            'can_apply':plan['can_apply'],
            'message':('No aparece en la API. Los registros nuevos o recuperados quedaran vencidos (02/01/2020). '
                       'Los registros que ya existen se conservan. Asocia el tag al vecino correcto en la aplicacion web.'
                       if end is None else 'Se usara exclusivamente la vigencia de la API. Los permisos existentes se conservan.')}


def consult(request,password):
    card=card_number(request['tag']); name=str(request.get('name','')).strip()
    if len(name)>40 or any(ord(c)<32 for c in name): raise ValueError('Usa un nombre de hasta 40 caracteres.')
    paused()
    with lock():
        api=api_now(); access=access_state(card,password); panel=c3({'mode':'read'})
        for row in access['identities']:
            raw=str(value(row,'CardNo','') or '').strip()
            if raw.isascii() and raw.isdigit() and int(raw)==int(card) and raw!=card:
                raise ValueError('El numero ya existe con otra representacion en Access. Requiere revision; no se duplicara.')
        backup,template=load_reference(card,password,access,panel)
        plan=build_plan(card,name,api.get(card),access,panel,backup,template)
        public=public_plan(plan,access,panel)
        if plan['can_apply']:
            token=uuid.uuid4().hex
            encrypted_write(ROOT/'planes'/(token+'.dpapi'),{'created':time.time(),'plan':plan,
                             'access_before':access,'panel_before':panel})
            public['plan_id']=token
        review=ROOT/'revision_pendiente.json'
        if review.exists():
            public['message']+=' Hay una revision pendiente; solo se permiten consultas hasta resolverla.'
            public['can_apply']=False
        return public


def apply(request,password):
    token=str(request['plan_id'])
    if len(token)!=32 or any(c not in '0123456789abcdef' for c in token):
        raise ValueError('Plan de trabajo no valido. Consulta de nuevo.')
    path=ROOT/'planes'/(token+'.dpapi')
    saved=encrypted_read(path); plan=saved['plan']; card=plan['card']
    if not plan['can_apply'] or time.time()-saved['created']>900:
        raise ValueError('La consulta vencio. Consulta nuevamente antes de aplicar.')
    paused(allow_partial_review=False)
    review=ROOT/'revision_pendiente.json'
    if review.exists():
        raise ValueError('Hay una escritura pendiente de revision. Se permiten consultas, pero requiere revisar el respaldo antes de otra escritura o de reanudar.')
    with lock():
        if api_now().get(card)!=plan['api_end']:
            raise ValueError('La vigencia de la API cambio. Consulta nuevamente.')
        if digest(access_state(card,password))!=digest(saved['access_before']):
            raise ValueError('Access cambio desde la consulta. Consulta nuevamente.')
        if c3({'mode':'read'})!=saved['panel_before']:
            raise ValueError('La controladora cambio desde la consulta. Consulta nuevamente.')
        folder=ROOT/'respaldos'/('tag_'+card+'_'+dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
        folder.mkdir(parents=True)
        copy_exclusive(DB_PATH,folder/'Database_PRO_antes.mdb')
        encrypted_write(folder/'controladora_antes.dpapi',saved['panel_before'])
        encrypted_write(folder/'plan.dpapi',saved)
        save_json(folder/'resultado.json',{'tag':card,'etapa':'respaldo creado','completado':False})
        # Validar defaults, AutoNumber y relaciones con el driver REAL antes de tocar el MDB original o el equipo.
        validation=folder/'validacion.mdb'
        shutil.copyfile(folder/'Database_PRO_antes.mdb',validation)
        connection=Access(validation,password,readonly=False)
        try:
            if digest(connection.state(card))!=digest(saved['access_before']):
                raise ValueError('La base cambio antes del respaldo. Consulta nuevamente.')
            connection.apply(plan); connection.conn.commit(); connection.apply(dict(plan,access_action='sin cambios'))
        finally: connection.close()
        validation.unlink()
        connection=Access(DB_PATH,password,readonly=False)
        hardware_attempted=False; commit_attempted=False
        try:
            if digest(connection.state(card))!=digest(saved['access_before']):
                raise ValueError('Access cambio durante la preparacion. Consulta nuevamente.')
            connection.apply(plan)
            if api_now().get(card)!=plan['api_end']:
                raise ValueError('La API cambio durante la preparacion. No se aplico la transaccion.')
            if plan['c3_action']!='sin cambios':
                save_json(review,{'tag':card,'respaldo':str(folder),'etapa':'escritura del equipo iniciada; requiere resultado verificado'})
                hardware_attempted=True
                c3({'mode':'apply','before':saved['panel_before'],'card':card,
                    'target':plan['c3_target'],'permits':plan['permits']})
            elif c3({'mode':'read'})!=saved['panel_before']:
                raise ValueError('La controladora cambio antes de confirmar Access.')
            commit_attempted=True
            save_json(review,{'tag':card,'respaldo':str(folder),'etapa':'confirmacion de Access iniciada; requiere resultado verificado'})
            connection.conn.commit()
            connection.apply(dict(plan,access_action='sin cambios'))
            save_json(folder/'resultado.json',{'tag':card,'etapa':'verificado','completado':True,
                       'access':plan['access_action'],'c3':plan['c3_action'],
                       'api_end':plan['api_end'].isoformat() if plan['api_end'] else None})
            review.unlink()
            path.unlink()
            return {'message':'Tag '+card+' aplicado y verificado. '+('Los registros nuevos o recuperados se guardaron vencidos porque no aparece en la API. Los preexistentes se conservaron. '
                    if plan['without_api'] and (plan['access_action'].startswith(('crear','recuperar')) or plan['c3_action'].startswith(('crear','recuperar'))) else '')+
                    'Pulsa Terminar y reanudar cuando acabes.','backup':str(folder),'can_apply':False}
        except Exception:
            connection.conn.rollback()
            if hardware_attempted or commit_attempted:
                save_json(review,{'tag':card,'respaldo':str(folder),'etapa':'verificacion pendiente'})
            raise
        finally: connection.close()


def maintenance(mode):
    process=subprocess.run(['powershell.exe','-NoProfile','-ExecutionPolicy','Bypass','-File',
                            str(ROOT/'mantenimiento.ps1'),'-Operacion',mode],capture_output=True,
                            timeout=400,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    if process.returncode:
        # Errores propios de mantenimiento no contienen credenciales.
        detail=process.stderr.decode('utf-8',errors='replace')[-1600:]
        raise RuntimeError('No se completo el mantenimiento. '+detail)
    return {'message':process.stdout.decode('utf-8',errors='replace').strip(),'paused':mode=='pausar'}


def main():
    target=Path(sys.argv[2])
    try:
        request=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
        mode=request['mode']
        if mode in ('pause','resume'): result=maintenance('pausar' if mode=='pause' else 'reanudar')
        else:
            password=os.environ.get('SANISIDRO_ACCESS_PASSWORD')
            if not password: raise RuntimeError('No se recibio la credencial protegida de Access.')
            if mode=='consult': result=consult(request,password)
            elif mode=='apply': result=apply(request,password)
            else: raise ValueError('Operacion no reconocida.')
        save_json(target,dict(result,ok=True))
    except Exception as exc:
        # ODBC puede incluir datos de columnas; mantener esa excepcion solo cifrada.
        identifier=uuid.uuid4().hex
        encrypted_write(ROOT/'errores'/(identifier+'.dpapi'),{'type':type(exc).__name__,'detail':str(exc)})
        message=str(exc) if isinstance(exc,(ValueError,RuntimeError)) else 'La operacion no se completo. Revisa las rutas, permisos y el esquema de la base.'
        save_json(target,{'ok':False,'message':message,'support_id':identifier})
        return 1
    return 0


if __name__=='__main__': sys.exit(main())
