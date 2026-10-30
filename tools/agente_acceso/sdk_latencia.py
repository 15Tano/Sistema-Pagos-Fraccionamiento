"""Entrada x86 del ensayo: inventario/RT solamente, con propietario nativo.

No enlaza operaciones de fechas, perfiles, altas, permisos ni apertura remota.
"""
import argparse
import hashlib
from pathlib import Path
import struct
import types

import adaptadores_cierre as closures
from emisor_latencia import OWNER,SERIAL,AGENT
from emisor_servicio import read
import sesion_operativa as session
import sdk_operativo as sdk
from transporte_aplicador import read_operation
from puente_sdk_readonly import ReadOnlyPanel,run_readonly


def maintenance_files(sync,marker):
    sync=Path(sync)
    manager=sync.parent/'GestionTags'
    if (read(manager/'mantenimiento.json').get('active') is not True or
            read(manager/'revision_pendiente.json')!=marker):
        raise PermissionError('Mantenimiento/identidad del ensayo cambiaron.')
    state=read(sync/'registros'/'estado.json')
    if state.get('protocol')!=2 or state.get('phase')!='stopped':
        raise PermissionError('Polling instalado no detenido.')
    session.require_locked(sync/'sync.lock')


def allowed(folder,digest):
    request=closures.request_at(Path(folder)/'request.json')
    if request['role']=='rt':
        if hashlib.sha256((Path(folder)/'request.json').read_bytes()).hexdigest()!=digest:
            raise ValueError('Solicitud RT alterada.')
    else:
        _,operation=read_operation(folder,digest)
        if operation!={'mode':'read'}:
            raise PermissionError('Solo inventario de lectura permitido.')
    return request


def dispatch(folder,digest,*,root=OWNER,sync=session.SYNC,diagnostic=None,guard=None):
    request=allowed(folder,digest)  # Rechazar cualquier escritura antes de cargar DLL.
    if guard is None:
        def guard():
            record=session.checked_worker(folder,digest,root=root)
            marker={'protocol':1,'purpose':'latencia_readonly','pid':record['native']['pid'],
                    'run_id':record['run_id']}
            maintenance_files(sync,marker)
            return record
    guard()
    original=diagnostic or closures.diagnostic_module()
    diag=types.SimpleNamespace(CONNECTION=original.CONNECTION,load_sdk=original.load_sdk,
        pc_timezone=original.pc_timezone,maintenance_guard=guard)
    if request['role']=='rt':
        settings=types.SimpleNamespace(agent_id=AGENT,serial=SERIAL)
        return sdk.rt_worker(folder,digest,settings,root=root,diag=diag)
    return run_readonly(folder,digest,lambda:ReadOnlyPanel(diag))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker',type=Path,required=True)
    parser.add_argument('--sha256',required=True)
    args=parser.parse_args()
    try:
        from paquete_latencia import verify_package
        verify_package()
        if struct.calcsize('P')!=4:
            raise RuntimeError('SDK requiere Python x86 ya instalado.')
        return dispatch(args.worker,args.sha256)
    except BaseException:
        return 1  # No imprimir respuestas, credenciales ni traceback.


if __name__=='__main__':raise SystemExit(main())
