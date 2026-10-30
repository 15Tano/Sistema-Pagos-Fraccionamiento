"""Emisor de produccion con agrupacion breve, HTTPS y archivos ACK. Sin SDK/ACE."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

from almacen_operativo import HotOutbox,Originals,Archives
import credencial
from emisor import HttpTransport,Sender
from emisor_operativo import ArchivingSender
from emisor_servicio import ProcessSender,parent_channel,read,save,utc
from emisor_latencia import loop,TraceTransport
from latencia_politicas import BatchPolicy,RequestBudget
import produccion_config as config

ROOT=Path(r'C:\SanIsidro\ZKSync')


class Process(ProcessSender):
    def __init__(self,folder,root=ROOT):
        super().__init__(folder,root,command=[sys.executable,'-B',str(Path(__file__).resolve()),'--worker',str(folder)])


def worker(folder,*,root=ROOT,transport=None,stop=None):
    folder=Path(folder);request=read(folder/'request.json')
    if (set(request)!={'protocol','run_id','base'} or request['protocol']!=1 or
            Path(request['base']).resolve()!=Path(root).resolve()): raise ValueError('Emisor ajeno.')
    settings=config.load(root);config.activation(root,settings)
    identity={'protocol':1,'pid':os.getpid(),'run_id':request['run_id']}
    box=originals=None;report=None;code=1
    stopped=stop or parent_channel(sys.stdin)
    try:
        data=Path(root)/'acceso-datos'
        box=HotOutbox(data/'outbox.sqlite');originals=Originals(data/'originals.sqlite')
        if (box.identity['agent_id']!=settings.agent_id or box.identity['device_serial']!=settings.serial or
                originals.identity!={'agent_id':settings.agent_id,'serial':settings.serial}):
            raise ValueError('Almacen ajeno.')
        archives=Archives(data/'ack_archivados',originals);archives.verify_catalog()
        budget=RequestBudget()
        if transport is None: transport=HttpTransport(settings.url,credencial.load(data/'credencial-ingesta.dpapi'),timeout=10)
        # Contar todos los intentos HTTP sin guardar cuerpos ni credenciales en trazas.
        def trace(row):
            if row['phase']=='http_finished':
                save(folder/'ultimo_http.json',row)
        transport=TraceTransport(transport,budget,trace)
        sender=ArchivingSender(Sender(box,transport),box,archives)
        def publish(value):
            nonlocal report
            report=dict(value,**identity);save(folder/'sender.json',report)
        result=loop(box,sender,BatchPolicy(box),budget,publish,stopped)
        code=2 if result['phase']=='blocked' else 0
    except BaseException as exc:
        report=dict(identity,phase='fault',error_type=type(exc).__name__,heartbeat_utc=utc())
    finally:
        try:
            if box is not None: box.close()
            if originals is not None: originals.close()
        except BaseException as exc:
            code=1;report=dict(identity,phase='fault',error_type=type(exc).__name__,heartbeat_utc=utc())
        if report is not None:
            save(folder/'sender.json',report);save(folder/'closed.json',dict(identity,exit_code=code,report=report))
    return code


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--worker',type=Path,required=True)
    args=parser.parse_args()
    try:
        from produccion_paquete import verify_package
        verify_package()
        return worker(args.worker)
    except BaseException: return 1


if __name__=='__main__': raise SystemExit(main())
