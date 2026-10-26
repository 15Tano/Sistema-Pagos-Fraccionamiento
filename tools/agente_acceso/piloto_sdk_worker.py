"""SDK32 del piloto: padre nativo vivo, lock, permiso DPAPI y mantenimiento."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import types

import adaptadores_cierre as closures
import respaldo_ciclo as checkpoint
import respaldo_protegido as protected
import sesion_operativa as session
from emisor_servicio import read
from paquete_piloto import ROOT,verify_package


def guard_child(folder,digest,*,root=ROOT,identity=session.native_identity,maintenance=None):
    folder=protected.checked_path(folder);request,operation=checkpoint.transport.read_operation(folder,digest)
    if request['role']!='vigencias':raise PermissionError('Piloto sin RT.')
    launch=folder.parents[2]
    if launch.parent.resolve()!=(Path(root)/'datos'/'sesiones').resolve() or launch.name!=str(__import__('uuid').UUID(launch.name)):
        raise PermissionError('Trabajador fuera de sesion piloto.')
    if any((folder/name).exists() for name in ('closed.json','parent_ack.json','write_attempt.json')):
        raise PermissionError('Trabajador ya utilizado.')
    path=folder/'pilot_grant.dpapi';parent_path=launch/'parent.dpapi'
    if path.stat().st_size>16384 or parent_path.stat().st_size>16384:raise ValueError('Permiso excedido.')
    grant=json.loads(protected.dpapi(path.read_bytes(),decrypt=True))
    if type(grant.get('protocol')) is not int or grant!={'protocol':1,'purpose':'pilot_child','run_id':launch.name,'worker_id':request['worker_id'],
               'worker_run_id':request['run_id'],'operation_sha256':digest,
               'parent_sha256':hashlib.sha256(parent_path.read_bytes()).hexdigest()}:
        raise PermissionError('Permiso de otro padre/operacion.')
    parent=json.loads(protected.dpapi(parent_path.read_bytes(),decrypt=True))
    if (set(parent)!={'protocol','purpose','run_id','root','native','review_marker'} or type(parent['protocol']) is not int or
            parent['protocol']!=1 or parent['purpose']!='pilot_parent' or parent['run_id']!=launch.name or
            parent['root']!=str(Path(root).resolve()) or identity(parent['native']['pid'])!=parent['native']):
        raise PermissionError('Padre terminado, sustituido o ajeno.')
    pointer=read(Path(root)/'estado_piloto.json')
    if pointer!={'pid':parent['native']['pid'],'run_id':launch.name,'phase':'running'}:
        raise PermissionError('Sesion piloto ya no activa.')
    from piloto_vigencias_dell import SYNC,maintenance as native_maintenance
    session.require_locked(SYNC/'sync.lock')
    (maintenance or native_maintenance)(parent['review_marker'])
    return parent


def diagnostic(folder,digest):
    def guard():return guard_child(folder,digest)
    guard();original=closures.diagnostic_module()
    return types.SimpleNamespace(CONNECTION=original.CONNECTION,SERIAL=original.SERIAL,
        load_sdk=original.load_sdk,maintenance_guard=guard)


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--worker',type=Path,required=True)
    parser.add_argument('--sha256',required=True);args=parser.parse_args()
    try:
        verify_package()
        if struct.calcsize('P')!=4:raise PermissionError('SDK requiere Python32 instalado.')
        return checkpoint.worker(args.worker,args.sha256,diagnostic(args.worker,args.sha256))
    except BaseException:return 1


if __name__=='__main__':raise SystemExit(main())
