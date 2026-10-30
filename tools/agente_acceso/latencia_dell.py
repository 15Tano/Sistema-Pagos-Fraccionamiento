"""Ensayo de latencia acotado y readonly. No instala ni activa servicios."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import struct
import sys
import threading
import time
import urllib.request
import uuid

from emisor_latencia import ROOT,OWNER,AGENT,SERIAL,SECRET,Process
from emisor_servicio import read,save,utc
import sesion_operativa as session
from sdk_latencia import maintenance_files

SYNC=session.SYNC
SOURCE=Path(r'C:\Program Files (x86)\ZKTeco\ZKAccess3.5\Database_PRO.mdb')
PYTHON32=Path(r'C:\Users\Dell\Python32\python.exe')
POINTER=ROOT/'estado_latencia.json'
REVIEW=SYNC.parent/'GestionTags'/'revision_pendiente.json'


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def preflight():
    from referencia_vigencias import EXPECTED
    from respaldo_protegido import checked_path
    if (os.name!='nt' or struct.calcsize('P')!=8 or
            checked_path(Path(__file__).parent).resolve()!=ROOT.resolve()):
        raise RuntimeError('Usar Python64 y carpeta de ensayo indicada.')
    for name,expected in EXPECTED.items():
        if hashlib.sha256(checked_path(SYNC/name).read_bytes()).hexdigest()!=expected:
            raise PermissionError('Instalacion r2 diferente de la revisada.')
    for path in (PYTHON32,SOURCE,SECRET,SYNC/'access-password.dpapi',SYNC/'sync.lock'):
        if not checked_path(path).is_file():raise PermissionError('Falta dependencia instalada.')
    return {'status':'preflight_ok','scope':'rutas_hashes_sin_sdk_red_mdb_ni_credenciales',
        'dates_applied':False,'tasks_changed':False,'maintenance_required_for_trial':True}


def prepare_owner(root=OWNER):
    """Archivos privados del ensayo; jamas escribir servicio-config en ZKSync."""
    from respaldo_mdb import private_directory
    root=Path(root)
    private_directory(root)
    expected={'sync.lock':b'0',
        'sincronizar_vigencias.py':Path(__file__).read_bytes(),
        'servicio-config.json':json.dumps({'purpose':'latencia_readonly','agent_id':AGENT,'serial':SERIAL},sort_keys=True).encode()}
    for name,raw in expected.items():
        path=root/name
        if path.exists():
            if path.read_bytes()!=raw:raise PermissionError('Fuente privada distinta; conservar ensayo anterior.')
        else:
            with path.open('xb') as stream:
                stream.write(raw);stream.flush();os.fsync(stream.fileno())


def marker_for(pid,run_id):
    if type(pid) is not int or pid<1 or str(uuid.UUID(run_id))!=run_id:raise ValueError('Identidad invalida.')
    return {'protocol':1,'purpose':'latencia_readonly','pid':pid,'run_id':run_id}


def mark(marker,path=REVIEW):
    # Exclusivo: nunca sustituir una revision del gestor u otro ensayo.
    with Path(path).open('xb') as stream:
        stream.write(json.dumps(marker).encode());stream.flush();os.fsync(stream.fileno())


def receipt_rows(data):
    import adaptadores_cierre as closures
    closures.check_ledger(Path(data)/'cierres')
    rows=[]
    for folder in sorted((Path(data)/'cierres').iterdir()) if (Path(data)/'cierres').exists() else []:
        ack=read(folder/'parent_ack.json')
        closed=closures.verified_closure(folder,ack['pid'])
        if closed['error_type']=='ControllerIdentityError':raise PermissionError('Serial no confirmado.')
        rows.append({'worker_id':folder.name,'pid':ack['pid'],
            'closure_sha256':hashlib.sha256((folder/'closed.json').read_bytes()).hexdigest()})
    return rows


def prior_closed():
    if not POINTER.exists():return
    state=read(POINTER)
    marker_for(state['pid'],state['run_id'])
    folder=OWNER/'acceso-datos'/'sesiones'/state['run_id']
    proof=read(folder/'cierre_final.json');result=read(folder/'resultado.json')
    if (state.get('phase')!='stopped' or proof.get('status')!='cierre_latencia_confirmado' or
            proof.get('pid')!=state['pid'] or proof.get('run_id')!=state['run_id'] or
            proof.get('result_sha256')!=digest(result)):
        raise PermissionError('Cierre del ensayo anterior pendiente.')
    # Limite HTTP por proceso: separar inicios evita reiniciar el presupuesto de
    # 90/min dentro de la misma ventana. Nunca corregir el reloj para admitirlo.
    from protocolo import utc as parse
    age=(parse(utc())-parse(proof['checked_utc'])).total_seconds()
    if age<60:raise PermissionError('Esperar 60s desde el cierre anterior antes de otro ensayo.')


def requested(event,run_id):
    if event.is_set():return True
    try:return read(ROOT/'detener_latencia.json')=={'pid':os.getpid(),'run_id':run_id}
    except FileNotFoundError:return False


class TracedRT:
    def __init__(self,client,trace):self.client,self.trace=client,trace
    def connect(self):
        self.trace('rt_connect_started');self.client.connect();self.trace('rt_connected')
    def read(self):return self.client.read()
    def close(self):
        self.trace('rt_close_started');self.client.close();self.trace('rt_closed')


def manual(seconds):
    if type(seconds) is not int or not 20<=seconds<=150:raise ValueError('Ensayo20..150s requerido.')
    preflight();prior_closed()
    import adaptadores_cierre as closures
    import respaldo_real_mdb as previous
    from almacen_operativo import Originals,capture
    from outbox import Outbox
    from ciclo_operativo import Cycle,access_inventory
    from referencia_vigencias import load_reference
    from sdk_operativo import RT,Transport
    from servicio_latencia import LatencyService
    from trabajador_controlado import SDKGate
    password=os.environ.pop('SANISIDRO_ACCESS_PASSWORD',None)
    if not password:raise PermissionError('Usar lanzador DPAPI.')
    event=threading.Event();old=signal.signal(signal.SIGINT,lambda *_:event.set())
    box=originals=None
    try:
        diag=closures.diagnostic_module()
        with diag.maintenance_lock():
            previous.quiet();previous.revisions()
            prepare_owner()
            marker=[None]
            def guard():
                maintenance_files(SYNC,marker[0])
            owner=session.Owner(OWNER,startup_guard=guard)
            marker[0]=marker_for(os.getpid(),owner.run_id)
            mark(marker[0])  # Bloquea reanudacion del gestor hasta verificar cierre final.
            save(POINTER,{'pid':os.getpid(),'run_id':owner.run_id,'phase':'starting'})
            with owner:
                if len(list((owner.data/'sesiones').iterdir()))>16:raise OSError('Limite de sesiones alcanzado.')
                baseline={r['worker_id'] for r in receipt_rows(owner.data)}
                box=Outbox(owner.data/'outbox.sqlite',AGENT,SERIAL)
                originals=Originals(owner.data/'originals.sqlite',AGENT,SERIAL)
                for row in originals.db.execute('SELECT id FROM originals ORDER BY rowid'):
                    capture(box,originals.receipt(row['id']))
                gate=SDKGate()
                def trace(phase):
                    value={'phase':phase,'pc_utc':utc(),'monotonic_s':time.monotonic()}
                    with (owner.folder/'transiciones.jsonl').open('ab') as stream:
                        stream.write((json.dumps(value)+'\n').encode());stream.flush();os.fsync(stream.fileno())
                def checked():owner.guard();guard()
                def command(folder,sha):
                    return [str(PYTHON32),'-B',str(Path(__file__).parent/'sdk_latencia.py'),
                        '--worker',str(folder),'--sha256',sha]
                transport=Transport(owner,PYTHON32,gate,command_factory=command)
                reference=load_reference()
                def api():
                    with urllib.request.urlopen(reference.api_request(),timeout=15) as response:
                        raw=response.read(4*1024**2+1)
                    if len(raw)>4*1024**2:raise ValueError('API excedida.')
                    return json.loads(raw)
                probe=Cycle(api,lambda:access_inventory(SOURCE,password),transport,guard=checked,
                    stop=lambda:requested(event,owner.run_id))
                def cycle():
                    trace('cycle_started')
                    try:return probe()
                    finally:trace('cycle_finished')
                sender=Process(owner.folder/'emisor')
                def publish(value):
                    save(owner.folder/'estado.json',value)
                    save(POINTER,{'pid':os.getpid(),'run_id':owner.run_id,'phase':value['phase']})
                service=LatencyService(cycle,box,lambda:TracedRT(RT(owner,PYTHON32,gate,command_factory=command),trace),
                    sender,gate,applying=False,guard=checked,stop=lambda:requested(event,owner.run_id),publish=publish,
                    observed=lambda:read(SYNC/'registros'/'estado.json'),before_rt=originals.capacity)
                service.state['run_id']=owner.run_id
                print('CANDIDATO READONLY150s max. Gestor en mantenimiento; no presentar tag obligatorio.',flush=True)
                try:
                    result=service.run(seconds)
                except BaseException:
                    # La marca durable permanece incluso si el padre pierde energia.
                    # Un SDK incierto conserva ademas ambos locks hasta revision.
                    if gate.fault or gate.active is not None:
                        print('CIERRE SDK NO CONFIRMADO. Mantener mantenimiento; exclusion retenida.',flush=True)
                        while True:time.sleep(1)
                    raise
                result['worker_receipts']=[r for r in receipt_rows(owner.data) if r['worker_id'] not in baseline]
                result.update(sender_pid=sender.child.pid,dates_applied=False,tasks_changed=False,
                    review_marker=marker[0],queue=box.health())
                result['trial_passed']=(result['phase']=='stopped' and result['cycle']['completed']>0 and
                    result['cycle']['errors']==0 and not any(result.get(k) for k in
                    ('reader_error','storage_error','sender_error')) and result['closures_confirmed'])
                save(owner.folder/'resultado.json',result)
                print(json.dumps({'phase':result['phase'],'trial_passed':result['trial_passed'],
                    'cycle':result['cycle'],'queue':result['queue'],'run_id':owner.run_id,
                    'dates_applied':False,'closures_confirmed':result['closures_confirmed']},indent=2))
                print('Evidencia: '+str(owner.folder),flush=True)
                return 0 if result['trial_passed'] else 1
    finally:
        if originals is not None:originals.close()
        if box is not None:box.close()
        signal.signal(signal.SIGINT,old)


def verify_closed():
    preflight()
    import respaldo_real_mdb as previous
    pointer=read(POINTER);marker=marker_for(pointer['pid'],pointer['run_id'])
    folder=OWNER/'acceso-datos'/'sesiones'/pointer['run_id']
    result=read(folder/'resultado.json')
    if (pointer.get('phase')!='stopped' or result.get('pid')!=pointer['pid'] or
            result.get('run_id')!=pointer['run_id'] or result.get('closures_confirmed') is not True or
            result.get('phase')!='stopped' or result.get('dates_applied') is not False or
            result.get('sdk_gate')!={'active':None,'fault':False} or result.get('review_marker')!=marker):
        raise PermissionError('Resultado/identidad/cierre no confirmados.')
    with session.sync_lock(SYNC/'sync.lock'):
        maintenance_files(SYNC,marker)
        rows=receipt_rows(OWNER/'acceso-datos')
        selected=[row for row in rows if row['worker_id'] in {r['worker_id'] for r in result['worker_receipts']}]
        if selected!=result['worker_receipts']:raise PermissionError('Recibos cambiaron.')
        owner=read(folder/'owner.json')
        sender=read(folder/'emisor'/'closed.json');state=read(folder/'emisor'/'sender.json')
        request=read(folder/'emisor'/'request.json')
        if (owner.get('phase')!='closed' or owner.get('pid')!=pointer['pid'] or owner.get('run_id')!=pointer['run_id'] or
                sender!={'protocol':1,'pid':result['sender_pid'],'run_id':request['run_id'],
                    'exit_code':sender.get('exit_code'),'report':state} or sender.get('exit_code') not in (0,2) or
                state.get('pid')!=result['sender_pid'] or state.get('run_id')!=request['run_id'] or
                state.get('phase')!=('stopped' if sender['exit_code']==0 else 'blocked')):
            raise PermissionError('Falta cierre de propietario o emisor.')
        previous.quiet([pointer['pid'],result['sender_pid'],*[r['pid'] for r in selected]])
        if read(POINTER)!=pointer or read(REVIEW)!=marker:raise PermissionError('Identidad cambiada.')
        from outbox import Outbox
        from resumen_latencia import summarize,worker_statistics
        box=Outbox(OWNER/'acceso-datos'/'outbox.sqlite')
        try:metrics=summarize(box,folder,result)
        finally:box.close()
        # selected ya fue vinculado a los hashes/recibos SDK verificados arriba.
        metrics.update(worker_statistics([read(OWNER/'acceso-datos'/'cierres'/r['worker_id']/'closed.json')
            for r in selected]))
        save(folder/'medicion.json',metrics)
        proof={'status':'cierre_latencia_confirmado',**pointer,'result_sha256':digest(result),
            'checked_utc':utc(),'dates_applied':False,'trial_passed':result['trial_passed']}
        save(folder/'cierre_final.json',proof)
        REVIEW.unlink()  # Solo nuestra marca; tareas siguen pausadas hasta accion del gestor.
    print(json.dumps(proof,indent=2))
    print(json.dumps(metrics,indent=2))
    print('Cierre confirmado. Terminar y reanudar en gestor; comprobar dos ciclos nuevos.')
    return 0


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    modes=parser.add_mutually_exclusive_group(required=True)
    modes.add_argument('--preflight',action='store_true')
    modes.add_argument('--mantenimiento',action='store_true')
    modes.add_argument('--verificar-cierre',action='store_true')
    modes.add_argument('--detener',action='store_true')
    parser.add_argument('--seconds',type=int,default=150)
    args=parser.parse_args()
    try:
        from paquete_latencia import verify_package
        verify_package()
        if args.preflight:print(json.dumps(preflight(),indent=2));return 0
        if args.mantenimiento:return manual(args.seconds)
        if args.verificar_cierre:return verify_closed()
        value=read(POINTER)
        if value['phase'] in ('stopped','fault'):raise PermissionError('Ensayo ya detenido.')
        marker_for(value['pid'],value['run_id'])
        save(ROOT/'detener_latencia.json',{'pid':value['pid'],'run_id':value['run_id']})
        print('Parada solicitada. Esperar cierre final; mantener mantenimiento.');return 0
    except BaseException as exc:
        print('ENSAYO NO CONFIRMADO: '+type(exc).__name__+'. Conservar mantenimiento/evidencia.');return 1


if __name__=='__main__':raise SystemExit(main())
