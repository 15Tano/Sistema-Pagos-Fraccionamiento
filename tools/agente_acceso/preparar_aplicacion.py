"""Prepara alcance real readonly de un tag. No emite Approval ni aplica fechas."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import signal
import struct
import threading
import uuid

import aplicacion_vigencias as app
import ensayo_puente_readonly as trial
import vigencias_candidato as core
import adaptadores_cierre as closures
from referencia_vigencias import EXPECTED, load_reference
from trabajador_controlado import SDKGate

ROOT=Path(__file__).resolve().parent


def verify_package():
    value=json.loads((ROOT/'APLICADOR_SHA256SUMS.json').read_text(encoding='utf-8-sig'))
    names=[row['name'] for row in value['files']]
    if value['release']!='2026.10.25-2' or len(names)!=55 or len(set(names))!=55:
        raise ValueError('Manifiesto inesperado.')
    for row in value['files']:
        name=row['name']
        if (PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or ':' in name or '\\' in name or
                hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=row['sha256']):
            raise ValueError('Fuente/ruta diferente.')


def collect(card,fetch_api,read_access,read_panel,progress=lambda stage:None):
    if not core.number(card) or card=='0': raise app.ScopeRejected('Tag invalido.')
    progress('api')
    rows=fetch_api()
    if card not in app.api_values(rows): raise app.ScopeRejected('Tag ausente de API.')
    progress('access');access=read_access(card)
    if access is None: raise app.ScopeRejected('Tag ausente de Access.')
    progress('c3');c3=read_panel(card)
    if c3 is None: raise app.ScopeRejected('Tag ausente de C3.')
    progress('plan');value=app.make_plan(card,rows,access,c3)
    return {'plan':value,'plan_sha256':app.digest(value),'approval_issued':False}


def prepare(card):
    if os.name!='nt' or struct.calcsize('P')!=8: raise RuntimeError('Usar lanzador x64/DPAPI.')
    if any(ROOT.is_relative_to(Path(p).resolve()) for p in (trial.SYNC,r'C:\SanIsidro\GestionTags')):
        raise RuntimeError('Usar carpeta separada.')
    diag=closures.diagnostic_module();diag.maintenance_guard()
    password=os.environ.get('SANISIDRO_ACCESS_PASSWORD')
    if not password: raise RuntimeError('Usar lanzador DPAPI.')
    for name,digest in EXPECTED.items():
        if hashlib.sha256((trial.SYNC/name).read_bytes()).hexdigest()!=digest:
            raise RuntimeError('Instalacion r2 diferente.')
    if (trial.DATA/'revision_vigencias.json').exists(): raise core.ReviewRequired('Revision pendiente.')
    core.check_operations(trial.DATA/'cierres')
    pub=trial.publisher()
    with pub.own_lock(ROOT/'preparacion.lock'),diag.maintenance_lock():
        trial.quiet(trial.inspector().inventory())
        state_path=ROOT/'estado_puente.json'
        if state_path.exists() and pub.read(state_path).get('phase')!='stopped': raise RuntimeError('Preparacion anterior incompleta.')
        folder=ROOT/'datos'/'sesiones'/str(uuid.uuid4());folder.mkdir(parents=True)
        state={'pid':os.getpid(),'run_id':folder.name,'phase':'running','started_utc':closures.now()}
        pub.save(state_path,state)
        event=threading.Event();old_signal=signal.signal(signal.SIGINT,lambda *_:event.set())
        connection=None
        def stopped():
            if event.is_set(): return True
            try: return pub.read(ROOT/'detener_puente.json')==trial.identity(state)
            except (OSError,ValueError): return False
        try:
            source=load_reference()
            def api():
                if stopped(): raise app.ScopeRejected('Parada solicitada.')
                with source.urllib.request.urlopen(source.api_request(),timeout=30) as response:
                    return json.loads(response.read().decode('utf-8'))
            def access(card):
                nonlocal connection
                if stopped(): raise app.ScopeRejected('Parada solicitada.')
                import pyodbc
                escaped='{'+password.replace('}','}}')+'}'
                connection=pyodbc.connect('Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq='+source.DB_PATH+';PWD='+escaped+';',
                    readonly=True,autocommit=False,timeout=15)
                return app.AccessDates(connection).read(card)
            exchange=core.Exchange(SDKGate(),trial.DATA/'cierres',folder.name,
                lambda request,digest:[r'C:\Users\Dell\Python32\python.exe','-B',str(ROOT/'puente_sdk_readonly.py'),
                    '--worker',str(request),'--sha256',digest])
            def panel(card):
                if stopped(): raise app.ScopeRejected('Parada solicitada.')
                return exchange({'mode':'read'}).get(card)
            print('PREPARACION SOLO LECTURA: API, Access y C3 de un tag; no emite aprobacion ni aplica fechas.',flush=True)
            def progress(stage):
                state.update(stage=stage,heartbeat_utc=closures.now());pub.save(state_path,state)
            result=collect(card,api,access,panel,progress)
            core.durable(folder/'plan_propuesto.json',core.encoded(result))
            result|={'plan_created':True,'error_type':None}
        except (Exception,KeyboardInterrupt) as exc:
            result={'plan_created':False,'error_type':type(exc).__name__,'stage':state.get('stage'),'approval_issued':False}
        finally:
            signal.signal(signal.SIGINT,old_signal)
            if connection is not None:
                try: connection.rollback()
                except Exception as exc: result={'plan_created':False,'error_type':type(exc).__name__,'stage':'access_rollback','approval_issued':False}
                finally:
                    try: connection.close()
                    except Exception as exc: result={'plan_created':False,'error_type':type(exc).__name__,'stage':'access_close','approval_issued':False}
        try:
            proof=trial.receipts(folder.name)
            trial.quiet(trial.inspector().inventory(),[r['pid'] for r in proof['current']])
            result|={'phase':'stopped','receipts':proof}
        except Exception as exc:
            result|={'phase':'fault','closure_error_type':type(exc).__name__}
        result|=trial.identity(state)|{'ended_utc':closures.now()}
        pub.save(folder/'resultado.json',result)
        pub.save(state_path,state|{'phase':result['phase']})
        print(json.dumps(result,indent=2));print('Evidencia: '+str(folder))
        print('FIN preparacion. Verificar cierre antes de reanudar.' if result['phase']=='stopped' else 'CIERRE NO CONFIRMADO. Conservar mantenimiento y evidencia.')
        return 0 if result['phase']=='stopped' and result['plan_created'] else 1


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--preparar',action='store_true');mode.add_argument('--verificar-cierre',action='store_true');mode.add_argument('--detener',action='store_true')
    parser.add_argument('--tag')
    args=parser.parse_args()
    try:
        verify_package()
        if args.verificar_cierre: return trial.verify_closed()
        if args.detener:
            state=trial.publisher().read(ROOT/'estado_puente.json')
            if state.get('phase')!='running': raise RuntimeError('Preparacion no activa.')
            trial.publisher().save(ROOT/'detener_puente.json',trial.identity(state));print('Parada solicitada. Esperar FIN preparacion y verificar cierre.');return 0
        if not args.tag: raise app.ScopeRejected('Tag requerido.')
        return prepare(args.tag)
    except (Exception,KeyboardInterrupt) as exc:
        print(json.dumps({'status':'preparacion_no_confirmada','error_type':type(exc).__name__}));return 1


if __name__=='__main__': raise SystemExit(main())
