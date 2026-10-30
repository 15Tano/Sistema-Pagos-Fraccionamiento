"""Agrupador/emisor candidato en proceso propio. Nunca importa SDK o Access."""
import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import uuid

from emisor import Sender,HttpTransport
from emisor_servicio import ProcessSender,parent_channel,read,save,utc
from latencia_politicas import BatchPolicy,RequestBudget
from outbox import Outbox
from protocolo import validate_ack

ROOT=Path(r'C:\SanIsidro\LatenciaCandidata_20261028_r2')
OWNER=ROOT/'datos'/'propietario'
AGENT='c8d7ccdc-991f-497c-8383-92fb52921f8a'
SERIAL='CO2K225060027'
LAB_URL='http://127.0.0.1:18881/api/control-acceso/agente'
SECRET=Path(r'C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento\credencial-ingesta.dpapi')


class TraceTransport:
    """Un envio por llamada. Un fallo de traza NO se convierte en otro HTTP."""
    def __init__(self,transport,budget,trace,*,clock=time.monotonic,stamp=utc):
        self.transport,self.budget,self.trace=transport,budget,trace
        self.clock,self.stamp=clock,stamp

    def send(self,endpoint,body):
        payload=json.loads(body)
        identity={'endpoint':endpoint,'session_id':payload['session_id'],
            'sequence':payload['sequence'],'batch_id':payload.get('batch_id'),
            'body_sha256':hashlib.sha256(body).hexdigest(),'attempt_id':str(uuid.uuid4())}
        self.trace(dict(identity,phase='http_started',pc_utc=self.stamp()))
        self.budget.consume()
        start=self.clock()
        try:
            status,ack,retry_after=self.transport.send(endpoint,body)
        except (OSError,ValueError) as exc:
            self.trace(dict(identity,phase='http_failed',pc_utc=self.stamp(),
                seconds=self.clock()-start,error_type=type(exc).__name__))
            raise
        valid=False
        try:
            validate_ack(status,ack,payload,identity['body_sha256'])
            valid=True
        except (ValueError,TypeError,KeyError):
            pass
        self.trace(dict(identity,phase='http_finished',pc_utc=self.stamp(),seconds=self.clock()-start,
            status=status,ack_valid=valid,
            server_received_at_utc=ack['server_received_at_utc'] if valid else None))
        return status,ack,retry_after


def loop(box,sender,batcher,budget,publish,stop,*,clock=time.monotonic,sleep=time.sleep,stamp=utc):
    counts=Counter()
    state={'phase':'starting','last_attempt_utc':None,'last_ack_utc':None,'last_outcome':None}
    last=-float('inf')
    last_key=None
    def emit(force=False):
        nonlocal last,last_key
        key=(state['phase'],state['last_outcome'],state['last_ack_utc'])
        if force or key!=last_key or clock()-last>=1:
            publish(dict(state,heartbeat_utc=stamp(),outcomes=dict(counts),health=box.health()))
            last,last_key=clock(),key
    emit(True)
    while not stop():
        if box.health()['paused']:
            state.update(phase='blocked',last_outcome='blocked')
            emit(True)
            break
        batcher.tick()  # Independiente del ciclo SDK del padre.
        wait=budget.delay()
        if wait>0:
            state.update(phase='rate_limited',last_outcome='rate_limited')
            emit()
            sleep(min(.1,wait))
            continue
        # Sender.once conserva lease, bytes y next_attempt; si no hay mensaje
        # no se consume presupuesto ni se inventa un ACK.
        state['last_attempt_utc']=stamp()
        outcome=sender.once()
        counts[outcome]+=1
        state['last_outcome']=outcome
        if outcome=='acked':
            state['last_ack_utc']=stamp()
        state['phase']='blocked' if outcome=='blocked' else 'backoff' if outcome in ('retry','lease_reassigned') else 'idle'
        emit()
        if outcome=='blocked':
            break
        sleep(.1)
    if not box.health()['paused']:
        # Al perder el padre no hacer mas HTTP. Dejar la cola final inmutable y
        # durable para entrega posterior, incluidas respuestas que aun no se agruparon.
        for _ in range(5):
            if box.build_batch() is None:
                break
    state['phase']='blocked' if box.health()['paused'] or state['phase']=='blocked' else 'stopped'
    emit(True)
    return state


class Process(ProcessSender):
    def __init__(self,folder,base=OWNER,*,command=None,python=sys.executable):
        command=command or [str(python),'-B',str(Path(__file__).resolve()),'--worker',str(folder)]
        super().__init__(folder,base,command=command,python=python)


def worker(folder,*,base=OWNER,transport=None,secret_loader=None):
    folder=Path(folder)
    request=read(folder/'request.json')
    if (set(request)!={'protocol','run_id','base'} or request['protocol']!=1 or
            Path(request['base']).resolve()!=Path(base).resolve() or
            str(uuid.UUID(request['run_id']))!=request['run_id']):
        raise ValueError('Peticion de emisor candidata ajena.')
    identity={'protocol':1,'pid':os.getpid(),'run_id':request['run_id']}
    box=None
    report=None
    exit_code=1
    stop=parent_channel(sys.stdin)
    try:
        box=Outbox(Path(base)/'acceso-datos'/'outbox.sqlite')
        if box.identity['agent_id']!=AGENT or box.identity['device_serial']!=SERIAL:
            raise ValueError('Identidad de ensayo distinta.')
        if transport is None:
            if secret_loader is None:
                from credencial import load
                secret_loader=load
            transport=HttpTransport(LAB_URL,secret_loader(SECRET),local_trial=True)
        budget=RequestBudget()
        trace_path=folder/'http.jsonl'
        def trace(value):
            try:
                if trace_path.exists() and trace_path.stat().st_size>4*1024**2:
                    raise OSError('Traza excedida.')
                with trace_path.open('ab') as stream:
                    stream.write((json.dumps(value,ensure_ascii=True)+'\n').encode('ascii'))
                    stream.flush()
                    os.fsync(stream.fileno())
            except OSError:
                # RuntimeError NO lo trata Sender.once como fallo de red.
                raise RuntimeError('No se pudo conservar la traza HTTP; emisor detenido.') from None
        sender=Sender(box,TraceTransport(transport,budget,trace))
        def publish(value):
            nonlocal report
            report=dict(value,**identity)
            save(folder/'sender.json',report)
        final=loop(box,sender,BatchPolicy(box),budget,publish,stop)
        exit_code=2 if final['phase']=='blocked' else 0
    except BaseException as exc:
        report=dict(identity,phase='fault',error_type=type(exc).__name__,heartbeat_utc=utc())
    finally:
        try:
            if box is not None:
                box.close()
        except BaseException as exc:
            exit_code=1
            report=dict(identity,phase='fault',error_type=type(exc).__name__,heartbeat_utc=utc())
        if report is not None:
            save(folder/'sender.json',report)
            save(folder/'closed.json',dict(identity,exit_code=exit_code,report=report))
    return exit_code


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker',type=Path,required=True)
    args=parser.parse_args()
    try:
        from paquete_latencia import verify_package
        verify_package()
        return worker(args.worker)
    except BaseException:
        return 1


if __name__=='__main__':
    raise SystemExit(main())
