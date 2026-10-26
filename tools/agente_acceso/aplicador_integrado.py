"""Union candidata de respaldos/aplicacion; dependencias explicitas, sin CLI real."""
import copy
import hashlib
import json
from pathlib import Path
import uuid

import aplicacion_vigencias as app
import adaptadores_cierre as closures
import respaldo_mdb as mdb
import respaldo_protegido as protected
import recuperacion_selectiva as recovery
import vigencias_candidato as core
from puente_sdk_fechas import DatesPanel
from trabajador_controlado import ClosedWorker,SDKGate


class Bundle:
    """Rutas de almacenes del padre; no acepta rutas dentro del manifiesto."""
    def __init__(self,path,mdb_root,store):
        if not isinstance(store,protected.Store): raise app.ScopeRejected('Store protegido requerido.')
        self.path=Path(path);self.mdb_root=Path(mdb_root);self.store=store

    def check(self,plan):
        app.validate_plan(plan);protected.checked_path(self.path)
        meta=closures.bounded_json(self.path,8192)
        if (set(meta)!={'protocol','plan_sha256','mdb_backup_id','snapshot_id','mdb_receipt_sha256'} or
                type(meta['protocol']) is not int or meta['protocol']!=1 or meta['plan_sha256']!=app.digest(plan)):
            raise app.ScopeRejected('Respaldo fuera del plan.')
        for key in ('mdb_backup_id','snapshot_id'):
            if str(uuid.UUID(meta[key]))!=meta[key]: raise app.ScopeRejected('Referencia de respaldo invalida.')
        folder=protected.checked_path(self.mdb_root/meta['mdb_backup_id'])
        manifest=protected.checked_path(folder/'manifest.json');path=protected.checked_path(folder/'Database_PRO_antes.mdb')
        receipt=closures.bounded_json(manifest,16384)
        if (app.digest(receipt)!=meta['mdb_receipt_sha256'] or receipt.get('protocol')!=1 or
                receipt.get('backup_id')!=meta['mdb_backup_id'] or receipt.get('status')!='copy_verified' or
                receipt.get('approval_issued') is not False or receipt.get('serial')!=plan['serial'] or receipt.get('card')!=plan['card'] or
                receipt.get('plan_sha256')!=app.digest(plan) or type(receipt.get('mdb_bytes')) is not int or
                not 0<receipt['mdb_bytes']<=mdb.MAX_MDB_BYTES or path.stat().st_size!=receipt['mdb_bytes'] or
                mdb.file_hash(path)!=receipt.get('mdb_sha256') or
                receipt.get('validation',{}).get('access_before_sha256')!=app.digest(plan['access_before'])):
            raise app.ScopeRejected('Copia MDB/recibo no confirmados.')
        snapshot=self.store.open(meta['snapshot_id'],plan_sha256=app.digest(plan))
        if snapshot['plan']!=plan: raise app.ScopeRejected('Snapshot de otro alcance.')
        return meta,snapshot


def prepare_bundle(plan,user,permits,source,mdb_root,password,store,bundle_root,*,guard):
    """Preparar antes de solicitar Approval para no renovar su TTL al respaldar."""
    if not isinstance(store,protected.Store): raise app.ScopeRejected('Store protegido requerido.')
    app.validate_plan(plan);plan=json.loads(core.encoded(plan));guard()
    # Validar perfil antes de copiar una MDB; nunca escribir datos SDK aqui.
    sample={'protocol':1,'snapshot_id':str(uuid.uuid4()),'created_utc':app.utc_now().isoformat(),
            'sdk_sha256':closures.SDK_HASH,'plan':plan,'user':copy.deepcopy(user),
            'permissions':protected.permissions(permits,user.get('Pin'))}
    protected.validate(sample)
    receipt=mdb.create_backup(source,mdb_root,password,plan,guard=guard)
    guard();meta=store.seal(plan,sample['user'],sample['permissions'])
    folder=protected.checked_path(Path(bundle_root)/str(uuid.uuid4()));folder.mkdir(parents=True,exist_ok=False)
    reference={'protocol':1,'plan_sha256':app.digest(plan),'mdb_backup_id':receipt['backup_id'],
               'snapshot_id':meta['snapshot_id'],'mdb_receipt_sha256':app.digest(receipt)}
    core.durable(folder/'bundle.json',core.encoded(reference))
    bundle=Bundle(folder/'bundle.json',mdb_root,store);bundle.check(plan)
    return bundle


class BundledDatesPanel(DatesPanel):
    """Perfil completo cotejado contra DPAPI antes de un Set de cuatro campos."""
    def __init__(self,approval,evidence,bundle,diagnostic=None):
        self.bundle=bundle;self.before_user=None;self.before_permissions=None
        bundle.check(approval.check())  # Antes de abrir DLL/SDK.
        super().__init__(approval,evidence,diagnostic)

    def user(self,card):
        value=super().user(card)
        if not (self.evidence/'write_attempt.json').exists(): self.before_user=copy.deepcopy(value)
        return value

    def permissions(self,pin):
        value=super().permissions(pin)
        if not (self.evidence/'write_attempt.json').exists(): self.before_permissions=copy.deepcopy(value)
        return value

    def write_dates(self,values):
        meta,snapshot=self.bundle.check(self.approval.check())
        if self.before_user!=snapshot['user'] or self.before_permissions!=snapshot['permissions']:
            raise app.ScopeRejected('Perfil/permisos cambiaron desde el respaldo protegido.')
        core.durable(self.evidence/'protected_backup.json',core.encoded(meta))
        super().write_dates(values)


def run_worker(folder,digest,approval,evidence,bundle,diagnostic=None):
    """Para futuro transporte autorizado; no crea aprobaciones ni CLI SDK."""
    plan=approval.check();folder=Path(folder);evidence=Path(evidence)
    bundle.check(plan)
    if any((folder/name).exists() for name in ('write_attempt.json','protected_backup.json','closed.json','parent_ack.json','response.json')):
        raise app.ScopeRejected('Trabajador ya usado; no repetir.')
    operation=folder/'operation.json'
    if operation.stat().st_size>closures.MAX_RESPONSE: raise app.ScopeRejected('Operacion excedida.')
    raw=operation.read_bytes()
    payload={'mode':'apply','changes':[{'card':plan['card'],'before':plan['c3_before'],'end':app.parse_date(plan['api_end']).strftime('%Y%m%d')}]}
    if len(raw)>closures.MAX_RESPONSE or hashlib.sha256(raw).hexdigest()!=digest or json.loads(raw)!=payload or not plan['c3_change']:
        raise app.ScopeRejected('Operacion ajena al plan.')
    backed=closures.bounded_json(evidence/'backup.json');intent=closures.bounded_json(evidence/'intent_c3.json')
    if (closures.bounded_json(evidence/'plan.json')!=plan or backed!={'protocol':1,'plan_sha256':approval.sha256,
            'serial':core.SERIAL,'card':plan['card'],'access_before':plan['access_before'],'c3_before':plan['c3_before']} or
            intent.get('plan_sha256')!=approval.sha256 or intent.get('component')!='c3'):
        raise app.ScopeRejected('Intencion/respaldo no vinculados.')
    return core.worker(folder,digest,lambda:BundledDatesPanel(approval,folder,bundle,diagnostic))


def check_runs(root):
    # No eludir un fallo parcial creando otro UUID de transaccion.
    for folder in Path(root).glob('*/aplicacion'): app.check_evidence(folder)
    for path in Path(root).glob('*/transaction.json'):
        state=closures.bounded_json(path)
        if state.get('status')!='verified': raise core.ReviewRequired('Transaccion anterior requiere revision.')


def accept_child(child,folder,payload,gate,ledger,run_id,seen):
    folder=protected.checked_path(folder)
    if (not isinstance(child,ClosedWorker) or child.returncode!=0 or gate.fault or gate.active is not None or
            folder.parent.resolve()!=Path(ledger).resolve() or folder.name in seen):
        raise core.ReviewRequired('Salida/gate de trabajador no confirmados.')
    request=closures.request_at(folder/'request.json')
    operation=folder/'operation.json'
    if operation.stat().st_size>closures.MAX_RESPONSE: raise core.ReviewRequired('Operacion excedida.')
    raw=operation.read_bytes();digest=hashlib.sha256(raw).hexdigest()
    if request['run_id']!=run_id or json.loads(raw)!=payload: raise core.ReviewRequired('Recibo de otra operacion.')
    closed=closures.verified_closure(folder,child.pid)
    core.check_operations(ledger)  # Incluye ACK durable del padre antes de liberar gate.
    value=core.read_result(folder,digest,payload,closed)
    if value is None: raise core.ReviewRequired('Operacion SDK sin resultado.')
    seen.add(folder.name)
    return value


def execute(approval,fetch_api,access,read_child,apply_child,evidence_root,ledger,bundle,*,gate,guard):
    """Callbacks deben usar run_closed_worker/recibo+ACK y conservar TTL original.

    El padre debe conservar sync.lock. ClosedWorker es evidencia del adaptador
    confiable, no autenticacion/firma ni permiso emitido por este modulo.
    """
    if not isinstance(approval,app.Approval) or not isinstance(gate,SDKGate): raise app.ScopeRejected('Alcance/gate requeridos.')
    if approval.consumed or approval.verified: raise app.ScopeRejected('Aprobacion ya utilizada; preparar un alcance nuevo.')
    plan=approval.check();guard();check_runs(evidence_root);core.check_operations(ledger)
    if (bundle is not None and not isinstance(bundle,Bundle)) or (bundle is None and (plan['access_change'] or plan['c3_change'])):
        raise app.ScopeRejected('Faltan respaldos vinculados.')
    def backed():
        guard();approval.check()
        if gate.fault or gate.active is not None: raise core.ReviewRequired('Turno SDK no disponible.')
        if bundle is not None: bundle.check(plan)
        approval.check()  # Hash de una MDB grande no extiende el TTL.
    backed();run_id=str(uuid.uuid4());root=Path(evidence_root)/run_id;root.mkdir(parents=True,exist_ok=False)
    state={'protocol':1,'run_id':run_id,'plan_sha256':approval.sha256,'status':'running','error_type':None}
    core.durable(root/'transaction.json',core.encoded(state));seen=set()
    def read(card):
        backed();child,folder=read_child(card,run_id)
        value=accept_child(child,folder,{'mode':'read'},gate,ledger,run_id,seen)
        return value.get(card)
    def apply(payload,scope,session):
        backed();child,folder=apply_child(payload,scope,session,bundle,run_id)
        value=accept_child(child,folder,payload,gate,ledger,run_id,seen)
        meta,_=bundle.check(plan)
        if closures.bounded_json(Path(folder)/'protected_backup.json')!=meta:
            raise core.ReviewRequired('Falta respaldo protegido del intento SDK.')
        return value
    class GuardedAccess:
        def read(self,card): return access.read(card)
        def update(self,before,end,scope): backed();return access.update(before,end,scope)
    try:
        result=app.execute(approval,fetch_api,GuardedAccess(),read,apply,root/'aplicacion')
        state['status']='verified';return result|{'integration_run_id':run_id}
    except BaseException as exc:
        state.update(status='requires_review',error_type=type(exc).__name__);raise
    finally:
        # Snapshot atomico; una falla deja running y bloquea otros intentos.
        from captura_rt import atomic_json
        atomic_json(root/'transaction.json',state)


def review_recovery(bundle,plan,fetch_api,access,user,permits,*,gate,guard):
    """Ensayo/revision readonly; no suprime requires_review ni emite Approval."""
    if gate.fault or gate.active is not None: raise core.ReviewRequired('Resolver cierre SDK antes de revisar recuperacion.')
    guard();meta,_=bundle.check(plan)
    result=recovery.review(bundle.store,meta['snapshot_id'],fetch_api(),access,user,permits)
    return result|{'original_evidence_preserved':True,'retry_authorized':False}
