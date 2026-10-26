"""Emisor definitivo preparado: HTTPS fijo, DPAPI propia y archivos ACK sin SDK."""
import argparse
import os
from pathlib import Path
import sys

from almacen_operativo import HotOutbox,Originals,Archives
import config_operativa as config
import credencial
from emisor import HttpTransport,Sender
from emisor_servicio import ProcessSender,loop,parent_channel,read,save,utc

ROOT=Path(r'C:\SanIsidro\ZKSync')


class ArchivingSender:
    def __init__(self,sender,box,archives):
        self.sender,self.box,self.archives=sender,box,archives

    def once(self):
        # Recuperar ACK anteriores que aun tienen copia caliente antes de pedir otro.
        if self.archives.archive_one(self.box): return 'idle'
        result=self.sender.once()
        if result=='acked': self.archives.archive_one(self.box)
        return result


class Process(ProcessSender):
    def __init__(self,folder,root=ROOT,*,command=None):
        command=command or [sys.executable,'-B',str(Path(__file__).resolve()),'--worker',str(folder)]
        super().__init__(folder,root,command=command)


def worker(folder,*,root=ROOT,transport=None):
    folder=Path(folder);request=read(folder/'request.json')
    if (set(request)!={'protocol','run_id','base'} or request['protocol']!=1 or
            Path(request['base']).resolve()!=Path(root).resolve()): raise ValueError('Emisor de otra raiz.')
    settings=config.load(root);config.activation(root,settings)
    identity={'protocol':1,'pid':os.getpid(),'run_id':request['run_id']}
    box=originals=None;report=None;code=1;stopped=parent_channel(sys.stdin)
    try:
        data=Path(root)/'acceso-datos'
        box=HotOutbox(data/'outbox.sqlite');originals=Originals(data/'originals.sqlite')
        if box.identity['agent_id']!=settings.agent_id or box.identity['device_serial']!=settings.serial or originals.identity!={'agent_id':settings.agent_id,'serial':settings.serial}:
            raise ValueError('Cola/originales de otra identidad.')
        archives=Archives(data/'ack_archivados',originals);archives.verify_catalog()
        if transport is None:
            transport=HttpTransport(settings.url,credencial.load(data/'credencial-ingesta.dpapi'),timeout=10)
        sender=ArchivingSender(Sender(box,transport),box,archives)
        def publish(value):
            nonlocal report
            report=dict(value,**identity);save(folder/'sender.json',report)
        value=loop(box,sender,publish,stopped)
        code=2 if value['phase']=='blocked' else 0
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
        from preparar_operacion import verify_package
        verify_package();return worker(args.worker)
    except BaseException: return 1


if __name__=='__main__': raise SystemExit(main())
