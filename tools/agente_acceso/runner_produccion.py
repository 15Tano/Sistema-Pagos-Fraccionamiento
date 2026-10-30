"""Servicio permanente: vigencias r2 originales, RT y envio HTTPS serializados."""
import argparse
import hashlib
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import signal
import struct
import threading
import time

from almacen_operativo import Originals,HotOutbox,Archives
from archivo_cierres import LedgerArchive
from emisor_servicio import read,save,utc
from produccion_instalador import installation
import operacion_nativa as native
import produccion_config as config
from produccion_emisor import Process
from produccion_r2 import LegacyCycle,Bridge,check_ledger
import sdk_operativo
import sesion_operativa as ownership
from servicio_latencia import LatencyService
from trabajador_controlado import SDKGate
from runner_operativo import UnavailableOutbox,capacity_snapshot,quarantine

PYTHON32=Path(r'C:\Users\Dell\Python32\python.exe')
install=installation()


class ProductionService(LatencyService):
    version='produccion-r2-2026.10.30-1'

    def run_cycle(self):
        before=self.state['cycle']['completed']
        result=super().run_cycle()
        if self.state['cycle']['completed']>before: logging.info('CICLO TERMINADO: correcto')
        elif result: logging.error('CICLO TERMINADO: error')
        return result


def run(root,settings):
    root=ownership.protected.checked_path(root)
    if root.resolve()!=ownership.SYNC.resolve() or os.name!='nt' or struct.calcsize('P')!=8:
        raise PermissionError('Usar entrada canonica y Python64 instalados.')
    password=os.environ.get('SANISIDRO_ACCESS_PASSWORD')
    if not password: raise PermissionError('Usar lanzador DPAPI instalado.')
    config.activation(root,settings)
    def startup():
        native.task_contract(native.inventory(root),maintenance=False)
        if (root.parent/'GestionTags'/'revision_pendiente.json').exists() or (root/'revision_instalacion.json').exists():
            raise PermissionError('Revision pendiente.')
        if (install.sha(root/install.ENTRY)!=hashlib.sha256(install.WRAPPER).hexdigest() or
                install.sha(root/'vigilar_sync.py')!=hashlib.sha256(install.MONITOR).hexdigest()):
            raise PermissionError('Entradas distintas del release.')
        for name,digest in install.ROOT_FILES.items():
            if name not in (install.ENTRY,'vigilar_sync.py') and install.sha(root/name)!=digest:
                raise PermissionError('Dependencia r2 distinta.')
    data=root/'acceso-datos'
    gate=SDKGate();ledger=LedgerArchive(data)
    event=threading.Event();old=signal.signal(signal.SIGINT,lambda *_:event.set())
    box=originals=None
    try:
        def recover():
            ledger.recover();check_ledger(data/'cierres')
        with ownership.Owner(root,startup_guard=startup,recover_closed=recover) as owner:
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
            bridge=Bridge(owner,PYTHON32,gate)
            cycle=LegacyCycle(password,root,bridge,guard=owner.guard)
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
                save(root/'registros'/'operacion.json',dict(state,capacity=last_capacity[1],dates_engine=config.ENGINE))
            def rt_command(folder,digest):
                return [str(PYTHON32),'-B',str(Path(__file__).with_name('produccion_worker.py')),'--worker',str(folder),'--sha256',digest]
            service=ProductionService(wrapped_cycle,box,
                lambda:sdk_operativo.RT(owner,PYTHON32,gate,command_factory=rt_command),
                Process(owner.folder/'emisor',root),gate,applying=True,guard=owner.guard,stop=stopped,publish=publish,
                publish_official=lambda state:save(root/'registros'/'estado.json',state),
                before_rt=originals.capacity if originals is not None else box.ensure_capture_capacity)
            service.state['run_id']=owner.run_id
            if storage_error: service.paused=True;service.state['storage_error']=storage_error
            service.emit()
            deadline=time.monotonic()+25
            while read(root.parent/'GestionTags'/'mantenimiento.json').get('active') is True:
                if stopped() or time.monotonic()>deadline: raise PermissionError('Gestor no completo reanudacion.')
                service.emit();time.sleep(.25)
            try:
                result=service.run()
                if result['phase']=='stopped': logging.info('PARADA ORDENADA: SDK y emisor cerrados.')
                return 0 if result['phase']=='stopped' else 1
            except BaseException:
                if gate.fault or gate.active is not None: quarantine(owner,service)
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
        from produccion_paquete import verify_package
        verify_package();settings=config.load(root)
        if hashlib.sha256((Path(__file__).parent/'OPERATIVA_SHA256SUMS.json').read_bytes()).hexdigest()!=settings.release_sha256:
            raise PermissionError('Release no aprobado.')
        logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s',handlers=[
            RotatingFileHandler(Path(root)/'registros'/'sync.log',maxBytes=2000000,backupCount=5,encoding='utf-8')])
        return run(root,settings)
    except BaseException as exc:
        logging.error('OPERACION NO INICIADA/INTERRUMPIDA: %s',type(exc).__name__)
        return 1


if __name__=='__main__': raise SystemExit(main())
