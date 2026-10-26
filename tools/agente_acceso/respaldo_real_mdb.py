"""Entrada acotada de respaldo MDB, sin SDK/API/escrituras de origen/restauracion."""
import argparse
import contextlib
import hashlib
import itertools
import json
import os
from pathlib import Path, PurePosixPath
import signal
import struct
import threading
import time
import uuid

import aplicacion_vigencias as app
import ensayo_puente_readonly as trial
import respaldo_mdb as mdb
import respaldo_protegido as protected
from referencia_vigencias import EXPECTED
import vigencias_candidato as core

ROOT=Path(__file__).resolve().parent
DESTINATION=Path(r'C:\SanIsidro\RespaldoReal_20261025')
SOURCE=Path(r'C:\Program Files (x86)\ZKTeco\ZKAccess3.5\Database_PRO.mdb')
PLAN_PATH=Path(r'C:\SanIsidro\AplicadorCandidato_20261025\datos\sesiones\a4230256-23f4-4f6e-8e92-2eacba40c19b\plan_propuesto.json')
PLAN_SHA='709d7809d4259fb89847a2f5ef68aa15af1f69f1f3f6da9a4123fd3be2d58416'
MAX_SECONDS=180
MAX_RUNS=64


class StopRequested(RuntimeError):
    pass


def pub(): return trial.publisher()


def verify_package():
    manifest=pub().read(ROOT/'RESPALDO_REAL_SHA256SUMS.json')
    names=[row['name'] for row in manifest['files']]
    if manifest['release']!='2026.10.25-1' or len(names)!=79 or len(set(names))!=79:
        raise ValueError('Manifiesto inesperado.')
    for row in manifest['files']:
        name=row['name']
        if (not name or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or ':' in name or '\\' in name or
                hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=row['sha256']):
            raise ValueError('Fuente/ruta diferente.')


def read_plan():
    protected.checked_path(PLAN_PATH)
    value=pub().read(PLAN_PATH,65536)
    if (set(value)!={'plan','plan_sha256','approval_issued'} or value['approval_issued'] is not False or
            value['plan_sha256']!=PLAN_SHA or app.digest(value['plan'])!=PLAN_SHA):
        raise ValueError('Plan historico distinto del revisado.')
    app.validate_plan(value['plan'])
    return value['plan']


def preflight(*,check_capacity=True):
    if os.name!='nt' or struct.calcsize('P')!=8 or protected.checked_path(ROOT).resolve()!=DESTINATION.resolve():
        raise RuntimeError('Usar Python64 y carpeta de destino indicada.')
    protected.checked_path(SOURCE);protected.checked_path(trial.SYNC)
    for name,digest in EXPECTED.items():
        path=protected.checked_path(trial.SYNC/name)
        if hashlib.sha256(path.read_bytes()).hexdigest()!=digest: raise ValueError('Instalacion r2 distinta.')
    for name in ('access-password.dpapi','sync.lock'):
        path=protected.checked_path(trial.SYNC/name)
        if not path.is_file() or not 0<path.stat().st_size<=65536: raise ValueError('Falta archivo instalado requerido.')
    plan=read_plan()
    size=SOURCE.stat().st_size
    if not 0<size<=mdb.MAX_MDB_BYTES: raise ValueError('MDB vacia/excedida.')
    if check_capacity: mdb.admit(ROOT/'datos'/'mdb_reales',size)
    return {'status':'preflight_ok','card':plan['card'],'plan_sha256':PLAN_SHA,'source_bytes':size,
            'source_opened':False,'credential_read':False,'maintenance_required_for_backup':True,
            'meaning':'Solo rutas/metadatos/codigo/plan. No prueba clave, contenido MDB, cierre ni salud de polling.'}


def quiet(forbidden=()):
    snapshot=trial.inspector().inventory()
    tasks=[row for row in snapshot['tasks'] if row['name']=='SanIsidro-Vigencias']
    if len(tasks)!=1 or tasks[0]['enabled'] is not False or tasks[0]['state']!='Disabled':
        raise RuntimeError('La tarea de vigencias debe estar deshabilitada por el gestor.')
    state=pub().read(trial.SYNC/'registros'/'estado.json')
    if state.get('protocol')!=2 or state.get('phase')!='stopped' or type(state.get('pid')) is not int or state['pid']<1:
        raise RuntimeError('Parada r2 no confirmada.')
    trial.quiet(snapshot,[state['pid'],*forbidden])


def revisions():
    if (trial.DATA/'revision_vigencias.json').exists() or (trial.DATA/'cierre_inseguro.json').exists():
        raise RuntimeError('Revision/cierre SDK anterior pendiente.')
    core.check_operations(trial.DATA/'cierres')


def session_capacity():
    folder=ROOT/'datos'/'sesiones'
    if folder.exists():
        rows=list(itertools.islice(folder.iterdir(),MAX_RUNS+1))
        if len(rows)>=MAX_RUNS: raise OSError('Limite de sesiones; no se borran evidencias.')
        for row in rows:
            protected.checked_path(row)
            if not row.is_dir() or str(uuid.UUID(row.name))!=row.name: raise ValueError('Sesion ajena.')
    return folder


def previous_closed(state):
    try:
        identity=trial.identity(state)
        if state.get('phase')!='stopped': raise ValueError('Fase incompleta.')
        folder=ROOT/'datos'/'sesiones'/identity['run_id']
        result=pub().read(folder/'resultado.json');proof=pub().read(folder/'cierre_final.json')
        if (trial.identity(result)!=identity or result.get('phase')!='stopped' or
                trial.identity(proof)!=identity or proof.get('status')!='cierre_respaldo_confirmado' or
                proof.get('source_handle_free') is not True or proof.get('sdk_opened') is not False or
                proof.get('result_sha256')!=app.digest(result) or proof.get('backup_verified')!=result.get('backup_verified')):
            raise ValueError('Cierre anterior no vinculado.')
    except (OSError,ValueError,KeyError,TypeError):
        raise RuntimeError('Falta cierre verificable del respaldo anterior; no repetir.') from None


def backup(run_id):
    if not isinstance(run_id,str) or str(uuid.UUID(run_id))!=run_id: raise ValueError('UUID de lanzamiento requerido.')
    preflight()
    password=os.environ.pop('SANISIDRO_ACCESS_PASSWORD',None)
    if password is None: raise RuntimeError('Usar lanzador DPAPI.')
    for key in list(os.environ):
        if key.upper().startswith('SANISIDRO_'): os.environ.pop(key,None)
    diag=trial.closures.diagnostic_module();diag.maintenance_guard();revisions()
    with pub().own_lock(ROOT/'respaldo_real.lock'),diag.maintenance_lock():
        quiet()
        state_path=ROOT/'estado_respaldo.json'
        if state_path.exists(): previous_closed(pub().read(state_path))
        sessions=session_capacity();sessions.mkdir(parents=True,exist_ok=True)
        folder=sessions/run_id;folder.mkdir(exist_ok=False)
        state={'pid':os.getpid(),'run_id':folder.name,'phase':'running','started_utc':app.utc_now().isoformat()}
        def publish(extra):
            state.update(extra);pub().save(state_path,state);pub().save(folder/'estado.json',state)
        publish({'stage':'starting','heartbeat_utc':app.utc_now().isoformat()})
        event=threading.Event();old=signal.signal(signal.SIGINT,lambda *_:event.set())
        started=time.monotonic();last_publish=[started]
        def fast_guard():
            if event.is_set() or time.monotonic()-started>MAX_SECONDS: raise StopRequested('Parada/limite solicitado.')
            maintenance=pub().read(diag.GESTOR/'mantenimiento.json')
            if maintenance.get('active') is not True or (diag.GESTOR/'revision_pendiente.json').exists():
                raise StopRequested('Mantenimiento no disponible.')
            stop=ROOT/'detener_respaldo.json'
            if stop.exists() and pub().read(stop)==trial.identity(state): raise StopRequested('Parada solicitada.')
            if time.monotonic()-last_publish[0]>2:
                publish({'heartbeat_utc':app.utc_now().isoformat()});last_publish[0]=time.monotonic()
        guard_calls=[0]
        def guard():
            fast_guard();diag.maintenance_guard();revisions();quiet()
            guard_calls[0]+=1
            publish({'stage':'copying' if guard_calls[0]==1 else 'validating_copy','heartbeat_utc':app.utc_now().isoformat()})
        @contextlib.contextmanager
        def guarded_source(path):
            with mdb.exclusive_source(path) as stream:
                class CheckedStream:
                    def fileno(self): return stream.fileno()
                    def read(self,size): fast_guard();return stream.read(size)
                yield CheckedStream()
        result=None
        try:
            receipt=mdb.create_backup(SOURCE,ROOT/'datos'/'mdb_reales',password,read_plan(),guard=guard,source_open=guarded_source)
            fast_guard();quiet()
            result={'phase':'stopped','backup_verified':True,'receipt':receipt,'error_type':None}
        except (Exception,KeyboardInterrupt) as exc:
            # Sin SDK/escritura de origen. Solo un verificador posterior al proceso
            # acredita cierre: una excepcion no demuestra recursos liberados.
            result={'phase':'stopped','backup_verified':False,'receipt':None,'error_type':type(exc).__name__,
                    'stage':state.get('stage'),'cause_type':type(exc.__context__).__name__ if exc.__context__ else None}
        finally:
            signal.signal(signal.SIGINT,old);password=None
            result=result or {'phase':'fault','backup_verified':False,'receipt':None,'error_type':'IncompleteRun'}
            result|=trial.identity(state)|{'ended_utc':app.utc_now().isoformat(),'approval_issued':False,'sdk_opened':False}
            core.durable(folder/'resultado.json',core.encoded(result))
            publish({'phase':result['phase'],'stage':'finished','heartbeat_utc':app.utc_now().isoformat()})
        print(json.dumps(result,indent=2));print('Evidencia: '+str(folder))
        print('FIN respaldo. El lanzador verificara cierre tras salir Python; aun no reanudar.')
        return 0 if result['backup_verified'] else 1


def verify_closed(expected_run_id=None):
    preflight(check_capacity=False)
    state=pub().read(ROOT/'estado_respaldo.json');identity=trial.identity(state)
    if expected_run_id is not None and expected_run_id!=identity['run_id']: raise ValueError('Cierre de otro lanzamiento.')
    folder=ROOT/'datos'/'sesiones'/identity['run_id']
    result=pub().read(folder/'resultado.json')
    if (state.get('phase')!='stopped' or result.get('phase')!='stopped' or trial.identity(result)!=identity or
            result.get('sdk_opened') is not False or result.get('approval_issued') is not False or
            type(result.get('backup_verified')) is not bool): raise RuntimeError('Resultado no cerrado.')
    diag=trial.closures.diagnostic_module()
    with pub().own_lock(ROOT/'respaldo_real.lock'),diag.maintenance_lock():
        revisions();quiet([identity['pid']])
        with mdb.exclusive_source(SOURCE): pass
        if result['backup_verified']:
            receipt=result['receipt'];key=receipt['backup_id']
            if str(uuid.UUID(key))!=key: raise ValueError('Referencia MDB invalida.')
            copied=protected.checked_path(ROOT/'datos'/'mdb_reales'/key)
            manifest=pub().read(copied/'manifest.json',16384)
            if (manifest!=receipt or receipt.get('status')!='copy_verified' or receipt.get('plan_sha256')!=PLAN_SHA or
                    receipt.get('serial')!=core.SERIAL or receipt.get('card')!=read_plan()['card'] or
                    (copied/'Database_PRO_antes.mdb').stat().st_size!=receipt['mdb_bytes'] or
                    mdb.file_hash(copied/'Database_PRO_antes.mdb')!=receipt['mdb_sha256']):
                raise ValueError('Copia/recibo alterados.')
        elif result.get('receipt') is not None: raise ValueError('Recibo inesperado.')
        if pub().read(ROOT/'estado_respaldo.json')!=state: raise RuntimeError('Cambio de ejecucion durante verificacion.')
        proof={'status':'cierre_respaldo_confirmado',**identity,'backup_verified':result['backup_verified'],
               'result_sha256':app.digest(result),'checked_utc':app.utc_now().isoformat(),'source_handle_free':True,'sdk_opened':False}
        pub().save(folder/'cierre_final.json',proof)
    print(json.dumps(proof,indent=2))
    print('Cierre confirmado. Terminar y reanudar en el gestor; comprobar dos ciclos nuevos.')
    return 0


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    mode=parser.add_mutually_exclusive_group(required=True)
    for option in ('preflight','respaldar','detener','verificar-cierre'): mode.add_argument('--'+option,action='store_true')
    parser.add_argument('--run-id')
    args=parser.parse_args()
    try:
        verify_package()
        if args.preflight: print(json.dumps(preflight(),indent=2));return 0
        if args.verificar_cierre: return verify_closed(args.run_id)
        if args.detener:
            state=pub().read(ROOT/'estado_respaldo.json')
            if state.get('phase')!='running': raise RuntimeError('Respaldo no activo.')
            pub().save(ROOT/'detener_respaldo.json',trial.identity(state))
            print('Parada solicitada. Esperar FIN y cierre del lanzador, sin reanudar todavia.');return 0
        return backup(args.run_id)
    except (Exception,KeyboardInterrupt) as exc:
        print(json.dumps({'status':'respaldo_no_confirmado','error_type':type(exc).__name__,
                          'note':'No reanudar hasta cierre_respaldo_confirmado; conservar evidencia.'}));return 1


if __name__=='__main__': raise SystemExit(main())
