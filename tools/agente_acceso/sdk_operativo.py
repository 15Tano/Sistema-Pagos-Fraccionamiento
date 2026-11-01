"""Bindings operativos x86, con propietario nativo y originales comprimidos.

La CLI exige configuracion/aceptacion instaladas en ZKSync. Este modulo no emite
aprobaciones de fechas, instala tareas ni cambia bibliotecas. Tests usan SDK falso.
"""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import struct
import sys
import types

import adaptadores_cierre as closures
import captura_rt
import config_operativa as config
import respaldo_ciclo as checkpoint
import sesion_operativa as session
from almacen_operativo import Originals
from emisor_servicio import save


def diagnostic(folder,digest,root=session.SYNC):
    def guard(): return session.checked_worker(folder,digest,root=root)
    guard()
    original=closures.diagnostic_module()
    return types.SimpleNamespace(CONNECTION=original.CONNECTION,SERIAL=original.SERIAL,
        load_sdk=original.load_sdk,pc_timezone=original.pc_timezone,maintenance_guard=guard)


def rt_worker(folder,digest,settings,*,root=session.SYNC,diag=None,summarize_status=False):
    folder=Path(folder);request=closures.request_at(folder/'request.json')
    if request['role']!='rt' or hashlib.sha256((folder/'request.json').read_bytes()).hexdigest()!=digest:
        raise ValueError('Turno RT ajeno.')
    diag=diag or diagnostic(folder,digest,root)
    sdk=directory=handle=store=None;clean=True;error=None;sdk_hash=None;started=closures.now()
    try:
        diag.maintenance_guard();sdk,directory,info=diag.load_sdk();sdk_hash=info['sha256']
        if sdk_hash!=closures.SDK_HASH: raise closures.ControllerIdentityError('Biblioteca no confirmada.')
        store=Originals(Path(root)/'acceso-datos'/'originals.sqlite')
        if store.identity!={'agent_id':settings.agent_id,'serial':settings.serial}:
            raise ValueError('Originales de otro agente.')
        for line in sys.stdin:
            command=json.loads(line)
            if set(command)!={'command'}: raise ValueError('Comando RT ajeno.')
            if command['command']=='close': break
            try:
                diag.maintenance_guard()
                if command['command']=='connect' and handle is None:
                    handle=sdk.Connect(diag.CONNECTION)
                    if not handle: raise RuntimeError('Conexion rechazada.')
                    buffer=ctypes.create_string_buffer(4096)
                    code=sdk.GetDeviceParam(handle,buffer,len(buffer),b'~SerialNumber')
                    if code<0 or b'\0' not in buffer.raw or buffer.value!=('~SerialNumber='+settings.serial).encode('ascii'):
                        raise closures.ControllerIdentityError('Serial no confirmado.')
                    result={'serial':settings.serial}
                elif command['command']=='read' and handle:
                    store.capacity();buffer=ctypes.create_string_buffer(65536)
                    start=closures.now();local=__import__('datetime').datetime.now().astimezone().isoformat()
                    code=sdk.GetRTLog(handle,buffer,len(buffer));end=closures.now()
                    try: timezone=diag.pc_timezone()
                    except OSError: timezone=None
                    summary=None
                    if summarize_status:
                        from ingesta_resumida import store_status
                        summary=store_status(store,buffer.raw,code,start,end,local,timezone)
                    if summary is not None:
                        result={'status_summary':summary}
                    else:
                        key=store.put(buffer.raw,code,start,end,local,timezone)
                        result={'response_id':key}
                else: raise ValueError('Comando RT no permitido.')
                print(json.dumps({'ok':True,'result':result}),flush=True)
            except BaseException as exc:
                error=type(exc).__name__
                print(json.dumps({'ok':False,'error_type':error}),flush=True)
                break
    except BaseException as exc: error=type(exc).__name__
    finally:
        if handle:
            try: sdk.Disconnect(handle)
            except BaseException: clean=False
        if directory is not None:
            try: directory.close()
            except BaseException: clean=False
        if store is not None:
            try: store.close()
            except BaseException: clean=False
        if error=='ControllerIdentityError':
            save(Path(root)/'acceso-datos'/'revision_vigencias.json',{'reason':'rt_identity_unconfirmed','worker_id':folder.name})
        closures.write_closure(folder,request,started=started,closed=clean,operation_ok=error is None,
            sdk_sha256=sdk_hash,error_type=error)
    return 0 if clean else 1


class Transport(checkpoint.CycleTransport):
    def __init__(self,owner,python32,gate,*,command_factory=None):
        self.owner=owner
        def command(folder,digest):
            owner.grant(folder,digest)
            return (command_factory(folder,digest) if command_factory else
                [str(python32),'-B',str(Path(__file__).resolve()),'--worker',str(folder),'--sha256',digest])
        super().__init__(owner.data,python32,gate=gate,guard=owner.guard,command_factory=command,timeout=60)


class RTClient(captura_rt.RTClient):
    def __init__(self,data,python32,*,worker_command):
        self.originals=Originals(Path(data)/'originals.sqlite')
        try: super().__init__(Path(data)/'originales',python32,worker_command=worker_command)
        except BaseException: self.originals.close();raise

    def read(self):
        result=self._call('read')
        if 'status_summary' in result:
            from ingesta_resumida import status_receipt
            return status_receipt(self.originals,result['status_summary'])
        return self.originals.receipt(result['response_id'])

    def close(self):
        try: super().close()
        finally: self.originals.close()


class RT(closures.SafeRTClient):
    def __init__(self,owner,python32,gate,*,command_factory=None):
        self.owner=owner;self.worker_command=command_factory
        super().__init__(gate,owner.data/'cierres',python32,owner.run_id)

    def connect(self):
        self.owner.guard();self.gate.acquire('rt');self.acquired=True
        try:
            self.folder=closures.new_session(self.base,self.run_id,'rt')
            digest=hashlib.sha256((self.folder/'request.json').read_bytes()).hexdigest()
            self.owner.grant(self.folder,digest)
            command=(self.worker_command(self.folder,digest) if self.worker_command else
                [str(self.python32),'-B',str(Path(__file__).resolve()),'--worker',str(self.folder),'--sha256',digest])
            self.client=RTClient(self.owner.data,self.python32,worker_command=command)
            self.client.connect()
        except BaseException:
            self.close();raise


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker',type=Path,required=True);parser.add_argument('--sha256',required=True)
    args=parser.parse_args()
    try:
        if struct.calcsize('P')!=4: raise RuntimeError('SDK requiere Python x86.')
        from preparar_operacion import verify_package
        verify_package()
        settings=config.load(session.SYNC);config.activation(session.SYNC,settings)
        diag=diagnostic(args.worker,args.sha256)
        request=closures.request_at(args.worker/'request.json')
        if request['role']=='rt': return rt_worker(args.worker,args.sha256,settings,diag=diag)
        return checkpoint.worker(args.worker,args.sha256,diag)
    except BaseException: return 1


if __name__=='__main__': raise SystemExit(main())
