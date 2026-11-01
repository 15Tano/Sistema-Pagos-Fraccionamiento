"""Entrada continua preparada para ZKSync; activacion completa obligatoria.

No instala ni activa nada. La instalacion preparada arranca r2 por defecto.
El unico calculo de vigencias sigue siendo /api/vencimientos.
"""
import argparse
import contextlib
import datetime as dt
import hashlib
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import signal
import shutil
import struct
import threading
import time
import urllib.request

import aplicacion_vigencias as app
import config_operativa as config
import instalacion_operativa as install
import operacion_nativa as native
import respaldo_ciclo
import sesion_operativa as ownership
from almacen_operativo import Originals,HotOutbox,Archives,directory_usage
from archivo_cierres import LedgerArchive
from ciclo_operativo import Cycle,access_inventory
from emisor_operativo import Process
from emisor_servicio import save,read,utc
from referencia_vigencias import load_reference
from sdk_operativo import Transport,RT
from servicio_integrado import Service
from trabajador_controlado import SDKGate

PYTHON32=Path(r'C:\Users\Dell\Python32\python.exe')
SOURCE=Path(r'C:\Program Files (x86)\ZKTeco\ZKAccess3.5\Database_PRO.mdb')


def review(root,run_id,reason):
    record={'protocol':1,'purpose':'integrated_operation_review','run_id':run_id,
            'reason':reason,'checked_utc':utc()}
    path=Path(root).parent/'GestionTags'/'revision_pendiente.json'
    if not path.exists():
        try: install.durable(path,json.dumps(record,indent=2).encode())
        except FileExistsError: pass  # No sustituir una revision creada por otro componente.
    save(Path(root)/'acceso-datos'/'revision_vigencias.json',record)


def quarantine(owner,service,*,sleep=time.sleep):
    """No liberar sync.lock ante SDK incierto ni dar paso a consultas del gestor."""
    try: review(owner.root,owner.run_id,'sdk_closure_unconfirmed')
    except Exception: logging.error('No se pudo guardar la marca; se conserva igualmente sync.lock.')
    logging.error('CIERRE SDK SIN CONFIRMAR: se conserva exclusion; requiere revision manual.')
    while True:
        service.official.update(phase='cycle',heartbeat_utc=utc(),last_error_type='UnsafeSDKClosure')
        service.official['consecutive_errors']=max(1,service.official['consecutive_errors'])
        try: save(owner.root/'registros'/'estado.json',service.official)
        except Exception: logging.error('Estado no guardado durante cuarentena SDK.')
        sleep(1)  # No SDK, reinicio, force o reanudacion automatica.


class OperationalCycle(Cycle):
    def __init__(self,*args,progress=lambda:None,**kwargs):
        self.progress=progress
        super().__init__(*args,**kwargs)
    def checked(self):
        super().checked();self.progress()


class OperationalService(Service):
    def run_cycle(self):
        before=self.state['cycle']['completed']
        result=super().run_cycle()
        if self.state['cycle']['completed']>before:
            summary=self.state['cycle']['last_result']
            logging.info('API=%s; cambios Access=%s; cambios C3=%s; no encontrados=%s; ausentes API sin cambios=%s',
                summary['api_rows'],summary['access_changes'],summary['c3_changes'],summary['not_found'],summary['absent_api_unchanged'])
            logging.info('CICLO TERMINADO: correcto')
        elif result: logging.error('CICLO TERMINADO: error')
        return result


class UnavailableOutbox:
    """No inventar contadores cuando fallo el almacen; las fechas son independientes."""
    def health(self): raise OSError('Almacen de eventos no disponible.')
    def ensure_capture_capacity(self): raise OSError('Captura pausada.')
    def enqueue_state(self,*args,**kwargs): raise OSError('Estado sin almacen durable.')
    def build_batch(self): raise OSError('Lotes sin almacen durable.')
    def close(self): pass


def capacity_snapshot(data):
    data=Path(data);warnings=[];usage={}
    for name,limit in (('originals.sqlite',2*1024**3),('outbox.sqlite',256*1024**2)):
        value=sum(p.stat().st_size for p in (data/name,Path(str(data/name)+'-wal'),Path(str(data/name)+'-shm')) if p.exists())
        usage[name]=value
        if value>=limit*.8: warnings.append(name+'_80pct')
    for name,limit in (('ack_archivados',4*1024**3),('cierres_archivados',2*1024**3)):
        path=data/name;value=directory_usage(path) if path.exists() else 0
        usage[name]=value
        if value>=limit*.8: warnings.append(name+'_80pct')
    for name,limit in (('perfiles',1024),('mdb_respaldos',32)):
        path=data/name;value=sum(1 for p in path.iterdir() if p.is_dir()) if path.exists() else 0
        usage[name]=value
        if value>=limit*.8: warnings.append(name+'_80pct')
    free=shutil.disk_usage(data).free
    if free<512*1024**2: warnings.append('disk_reserve_low')
    return {'checked_utc':utc(),'usage':usage,'free_bytes':free,'warnings':warnings}


def run(root,settings,*,inspect=native.inventory):
    root=ownership.protected.checked_path(root)
    if root.resolve()!=ownership.SYNC.resolve() or os.name!='nt' or struct.calcsize('P')!=8:
        raise PermissionError('Operacion solo desde raiz canonica instalada y Python64.')
    password=os.environ.get('SANISIDRO_ACCESS_PASSWORD')
    if not password: raise PermissionError('Usar lanzador DPAPI instalado.')
    config.activation(root,settings)
    def startup():
        native.task_contract(inspect(root),maintenance=False)
        if (root.parent/'GestionTags'/'revision_pendiente.json').exists() or (root/'revision_instalacion.json').exists():
            raise PermissionError('Revision operativa pendiente.')
        if install.sha(root/install.ENTRY)!=hashlib.sha256(install.WRAPPER).hexdigest() or install.sha(root/'vigilar_sync.py')!=hashlib.sha256(install.MONITOR).hexdigest():
            raise PermissionError('Entradas de operacion distintas.')
        for name,digest in install.ROOT_FILES.items():
            if name not in (install.ENTRY,'vigilar_sync.py') and install.sha(root/name)!=digest:
                raise PermissionError('Dependencia instalada diferente.')
    data=root/'acceso-datos';data.mkdir(exist_ok=True)
    gate=SDKGate();ledger=LedgerArchive(data)
    event=threading.Event();old=signal.signal(signal.SIGINT,lambda *_:event.set())
    service=box=originals=None
    try:
        with ownership.Owner(root,startup_guard=startup,recover_closed=ledger.recover) as owner:
            birth=(int(owner.record['native']['birth_ticks'])-116444736000000000)/10000000
            def stopped(): return event.is_set() or native.stop_requested(root,os.getpid(),birth,owner.run_id)
            storage_error=None
            try:
                box=HotOutbox(data/'outbox.sqlite',settings.agent_id,settings.serial)
                originals=Originals(data/'originals.sqlite',settings.agent_id,settings.serial)
                archives=Archives(data/'ack_archivados',originals);originals.recover(box,archives)
            except Exception as exc:
                storage_error=type(exc).__name__
                if box is not None: box.close()
                if originals is not None: originals.close()
                box=UnavailableOutbox();originals=None
            transport=Transport(owner,PYTHON32,gate)
            reference=load_reference();holder={};next_report=[0.]
            def progress():
                current=holder.get('service')
                if current is not None:
                    current.official['heartbeat_utc']=utc();save(root/'registros'/'estado.json',current.official)
                    try: current.state['queue']=box.health()
                    except Exception as exc:
                        current.paused=True;current.state['storage_error']=type(exc).__name__
                    current.state.update(phase='cycle',heartbeat_utc=utc())
                    publish(dict(current.state))
                    if time.monotonic()>=next_report[0]:
                        try: current.queue_state()
                        except Exception as exc:
                            current.paused=True;current.state['storage_error']=type(exc).__name__
                        next_report[0]=time.monotonic()+30
            def guard(): owner.guard();progress()
            def api():
                with urllib.request.urlopen(reference.api_request(),timeout=15) as response: raw=response.read(4*1024*1024+1)
                if len(raw)>4*1024*1024: raise ValueError('API excedida.')
                return json.loads(raw)
            @contextlib.contextmanager
            def access():
                import pyodbc
                # Mismo driver/credencial ya validados; nunca probar variantes de clave.
                if any(char in password for char in ';\r\n\0') or password!=password.strip(): raise PermissionError('Credencial incompatible.')
                connection=pyodbc.connect('Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq='+str(SOURCE)+';PWD='+password+';',autocommit=False,timeout=15)
                try: yield app.AccessDates(connection)
                finally:
                    try: connection.rollback()
                    finally: connection.close()
            def prepare(plans,run_id):
                def between():
                    if stopped():
                        from ciclo_operativo import CycleInterrupted
                        raise CycleInterrupted('Parada antes de emitir alcances.')
                    guard()
                return respaldo_ciclo.prepare(plans,SOURCE,data/'mdb_respaldos',password,transport,run_id,
                    data/'bundles',guard=between)
            def authorize(plan):
                config.activation(root,settings)
                ledger.archive(gate,data/'transacciones',guard=owner.guard)
                return app.Approval(plan,confirmed=True,approved_sha256=app.digest(plan))
            cycle=OperationalCycle(api,lambda:access_inventory(SOURCE,password),transport,guard=guard,stop=stopped,
                access_factory=access,prepare=prepare,authorize=authorize,evidence=data/'transacciones',progress=progress)
            def wrapped_cycle():
                try: return cycle()
                finally:
                    if not gate.fault and gate.active is None:
                        ledger.archive(gate,data/'transacciones',guard=owner.guard)
            wrapped_cycle.applying=True
            last_capacity=[0.,None]
            def publish(state):
                if time.monotonic()-last_capacity[0]>=30 or last_capacity[1] is None:
                    try: last_capacity[1]=capacity_snapshot(data)
                    except Exception: last_capacity[1]={'warnings':['capacity_unavailable'],'checked_utc':utc()}
                    last_capacity[0]=time.monotonic()
                state['capacity']=last_capacity[1]
                save(root/'registros'/'operacion.json',state)
            service=OperationalService(wrapped_cycle,box,lambda:RT(owner,PYTHON32,gate),Process(owner.folder/'emisor',root),
                gate,applying=True,guard=owner.guard,stop=stopped,publish=publish,
                publish_official=lambda state:save(root/'registros'/'estado.json',state),
                before_rt=originals.capacity if originals is not None else box.ensure_capture_capacity)
            holder['service']=service;service.state['run_id']=owner.run_id
            if storage_error:
                service.paused=True;service.state['storage_error']=storage_error
            service.emit()
            # El gestor reanuda la tarea antes de retirar active=true. Esperar sin tocar SDK.
            until=time.monotonic()+25
            while read(root.parent/'GestionTags'/'mantenimiento.json').get('active') is True:
                if stopped() or time.monotonic()>until: raise PermissionError('Reanudacion del gestor no completada.')
                service.emit();time.sleep(.25)
            try:
                result=service.run()
                if result['phase']=='stopped': logging.info('PARADA ORDENADA: SDK y emisor cerrados.')
                return 0 if result['phase']=='stopped' else 1
            except BaseException:
                if gate.fault or gate.active is not None: quarantine(owner,service)
                if service.state['stop_reason']=='ReviewRequired': review(root,owner.run_id,'partial_dates_review')
                raise
    finally:
        if box is not None: box.close()
        if originals is not None: originals.close()
        ledger.close();signal.signal(signal.SIGINT,old)


def main(root=ownership.SYNC):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--aplicar',action='store_true',required=True)
    parser.add_argument('--continuo',action='store_true',required=True)
    parser.parse_args()
    try:
        from preparar_operacion import verify_package
        manifest=verify_package();settings=config.load(root)
        if hashlib.sha256((Path(__file__).parent/'OPERATIVA_SHA256SUMS.json').read_bytes()).hexdigest()!=settings.release_sha256:
            raise PermissionError('Release no aprobado para esta configuracion.')
        folder=Path(root)/'registros';folder.mkdir(exist_ok=True)
        logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s',handlers=[
            RotatingFileHandler(folder/'sync.log',maxBytes=2000000,backupCount=5,encoding='utf-8')])
        return run(root,settings)
    except BaseException as exc:
        logging.error('OPERACION NO INICIADA/INTERRUMPIDA: %s',type(exc).__name__)
        return 1


if __name__=='__main__': raise SystemExit(main())
