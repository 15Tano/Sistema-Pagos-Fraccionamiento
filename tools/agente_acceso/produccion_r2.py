"""Ciclo r2 original con trabajadores serializados y recibos de Disconnect.

Se ejecutan los bytes r2 verificados. Solo cambia el transporte del subprocess,
con guardia de propietario/serial y evidencia; no reglas, campos ni fechas.
"""
import ctypes
import hashlib
import json
import logging
from pathlib import Path
import sys
import types
import uuid

import adaptadores_cierre as closed
import referencia_vigencias as reference
import sesion_operativa as ownership
from trabajador_controlado import run_closed_worker,UnsafeSDKClosure


class LegacyCycle:
    applying=True

    def __init__(self,password,root,worker,*,module=None,guard=lambda:None):
        self.password,self.worker,self.guard=password,worker,guard
        self.module=module or reference.load_reference()
        self.module.ROOT=Path(root)
        self.module.worker=self.call_worker
        self.summary=None
        self.verified=0
        self.module.logging=types.SimpleNamespace(info=self.info,error=logging.error)

    def info(self,message,*args):
        if message.startswith('API=%s; cambios Access=') and len(args)==5:
            self.summary=dict(zip(('api_rows','access_changes','c3_changes','not_found','absent_api_unchanged'),args))
        elif message=='APLICADO Y VERIFICADO: %s': self.verified+=1
        logging.info(message,*args)

    def call_worker(self,payload):
        self.guard()
        return self.worker(payload)

    def __call__(self):
        self.guard();self.summary=None;self.verified=0
        self.module.cycle(self.password,True,None)
        if self.summary is None: raise RuntimeError('Ciclo r2 sin resumen verificable.')
        return dict(self.summary,mode='apply',verified=self.verified,status='verified',dates_engine='r2_reference_unchanged')


class Bridge:
    def __init__(self,owner,python32,gate,*,command=None):
        self.owner,self.python32,self.gate,self.command=owner,str(python32),gate,command

    def __call__(self,payload):
        self.owner.guard()
        check_ledger(self.owner.data/'cierres')
        if payload.get('mode') not in ('read','apply'): raise ValueError('Modo r2 ajeno.')
        folder=closed.new_session(self.owner.data/'cierres',self.owner.run_id,'vigencias')
        raw=json.dumps(payload,ensure_ascii=True,separators=(',',':')).encode('ascii')
        if len(raw)>1024*1024: raise ValueError('Alcance r2 excedido.')
        reference.load_reference()  # Verifica las cuatro fuentes antes de cada turno.
        with (folder/'r2_operation.json').open('xb') as stream:
            stream.write(raw);stream.flush();__import__('os').fsync(stream.fileno())
        digest=hashlib.sha256(raw).hexdigest()
        self.owner.grant(folder,digest)
        command=self.command(folder,digest) if self.command else [self.python32,'-B',str(Path(__file__).with_name('produccion_worker.py')),'--worker',str(folder),'--sha256',digest]
        try:
            child=run_closed_worker(self.gate,'vigencias',command,
                verify_closed=lambda p:bool(closed.verified_closure(folder,p.pid)),timeout=300)
            closed.acknowledge(folder,child.pid)
        except BaseException:
            closed.fatal(self.gate,self.owner.data/'cierres',self.owner.run_id,'r2_worker_close_unconfirmed')
        receipt=closed.verified_closure(folder,child.pid)
        if not receipt['operation_ok']:
            if receipt['error_type'] in ('ControllerIdentityError','OwnershipError','PermissionError'):
                closed.fatal(self.gate,self.owner.data/'cierres',self.owner.run_id,'r2_identity_unconfirmed')
            raise RuntimeError('Ciclo r2 interrumpido; SDK cerrado, evidencia conservada.')
        return closed.bounded_json(folder/'response.json',closed.MAX_RESPONSE)


def execute_worker(folder,digest,*,guard,panel_factory=None,sources=None):
    """Tests inyectan Panel falso; nunca se acepta desde la CLI instalada."""
    folder=Path(folder);guard()
    request=closed.request_at(folder/'request.json')
    raw=(folder/'r2_operation.json').read_bytes()
    if request['role']!='vigencias' or hashlib.sha256(raw).hexdigest()!=digest: raise ValueError('Operacion r2 distinta.')
    payload=json.loads(raw)
    if payload.get('mode') not in ('read','apply'): raise ValueError('Operacion r2 no permitida.')
    sources=sources or reference._verified_sources()
    panel_module=reference.load_module('_panel_r2_produccion',reference.ROOT/'c3_panel.py',sources['c3_panel.py'])
    original=panel_factory or panel_module.Panel
    state={'closed':True,'sdk_hash':None}

    class Panel(original):
        def __enter__(self):
            guard()
            if panel_factory is None:
                dll=Path(panel_module.SDK_DIR)/'plcommpro.dll'
                state['sdk_hash']=hashlib.sha256(dll.read_bytes()).hexdigest()
                if state['sdk_hash']!=closed.SDK_HASH: raise closed.ControllerIdentityError('SDK distinto.')
            else: state['sdk_hash']=closed.SDK_HASH
            state['closed']=False
            try:
                super().__enter__()
                if panel_factory is None:
                    self.sdk.GetDeviceParam.argtypes=[ctypes.c_void_p,ctypes.POINTER(ctypes.c_char),ctypes.c_int,ctypes.c_char_p]
                    self.sdk.GetDeviceParam.restype=ctypes.c_int
                    buffer=ctypes.create_string_buffer(4096)
                    code=self.sdk.GetDeviceParam(self.handle,buffer,len(buffer),b'~SerialNumber')
                    if code<0 or buffer.value!=b'~SerialNumber=CO2K225060027': raise closed.ControllerIdentityError('Serial distinto.')
                guard()
                return self
            except BaseException:
                self.__exit__(*sys.exc_info())
                raise

        def __exit__(self,*args):
            try:
                if getattr(self,'handle',None):
                    self.sdk.Disconnect(self.handle);self.handle=None
                if getattr(self,'directory',None) is not None: self.directory.close()
                if panel_factory is not None: super().__exit__(*args)
                state['closed']=True
            except BaseException:
                state['closed']=False
                raise

        def read(self,*args): guard();return super().read(*args)
        def write(self,*args): guard();return super().write(*args)

    panel_module.Panel=Panel
    previous=sys.modules.get('c3_panel');argv=sys.argv
    started=closed.now();ok=False;error=None;response=None
    try:
        sys.modules['c3_panel']=panel_module
        worker=reference.load_module('_worker_r2_produccion',reference.ROOT/'c3_worker.py',sources['c3_worker.py'])
        sys.argv=['c3_worker.py',str(folder/'r2_operation.json'),str(folder/'response.json')]
        worker.main()
        response=(folder/'response.json').read_bytes()
        if len(response)>closed.MAX_RESPONSE: raise ValueError('Respuesta r2 excedida.')
        ok=True
    except BaseException as exc: error=type(exc).__name__
    finally:
        sys.argv=argv
        if previous is None: sys.modules.pop('c3_panel',None)
        else: sys.modules['c3_panel']=previous
        closed.write_closure(folder,request,started=started,closed=state['closed'],operation_ok=ok,
            sdk_sha256=state['sdk_hash'],error_type=error,response=response if ok else None)
    return 0 if state['closed'] else 1


def check_ledger(base,*,crypt=None):
    closed.check_ledger(base)
    for path in Path(base).glob('*/r2_operation.json'):
        payload=closed.bounded_json(path,1024*1024)
        if payload.get('mode') not in ('read','apply'): raise UnsafeSDKClosure('Operacion r2 previa ajena.')
        grant_path=path.parent/'owner_grant.dpapi'
        if grant_path.stat().st_size>16384: raise UnsafeSDKClosure('Permiso r2 excedido.')
        grant=json.loads((crypt or ownership.protected.dpapi)(grant_path.read_bytes(),decrypt=True))
        request=closed.request_at(path.parent/'request.json')
        if (grant.get('operation_sha256')!=hashlib.sha256(path.read_bytes()).hexdigest() or
                grant.get('worker_id')!=request['worker_id'] or grant.get('worker_run_id')!=request['run_id']):
            raise UnsafeSDKClosure('Alcance r2 previo modificado.')
        ack=closed.bounded_json(path.parent/'parent_ack.json')
        receipt=closed.verified_closure(path.parent,ack['pid'])
        if receipt['error_type'] in ('ControllerIdentityError','OwnershipError','PermissionError'):
            raise UnsafeSDKClosure('Identidad previa sin confirmar.')
