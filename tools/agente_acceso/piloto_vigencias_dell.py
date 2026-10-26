"""Piloto acotado y voluntario. No instala, activa servicios, lee RT o envia datos."""
import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import queue
import signal
import struct
import sys
import threading
import time
import types
import urllib.request
import uuid

import adaptadores_cierre as closures
import aplicacion_vigencias as app
import aplicador_integrado as integrated
import instalacion_operativa as installed
import operacion_nativa as native
import piloto_vigencias as pilot
import respaldo_ciclo as checkpoint
import respaldo_mdb as mdb
import respaldo_protegido as protected
import sesion_operativa as session
from emisor_servicio import read,save
from paquete_piloto import ROOT,verify_package
from referencia_vigencias import load_reference
from trabajador_controlado import SDKGate

DESTINATION=Path(r'C:\SanIsidro\PilotoVigencias_20261026')
SYNC=Path(r'C:\SanIsidro\ZKSync')
PYTHON32=Path(r'C:\Users\Dell\Python32\python.exe')
SOURCE=Path(r'C:\Program Files (x86)\ZKTeco\ZKAccess3.5\Database_PRO.mdb')


class ElevationRequired(PermissionError):pass


def is_elevated():
    import ctypes
    if os.name!='nt':return False
    check=ctypes.WinDLL('shell32',use_last_error=True).IsUserAnAdmin
    check.argtypes=[];check.restype=ctypes.c_int
    return bool(check())


def preflight():
    if os.name!='nt' or struct.calcsize('P')!=8 or protected.checked_path(ROOT).resolve()!=DESTINATION.resolve():
        raise PermissionError('Usar Python64 y carpeta indicada.')
    if not is_elevated():raise ElevationRequired('Abrir PowerShell como administrador antes del piloto.')
    for name,digest in installed.ROOT_FILES.items():
        if installed.sha(SYNC/name)!=digest:raise PermissionError('r2 instalado diferente.')
    for name,digest in installed.GESTOR_FILES.items():
        if installed.sha(SYNC.parent/'GestionTags'/name)!=digest:raise PermissionError('Gestor instalado diferente.')
    for path in (PYTHON32,SOURCE,SYNC/'access-password.dpapi',SYNC/'sync.lock'):
        if not protected.checked_path(path).is_file():raise ValueError('Falta dependencia instalada.')
    if (SYNC/'enlace-integrado.json').exists():raise PermissionError('Piloto preparado para r2 sin enlace.')
    return {'status':'preflight_ok','scope':'rutas_metadatos_hashes_sin_sdk_red_mdb_credenciales',
        'elevated':True,'dates_applied':False,'tasks_changed':False,'maintenance_required_for_pilot':True}


def maintenance(expected_review=None,*,inspect=None):
    native.task_contract((inspect or native.inventory)(SYNC),maintenance=True)
    flag=read(SYNC.parent/'GestionTags'/'mantenimiento.json');state=read(SYNC/'registros'/'estado.json')
    if flag.get('active') is not True or state.get('protocol')!=2 or state.get('phase')!='stopped':
        raise PermissionError('Pausar por gestor y comprobar parada r2.')
    review=SYNC.parent/'GestionTags'/'revision_pendiente.json'
    if review.exists() and (expected_review is None or read(review)!=expected_review):
        raise PermissionError('Revision ajena pendiente; no continuar.')
    from guardia_gestor_operativo import require_closed
    require_closed(SYNC,allow_partial_review=False)


def quiet(forbidden=()):
    import ensayo_puente_readonly as previous
    snapshot=previous.inspector().inventory()
    # Solo excluir el proceso actual; no aceptar otro script/PID por parecido de nombre.
    snapshot['processes']=[row for row in snapshot['processes'] if row['pid']!=os.getpid()]
    previous.quiet(snapshot,forbidden)


def confirmation(plan,expected,*,stop=lambda:False,seconds=120,source=None):
    print('RESPALDO VERIFICADO. Para aplicar UNICAMENTE este plan escriba:',flush=True)
    print(expected,flush=True);print('ENTER sin texto cancela. Tiempo maximo 120 segundos:',flush=True)
    lines=queue.Queue()
    def reader():
        try:lines.put((source or sys.stdin).readline().strip())
        except Exception:lines.put('')
    threading.Thread(target=reader,daemon=True).start();deadline=time.monotonic()+seconds
    while not stop() and time.monotonic()<deadline:
        try:return lines.get(timeout=.1)==expected
        except queue.Empty:pass
    return False


def receipt_rows(data):
    ledger=Path(data)/'cierres';app.core.check_operations(ledger);rows=[]
    for folder in sorted(ledger.iterdir()) if ledger.exists() else []:
        ack=read(folder/'parent_ack.json');closed=closures.verified_closure(folder,ack['pid'])
        if closed.get('error_type')=='ControllerIdentityError':raise app.core.ReviewRequired('Serial no confirmado.')
        rows.append({'worker_id':folder.name,'pid':ack['pid'],'closure_sha256':installed.sha(folder/'closed.json')})
    return rows


def mark_review(marker):
    path=SYNC.parent/'GestionTags'/'revision_pendiente.json'
    if path.exists():
        if read(path)!=marker:raise PermissionError('No sustituir revision ajena.')
    else:installed.durable(path,app.core.encoded(marker))


def hold_uncertain(gate,*,sleep=time.sleep):
    if gate.fault or gate.active is not None:
        try:print('CIERRE SDK SIN CONFIRMAR. Se conserva sync.lock; requiere revision manual.',flush=True)
        except Exception:pass
        while True:sleep(1)


@contextlib.contextmanager
def access_dates(source,password,*,readonly=False,connect=None):
    if not isinstance(password,str) or password!=password.strip() or any(ord(c)<32 or c==';' for c in password):
        raise PermissionError('Credencial incompatible.')
    if any(c in str(source) for c in ';{}\r\n\0'):raise PermissionError('Ruta ODBC incompatible.')
    if connect is None:
        import pyodbc
        connect=pyodbc.connect
    connection=connect('Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq='+str(source)+';PWD='+password+';',
        readonly=readonly,autocommit=False,timeout=15)
    try:yield app.AccessDates(connection)
    finally:
        try:connection.rollback()
        finally:connection.close()


def check_previous():
    path=ROOT/'estado_piloto.json'
    if not path.exists():return
    state=read(path);folder=protected.checked_path(ROOT/'datos'/'sesiones'/str(uuid.UUID(state['run_id'])))
    result=read(folder/'resultado.json');proof=read(folder/'cierre_final.json')
    if (state.get('phase')!='stopped' or proof.get('status')!='cierre_piloto_confirmado' or proof.get('safe_to_resume') is not True or
            proof.get('run_id')!=state['run_id'] or proof.get('pid')!=state['pid'] or
            proof.get('result_sha256')!=app.digest(result) or result.get('phase')!='stopped'):
        raise PermissionError('Cierre anterior o aplicacion pendiente; no repetir.')


def run_actual(card,run_id):
    if not isinstance(run_id,str) or str(uuid.UUID(run_id))!=run_id:raise ValueError('UUID de lanzamiento requerido.')
    preflight();maintenance();check_previous()
    password=os.environ.pop('SANISIDRO_ACCESS_PASSWORD',None)
    if not password:raise PermissionError('Usar lanzador DPAPI.')
    # Token API solo en padre; el transporte filtra todo SANISIDRO_ para hijos SDK.
    folder=ROOT/'datos'/'sesiones'/run_id
    sessions=folder.parent;sessions.mkdir(parents=True,exist_ok=True)
    if sum(1 for _ in sessions.iterdir())>=64:raise OSError('Limite de sesiones; no borrar evidencia.')
    mdb.private_directory(folder)
    marker={'protocol':1,'purpose':'pilot_vigencias','run_id':run_id,'pid':os.getpid()}
    gate=SDKGate();event=threading.Event();started=time.monotonic();write_started=[False]
    old=signal.signal(signal.SIGINT,lambda *_:event.set())
    result=None
    try:
        with session.sync_lock(SYNC/'sync.lock'):
            preflight();maintenance();quiet();session.require_locked(SYNC/'sync.lock')
            parent={'protocol':1,'purpose':'pilot_parent','run_id':run_id,'root':str(ROOT.resolve()),
                'native':session.native_identity(os.getpid()),'review_marker':marker}
            installed.durable(folder/'parent.dpapi',protected.dpapi(app.core.encoded(parent)))
            mark_review(marker)  # Bloquear reanudacion del gestor hasta prueba posterior al proceso.
            save(ROOT/'estado_piloto.json',{'pid':os.getpid(),'run_id':run_id,'phase':'running'})
            def stop():return event.is_set() or time.monotonic()-started>300
            def guard():
                # No comprobar stop a mitad de C3/Access: completar el tag o marcar revision.
                flag=read(SYNC.parent/'GestionTags'/'mantenimiento.json')
                state=read(SYNC/'registros'/'estado.json')
                review=SYNC.parent/'GestionTags'/'revision_pendiente.json'
                if flag.get('active') is not True or state.get('phase')!='stopped' or state.get('protocol')!=2:
                    raise PermissionError('Mantenimiento interrumpido.')
                if review.exists() and read(review)!=marker:raise PermissionError('Revision ajena.')
                session.require_locked(SYNC/'sync.lock')
            def command(worker,digest):
                grant={'protocol':1,'purpose':'pilot_child','run_id':run_id,'worker_id':worker.name,
                    'worker_run_id':closures.request_at(worker/'request.json')['run_id'],
                    'operation_sha256':digest,'parent_sha256':installed.sha(folder/'parent.dpapi')}
                installed.durable(worker/'pilot_grant.dpapi',protected.dpapi(app.core.encoded(grant)))
                return [str(PYTHON32),'-B',str(ROOT/'piloto_sdk_worker.py'),'--worker',str(worker),'--sha256',digest]
            data=folder/'sdk';sdk=checkpoint.CycleTransport(data,PYTHON32,gate=gate,guard=guard,
                command_factory=command,timeout=60)
            reference=load_reference()
            def api():
                with urllib.request.urlopen(reference.api_request(),timeout=15) as response:raw=response.read(4*1024*1024+1)
                if len(raw)>4*1024*1024:raise ValueError('API excedida.')
                return json.loads(raw)
            def access():return access_dates(SOURCE,password,readonly=False)
            def read_access(tag):
                with access_dates(SOURCE,password,readonly=True) as value:return value.read(tag)
            def prepare(plans,key):
                def between():
                    guard()
                    if stop():raise app.ScopeRejected('Parada antes de preparar respaldo.')
                return checkpoint.prepare(plans,SOURCE,folder/'mdb',password,sdk,key,folder/'bundles',guard=between)
            def publish(value):
                if not (folder/'plan.json').exists():installed.durable(folder/'plan.json',app.core.encoded(value['plan']))
                save(folder/'preview.json',value);print(json.dumps(value,indent=2),flush=True)
            def before_write(plan):
                preflight();maintenance(marker);guard();mark_review(marker);write_started[0]=True
            try:
                print('PILOTO UN TAG: sin RT, tareas nuevas ni servicio continuo.',flush=True)
                result=pilot.run(card,api,read_access,sdk,prepare,access,folder/'transacciones',guard=guard,
                    confirm=lambda plan,phrase:confirmation(plan,phrase,stop=stop),publish=publish,
                    before_write=before_write,stop=stop)
            except BaseException as exc:
                result={'status':'rejected','error_type':type(exc).__name__,
                    'dates_applied':None if write_started[0] else False,
                    'approval_issued':None,'confirmation_received':write_started[0],
                    'changes_may_have_occurred':write_started[0]}
            finally:
                # No liberar exclusion aunque fallen publicaciones o marcas.
                hold_uncertain(gate)
            try:
                receipts=receipt_rows(data);quiet([row['pid'] for row in receipts])
                integrated.check_runs(folder/'transacciones')
                result.update(phase='stopped',worker_receipts=receipts)
            except Exception as exc:
                mark_review(marker);result.update(phase='fault',closure_error_type=type(exc).__name__)
            result.update(pid=os.getpid(),run_id=run_id,card=card,review_marker=marker,
                ended_utc=closures.now(),sdk_closed=True,tasks_changed=False)
            installed.durable(folder/'resultado.json',app.core.encoded(result))
            save(ROOT/'estado_piloto.json',{'pid':os.getpid(),'run_id':run_id,'phase':result['phase']})
            print(json.dumps(result,indent=2));print('Evidencia: '+str(folder),flush=True)
            return 0 if result['phase']=='stopped' else 1
    finally:
        signal.signal(signal.SIGINT,old);password=None
        os.environ.pop('SANISIDRO_API_TOKEN',None)


def verify_closed(expected_run_id):
    preflight();state=read(ROOT/'estado_piloto.json')
    if state.get('run_id')!=expected_run_id or state.get('phase')!='stopped':raise PermissionError('Cierre de otra ejecucion/incompleto.')
    folder=protected.checked_path(ROOT/'datos'/'sesiones'/str(uuid.UUID(expected_run_id)))
    result=read(folder/'resultado.json');marker=result['review_marker']
    expected_marker={'protocol':1,'purpose':'pilot_vigencias','run_id':expected_run_id,'pid':state['pid']}
    if (type(state.get('pid')) is not int or state['pid']<1 or marker!=expected_marker or
            result.get('pid')!=state['pid'] or result.get('run_id')!=state['run_id'] or result.get('phase')!='stopped'):
        raise PermissionError('Resultado ajeno.')
    with session.sync_lock(SYNC/'sync.lock'):
        maintenance(marker);quiet([state['pid']]);rows=receipt_rows(folder/'sdk')
        if rows!=result['worker_receipts']:raise PermissionError('Recibos cambiaron.')
        integrated.check_runs(folder/'transacciones')
        with mdb.exclusive_source(SOURCE):pass
        proof={'status':'cierre_piloto_confirmado','pid':state['pid'],'run_id':expected_run_id,
            'result_sha256':app.digest(result),'checked_utc':closures.now(),'safe_to_resume':True,
            'dates_applied':result['dates_applied'],'source_handle_free':True}
        review=SYNC.parent/'GestionTags'/'revision_pendiente.json'
        if review.exists() and read(review)!=marker:raise PermissionError('No retirar marca ajena.')
        save(folder/'cierre_recursos.json',proof)
        if review.exists():
            if read(review)!=marker:raise PermissionError('No retirar marca ajena.')
            review.unlink()  # Solo nuestra marca exacta, despues del cierre y transacciones verificadas.
        save(folder/'cierre_final.json',proof)
    print(json.dumps(proof,indent=2));print('Cierre confirmado. Terminar y reanudar en gestor; comprobar dos ciclos nuevos.')
    return 0


def main():
    parser=argparse.ArgumentParser(description=__doc__);mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--piloto',action='store_true');mode.add_argument('--preflight',action='store_true')
    mode.add_argument('--verificar-cierre',action='store_true');parser.add_argument('--tag');parser.add_argument('--run-id')
    args=parser.parse_args()
    try:
        verify_package()
        if args.preflight:print(json.dumps(preflight(),indent=2));return 0
        if args.verificar_cierre:return verify_closed(args.run_id)
        if not app.core.number(args.tag) or args.tag=='0':raise app.ScopeRejected('Un tag numerico requerido.')
        return run_actual(args.tag,args.run_id)
    except (Exception,KeyboardInterrupt) as exc:
        print('PILOTO NO CONFIRMADO: '+type(exc).__name__+'. Conservar evidencia; no reanudar sin cierre confirmado.')
        return 1


if __name__=='__main__':raise SystemExit(main())
