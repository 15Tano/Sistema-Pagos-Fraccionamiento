"""Padre/hijo SDK concreto. CLI interna de trabajador, sin emitir autorizaciones."""
import argparse
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import struct

import aplicacion_vigencias as app
import aplicador_integrado as integrated
import adaptadores_cierre as closures
import respaldo_protegido as protected
import vigencias_candidato as core
from puente_sdk_readonly import ReadOnlyPanel,run_readonly
from puente_sdk_fechas import DatesPanel
from trabajador_controlado import SDKGate,run_closed_worker

ROOT=Path(__file__).resolve().parent
DESTINATION=Path(r'C:\SanIsidro\TransporteAplicador_20261025')
PYTHON32=Path(r'C:\Users\Dell\Python32\python.exe')


class ProfilePanel(ReadOnlyPanel):
    """Lectura de siete campos/permisos; nunca enlaza SetDeviceData."""
    def __init__(self,plan,diagnostic=None):
        self.plan=copy.deepcopy(plan);self.serial_verified=False
        super().__init__(diagnostic)
    def serial(self):
        value=ReadOnlyPanel.serial(self);self.serial_verified=value==core.SERIAL;return value
    read_table=DatesPanel.read_table
    def user(self,card):
        if card!=self.plan['card']: raise app.ScopeRejected('Tag ajeno.')
        rows=self.read_table('user','CardNo='+card)
        if (len(rows)!=1 or set(rows[0])!=core.USER_FIELDS or not all(core.text(v) for v in rows[0].values()) or
                {key:rows[0][key] for key in core.FIELDS}!=self.plan['c3_before']):
            raise ValueError('Perfil actual distinto del plan.')
        return rows[0]
    def permissions(self,pin):
        if pin!=self.plan['c3_before']['Pin']: raise app.ScopeRejected('Pin ajeno.')
        return protected.permissions(self.read_table('userauthorize','Pin='+pin),pin)


def read_operation(folder,digest):
    folder=protected.checked_path(folder);request=closures.request_at(folder/'request.json')
    profile=folder/'profile_operation.json';normal=folder/'operation.json'
    if profile.exists()==normal.exists(): raise app.ScopeRejected('Una sola operacion requerida.')
    path=profile if profile.exists() else normal
    raw=path.read_bytes() if path.stat().st_size<=closures.MAX_RESPONSE else b''
    if not raw or hashlib.sha256(raw).hexdigest()!=digest: raise app.ScopeRejected('Operacion alterada.')
    value=json.loads(raw)
    if profile.exists():
        if set(value)!={'mode','plan'} or value['mode']!='profile': raise app.ScopeRejected('Operacion de perfil invalida.')
        app.validate_plan(value['plan'])
    else: core.validate(value)
    if request['role']!='vigencias': raise app.ScopeRejected('Rol ajeno.')
    return request,value


def profile_worker(folder,request,plan,diagnostic=None):
    panel=None;opened=False;clean=True;response=None;error=None;sdk_hash=None;started=closures.now()
    try:
        panel=ProfilePanel(plan,diagnostic);opened=True;panel.open();sdk_hash=panel.sdk_sha256
        if sdk_hash!=closures.SDK_HASH or panel.serial()!=core.SERIAL: raise closures.ControllerIdentityError('Identidad distinta.')
        user=panel.user(plan['card']);permits=panel.permissions(user['Pin'])
        store=protected.Store(folder.parent.parent/'perfiles')
        meta=store.seal(plan,user,permits)
        response=core.encoded({'mode':'profile','plan_sha256':app.digest(plan),'snapshot':meta})
    except Exception as exc: error=type(exc).__name__
    finally:
        if opened:
            try: panel.disconnect()
            except BaseException: clean=False
            try: panel.close_library()
            except BaseException: clean=False
        if response is not None: core.durable(folder/'response.json',response)
        closures.write_closure(folder,request,started=started,closed=clean,operation_ok=response is not None,
            sdk_sha256=sdk_hash,error_type=error,response=response)
    return 0 if clean else 1


def approval_at(folder,request,digest):
    path=protected.checked_path(folder/'grant.dpapi')
    if path.stat().st_size>65536: raise app.ScopeRejected('Autorizacion excedida.')
    raw=protected.dpapi(path.read_bytes(),decrypt=True)
    if len(raw)>65536: raise app.ScopeRejected('Autorizacion excedida.')
    grant=json.loads(raw)
    if (set(grant)!={'protocol','purpose','run_id','worker_id','operation_sha256','plan','approved_sha256','approved_utc','evidence','bundle','mdb_root','profile_root'} or
            type(grant['protocol']) is not int or grant['protocol']!=1 or grant['purpose']!='apply_dates' or
            grant['run_id']!=request['run_id'] or grant['worker_id']!=request['worker_id'] or grant['operation_sha256']!=digest):
        raise app.ScopeRejected('Autorizacion no vinculada.')
    stamp=dt.datetime.fromisoformat(grant['approved_utc'])
    if stamp.tzinfo is None or stamp.utcoffset()!=dt.timedelta(0): raise app.ScopeRejected('UTC requerido.')
    # La construccion usa el instante original, nunca now para renovar el TTL.
    scope=app.Approval(grant['plan'],confirmed=True,approved_sha256=grant['approved_sha256'],clock=lambda:stamp)
    scope.clock=app.utc_now;scope.check()
    bundle=integrated.Bundle(grant['bundle'],grant['mdb_root'],protected.Store(grant['profile_root']))
    return scope,Path(grant['evidence']),bundle


def worker(folder,digest,diagnostic=None):
    folder=Path(folder)
    if any((folder/name).exists() for name in ('closed.json','parent_ack.json','response.json','write_attempt.json')):
        raise app.ScopeRejected('Trabajador ya utilizado.')
    request,operation=read_operation(folder,digest)
    if operation['mode']=='profile': return profile_worker(folder,request,operation['plan'],diagnostic)
    if operation['mode']=='read': return run_readonly(folder,digest,lambda:ReadOnlyPanel(diagnostic))
    scope,evidence,bundle=approval_at(folder,request,digest)
    return integrated.run_worker(folder,digest,scope,evidence,bundle,diagnostic)


class Transport:
    """Requiere guard del padre con sync.lock adquirido; no gestiona tareas."""
    def __init__(self,root,python32,*,gate,guard,command_factory=None,timeout=120):
        if not isinstance(gate,SDKGate) or not callable(guard): raise ValueError('Gate/guard requeridos.')
        self.root=Path(root);self.ledger=self.root/'cierres';self.store=protected.Store(self.root/'perfiles')
        self.gate=gate;self.guard=guard;self.timeout=timeout
        self.command=command_factory or (lambda folder,digest:[str(python32),'-B',str(ROOT/'transporte_aplicador.py'),
            '--worker',str(folder),'--sha256',digest])

    def _check(self):
        self.guard();core.check_operations(self.ledger)
        if (self.root/'revision_vigencias.json').exists(): raise core.ReviewRequired('Revision anterior pendiente.')
        if self.gate.fault or self.gate.active is not None: raise core.ReviewRequired('SDK ocupado/incierto.')
        for path in self.ledger.glob('*/profile_operation.json'):
            ack=closures.bounded_json(path.parent/'parent_ack.json');closed=closures.verified_closure(path.parent,ack['pid'])
            if closed['error_type']=='ControllerIdentityError': raise core.ReviewRequired('Identidad previa requiere revision.')

    def _dispatch(self,operation,run_id,*,scope=None,evidence=None,bundle=None):
        self._check();folder=closures.new_session(self.ledger,run_id,'vigencias')
        raw=core.encoded(operation);digest=hashlib.sha256(raw).hexdigest()
        core.durable(folder/('profile_operation.json' if operation['mode']=='profile' else 'operation.json'),raw)
        if scope is not None:
            plan=scope.check();bundle.check(plan)
            grant={'protocol':1,'purpose':'apply_dates','run_id':run_id,'worker_id':folder.name,'operation_sha256':digest,
                   'plan':plan,'approved_sha256':scope.sha256,'approved_utc':scope.created.isoformat(),
                   'evidence':str(Path(evidence).resolve()),'bundle':str(bundle.path.resolve()),
                   'mdb_root':str(bundle.mdb_root.resolve()),'profile_root':str(bundle.store.root.resolve())}
            encrypted=protected.dpapi(core.encoded(grant))
            core.durable(folder/'grant.dpapi',encrypted)
            scope.consume('c3')  # Un despacho, incluso si luego falla iniciar el hijo.
        def proof(child):
            closed=closures.verified_closure(folder,child.pid)
            if operation['mode']=='profile':
                if closed['operation_ok']:
                    response=closures.bounded_json(folder/'response.json')
                    if response.get('mode')!='profile' or response.get('plan_sha256')!=app.digest(operation['plan']):
                        raise ValueError('Respuesta de perfil ajena.')
                    meta=response['snapshot'];snapshot=self.store.open(meta['snapshot_id'],plan_sha256=app.digest(operation['plan']))
                    if snapshot['plan']!=operation['plan']: raise ValueError('Perfil de otro alcance.')
            else: core.read_result(folder,digest,operation,closed)
            closures.acknowledge(folder,child.pid)
            return True
        try:
            child=run_closed_worker(self.gate,'vigencias',self.command(folder,digest),verify_closed=proof,timeout=self.timeout)
        except BaseException:
            closures.fatal(self.gate,self.ledger,run_id,'transport_child_unconfirmed')
        closed=closures.verified_closure(folder,child.pid)
        if not closed['operation_ok']:
            if closed['error_type']=='ControllerIdentityError':
                core.durable(self.root/'revision_vigencias.json',core.encoded({'run_id':run_id,'reason':'controller_identity'}))
            raise core.ReviewRequired('Operacion fallida con cierre confirmado; revisar evidencia.')
        return child,folder

    def capture_profile(self,plan,run_id):
        app.validate_plan(plan)
        child,folder=self._dispatch({'mode':'profile','plan':plan},run_id)
        response=closures.bounded_json(folder/'response.json');meta=response['snapshot']
        # El objeto con campos privados permanece solo en memoria del padre.
        return {'child':child,'folder':folder,'snapshot_id':meta['snapshot_id'],
                'snapshot':self.store.open(meta['snapshot_id'],plan_sha256=app.digest(plan))}

    def read_child(self,card,run_id):
        if not core.number(card): raise ValueError('Tag invalido.')
        return self._dispatch({'mode':'read'},run_id)

    def apply_child(self,payload,scope,evidence,bundle,run_id):
        scope.check();bundle.check(scope.plan)
        expected={'mode':'apply','changes':[{'card':scope.plan['card'],'before':scope.plan['c3_before'],
            'end':app.parse_date(scope.plan['api_end']).strftime('%Y%m%d')}]}
        if payload!=expected or 'c3' in scope.consumed: raise app.ScopeRejected('Despacho ajeno/repetido.')
        return self._dispatch(payload,run_id,scope=scope,evidence=evidence,bundle=bundle)


def verify_package():
    manifest=closures.bounded_json(ROOT/'TRANSPORTE_APLICADOR_SHA256SUMS.json',131072)
    from pathlib import PurePosixPath
    names=[row['name'] for row in manifest['files']]
    if manifest['release']!='2026.10.25-1' or len(names)!=94 or len(set(names))!=94: raise ValueError('Manifiesto inesperado.')
    for row in manifest['files']:
        name=row['name']
        if (not name or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or ':' in name or '\\' in name or
                hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=row['sha256']): raise ValueError('Fuente/ruta diferente.')


def preflight():
    import respaldo_real_mdb as previous
    from referencia_vigencias import EXPECTED
    if os.name!='nt' or struct.calcsize('P')!=8 or protected.checked_path(ROOT).resolve()!=DESTINATION.resolve():
        raise RuntimeError('Usar carpeta indicada y Python64.')
    if not PYTHON32.is_file(): raise RuntimeError('Falta Python32 instalado.')
    for name,digest in EXPECTED.items():
        if hashlib.sha256((previous.trial.SYNC/name).read_bytes()).hexdigest()!=digest: raise ValueError('Referencia instalada distinta.')
    previous.revisions();plan=previous.read_plan()
    return {'status':'preflight_ok','card':plan['card'],'plan_sha256':app.digest(plan),
            'sdk_connected':False,'dates_applied':False,'maintenance_required_for_capture':True}


def profile_proofs(root,run_id):
    core.check_operations(Path(root)/'cierres');rows=[]
    for path in (Path(root)/'cierres').glob('*/request.json'):
        request=closures.request_at(path)
        if request['run_id']!=run_id: continue
        ack=closures.bounded_json(path.parent/'parent_ack.json');closed=closures.verified_closure(path.parent,ack['pid'])
        operation=closures.bounded_json(path.parent/'profile_operation.json',65536)
        if operation.get('mode')!='profile': raise ValueError('Operacion ajena.')
        app.validate_plan(operation['plan'])
        if closed['error_type']=='ControllerIdentityError': raise core.ReviewRequired('Controlador distinto.')
        rows.append({'worker_id':path.parent.name,'pid':ack['pid'],
                     'closure_sha256':hashlib.sha256((path.parent/'closed.json').read_bytes()).hexdigest()})
    return sorted(rows,key=lambda row:row['worker_id'])


def capture_actual(run_id):
    import respaldo_real_mdb as previous
    import signal
    import threading
    import uuid
    preflight()
    if not isinstance(run_id,str) or str(uuid.UUID(run_id))!=run_id: raise ValueError('UUID requerido.')
    diag=closures.diagnostic_module();diag.maintenance_guard()
    pub=previous.pub();stop=threading.Event();old=signal.signal(signal.SIGINT,lambda *_:stop.set())
    try:
        with pub.own_lock(ROOT/'transporte.lock'),diag.maintenance_lock():
            previous.quiet()
            state_path=ROOT/'estado_transporte.json'
            if state_path.exists():
                state=pub.read(state_path);key=previous.trial.identity(state)
                prior=ROOT/'datos'/'sesiones'/key['run_id'];result=pub.read(prior/'resultado.json');proof=pub.read(prior/'cierre_final.json')
                if (state.get('phase')!='stopped' or previous.trial.identity(result)!=key or previous.trial.identity(proof)!=key or
                        proof.get('status')!='cierre_transporte_confirmado' or proof.get('result_sha256')!=app.digest(result)):
                    raise RuntimeError('Cierre anterior pendiente.')
            sessions=ROOT/'datos'/'sesiones';sessions.mkdir(parents=True,exist_ok=True)
            if sum(1 for _ in sessions.iterdir())>=64: raise OSError('Limite de evidencia; no se borra.')
            folder=sessions/run_id;folder.mkdir(exist_ok=False)
            state={'pid':os.getpid(),'run_id':run_id,'phase':'running','started_utc':closures.now()};pub.save(state_path,state)
            result=None
            try:
                plan=previous.read_plan()
                transport=Transport(previous.trial.DATA,PYTHON32,gate=SDKGate(),guard=diag.maintenance_guard)
                captured=transport.capture_profile(plan,run_id);snapshot=captured['snapshot']
                result={'phase':'stopped','profile_verified':True,'snapshot_id':captured['snapshot_id'],
                        'card':plan['card'],'plan_sha256':app.digest(plan),'captured_utc':snapshot['created_utc'],
                        'c3_fields':{key:snapshot['user'][key] for key in sorted(core.FIELDS)},
                        'permission_count':len(snapshot['permissions']),'error_type':None}
            except (Exception,KeyboardInterrupt) as exc:
                result={'phase':'stopped','profile_verified':False,'error_type':type(exc).__name__}
            try:
                proof=profile_proofs(previous.trial.DATA,run_id)
                previous.quiet([row['pid'] for row in proof])
                result['worker_receipts']=proof
            except Exception as exc: result.update(phase='fault',closure_error_type=type(exc).__name__)
            result|=previous.trial.identity(state)|{'ended_utc':closures.now(),'dates_applied':False,'stop_requested':stop.is_set()}
            core.durable(folder/'resultado.json',core.encoded(result));pub.save(state_path,state|{'phase':result['phase']})
            print(json.dumps(result,indent=2));print('Evidencia: '+str(folder))
            print('FIN lectura. El lanzador verificara cierre despues de salir Python.')
            return 0 if result['phase']=='stopped' and result['profile_verified'] else 1
    finally: signal.signal(signal.SIGINT,old)


def verify_actual(run_id):
    import respaldo_real_mdb as previous
    preflight();pub=previous.pub();state=pub.read(ROOT/'estado_transporte.json');identity=previous.trial.identity(state)
    if identity['run_id']!=run_id: raise ValueError('Cierre de otro lanzamiento.')
    folder=ROOT/'datos'/'sesiones'/run_id;result=pub.read(folder/'resultado.json')
    if (state.get('phase')!='stopped' or result.get('phase')!='stopped' or previous.trial.identity(result)!=identity or
            result.get('dates_applied') is not False): raise RuntimeError('Lectura no cerrada.')
    diag=closures.diagnostic_module()
    with pub.own_lock(ROOT/'transporte.lock'),diag.maintenance_lock():
        receipts=profile_proofs(previous.trial.DATA,run_id)
        if receipts!=result['worker_receipts']: raise ValueError('Recibos cambiaron.')
        if result.get('profile_verified') is True:
            if len(receipts)!=1: raise ValueError('Un recibo de perfil requerido.')
            snapshot=protected.Store(previous.trial.DATA/'perfiles').open(result['snapshot_id'],plan_sha256=result['plan_sha256'])
            if ({key:snapshot['user'][key] for key in sorted(core.FIELDS)}!=result['c3_fields'] or
                    len(snapshot['permissions'])!=result['permission_count']): raise ValueError('Perfil/resultado distintos.')
        previous.quiet([identity['pid'],*[row['pid'] for row in receipts]])
        if pub.read(ROOT/'estado_transporte.json')!=state: raise RuntimeError('Cambio de ejecucion.')
        proof={'status':'cierre_transporte_confirmado',**identity,'profile_verified':result['profile_verified'],
               'result_sha256':app.digest(result),'checked_utc':closures.now(),'dates_applied':False}
        pub.save(folder/'cierre_final.json',proof)
    print(json.dumps(proof,indent=2));print('Terminar y reanudar en el gestor; comprobar dos ciclos nuevos.')
    return 0


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--worker',type=Path);mode.add_argument('--preflight',action='store_true')
    mode.add_argument('--capturar-readonly',action='store_true');mode.add_argument('--verificar-cierre',action='store_true')
    parser.add_argument('--sha256');parser.add_argument('--run-id')
    args=parser.parse_args()
    try:
        for key in list(os.environ):
            if key.upper().startswith('SANISIDRO_'): os.environ.pop(key,None)
        verify_package()
        if args.preflight: print(json.dumps(preflight(),indent=2));return 0
        if args.capturar_readonly: return capture_actual(args.run_id)
        if args.verificar_cierre: return verify_actual(args.run_id)
        if os.name!='nt' or struct.calcsize('P')!=4 or not args.sha256: raise RuntimeError('Usar trabajador Python32.')
        return worker(args.worker,args.sha256)
    except (Exception,KeyboardInterrupt) as exc:
        if not args.worker: print(json.dumps({'status':'transporte_no_confirmado','error_type':type(exc).__name__}))
        return 1


if __name__=='__main__': raise SystemExit(main())
