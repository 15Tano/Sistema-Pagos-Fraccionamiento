"""Entrada candidata unificada. Solo ensayo readonly; no instala ni aplica fechas."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import struct
import threading
import time
import urllib.request
import uuid

from paquete_servicio import verify_package

ROOT = Path(__file__).resolve().parent
DESTINATION = Path(r'C:\SanIsidro\ServicioIntegrado_20261026')
SYNC = Path(r'C:\SanIsidro\ZKSync')
BASE = Path(r'C:\SanIsidro\CoordinadorEnsayo_20261024')
DATA = BASE / 'datos' / 'lectura_mantenimiento'
PYTHON32 = Path(r'C:\Users\Dell\Python32\python.exe')
SOURCE = Path(r'C:\Program Files (x86)\ZKTeco\ZKAccess3.5\Database_PRO.mdb')


def preflight():
    from referencia_vigencias import EXPECTED
    from respaldo_protegido import checked_path
    if os.name != 'nt' or struct.calcsize('P') != 8 or checked_path(ROOT).resolve() != DESTINATION.resolve():
        raise RuntimeError('Usar Python64 y carpeta indicada.')
    for name, digest in EXPECTED.items():
        if hashlib.sha256(checked_path(SYNC / name).read_bytes()).hexdigest() != digest:
            raise RuntimeError('Instalacion r2 diferente.')
    for path in (PYTHON32, SOURCE, DATA/'outbox.sqlite', DATA/'credencial-ingesta.dpapi', SYNC/'access-password.dpapi'):
        if not checked_path(path).is_file():
            raise RuntimeError('Falta dependencia instalada.')
    return {'status': 'preflight_ok', 'scope': 'rutas_y_hashes_sin_sdk_red_credenciales_ni_mdb',
            'dates_applied': False, 'tasks_changed': False, 'maintenance_required_for_trial': True}


def closure_rows(names):
    import adaptadores_cierre as closures
    import vigencias_candidato as core
    core.check_operations(DATA/'cierres')
    result = []
    if not isinstance(names, list) or len(set(names)) != len(names):
        raise ValueError('Lista de recibos invalida.')
    for name in sorted(names):
        if str(uuid.UUID(name)) != name:
            raise ValueError('UUID de trabajador invalido.')
        folder = DATA/'cierres'/name
        ack = closures.bounded_json(folder/'parent_ack.json')
        closures.verified_closure(folder, ack['pid'])
        result.append({'worker_id': name, 'pid': ack['pid'],
                       'closure_sha256': hashlib.sha256((folder/'closed.json').read_bytes()).hexdigest()})
    return result


def stopped(run_id, event):
    if event.is_set():
        return True
    from emisor_servicio import read
    try:
        request = read(ROOT/'detener_servicio.json')
        if request == {'pid': os.getpid(), 'run_id': run_id}:
            return True
    except (OSError, ValueError):
        pass
    try:
        state = read(Path(r'C:\SanIsidro\GestionTags\mantenimiento.json'))
        return state.get('active') is not True
    except (OSError, ValueError):
        return True


def request_stop():
    from emisor_servicio import read, save
    state=read(ROOT/'estado_servicio.json')
    if state.get('phase') in ('stopped','fault'):
        raise RuntimeError('Ejecucion ya detenida o pendiente de revision.')
    if (type(state.get('pid')) is not int or state['pid']<1 or
            str(uuid.UUID(state['run_id']))!=state['run_id']):
        raise ValueError('Identidad de ejecucion invalida.')
    save(ROOT/'detener_servicio.json',{'pid':state['pid'],'run_id':state['run_id']})
    print('PARADA SOLICITADA. Esperar cierre_servicio_confirmado; no cambia tareas.')
    return 0


def manual(seconds, run_id):
    preflight()
    import adaptadores_cierre as closures
    import aplicador_integrado as integrated
    import respaldo_real_mdb as previous
    import entregar_coordinador as delivery
    from captura_rt import capacity, recover
    from ciclo_operativo import Cycle, access_inventory
    from emisor_servicio import ProcessSender, read, save
    from referencia_vigencias import load_reference
    from respaldo_ciclo import CycleTransport
    from servicio_integrado import Service
    from trabajador_controlado import SDKGate
    if type(seconds) is not int or not 5 <= seconds <= 150 or str(uuid.UUID(run_id)) != run_id:
        raise ValueError('Ensayo5..150s y UUID requeridos.')
    password = os.environ.get('SANISIDRO_ACCESS_PASSWORD')
    if not password:
        raise RuntimeError('Usar lanzador DPAPI.')
    diag = closures.diagnostic_module()
    event = threading.Event()
    old = signal.signal(signal.SIGINT, lambda *_: event.set())
    box = None
    try:
        with previous.pub().own_lock(ROOT/'servicio.lock'), diag.maintenance_lock():
            previous.quiet()
            previous.revisions()
            integrated.check_runs(DATA/'transacciones_servicio')
            pointer = ROOT/'estado_servicio.json'
            if pointer.exists():
                before = read(pointer)
                prior = ROOT/'datos'/'sesiones'/before['run_id']
                result, proof = read(prior/'resultado.json'), read(prior/'cierre_final.json')
                if (before.get('phase') != 'stopped' or proof.get('status') != 'cierre_servicio_confirmado' or
                        proof.get('run_id') != before['run_id'] or proof.get('pid') != before['pid'] or
                        proof.get('result_sha256') != hashlib.sha256(json.dumps(result,sort_keys=True,separators=(',',':')).encode()).hexdigest()):
                    raise RuntimeError('Cierre anterior pendiente.')
            sessions = ROOT/'datos'/'sesiones'
            sessions.mkdir(parents=True, exist_ok=True)
            if sum(1 for _ in sessions.iterdir()) >= 64:
                raise OSError('Limite de sesiones; originales no se borran.')
            folder = sessions/run_id
            folder.mkdir(exist_ok=False)
            baseline = {p.name for p in (DATA/'cierres').iterdir() if p.is_dir()}
            save(folder/'baseline.json', sorted(baseline))
            runtime = delivery.Delivery(BASE)
            box = runtime.box
            recover(DATA/'originales', box)
            gate = SDKGate()
            last_guard = [-float('inf')]
            def guard():
                if any((DATA/name).exists() for name in ('revision_vigencias.json','cierre_inseguro.json')):
                    raise RuntimeError('Revision SDK pendiente.')
                if stopped(run_id, event):
                    from ciclo_operativo import CycleInterrupted
                    raise CycleInterrupted('Mantenimiento finalizado/parada solicitada.')
                # El lock permanece adquirido. Revisar tarea completa cada5s; bandera/markers en cada llamada.
                if time.monotonic()-last_guard[0] >= 5:
                    diag.maintenance_guard()
                    last_guard[0] = time.monotonic()
            sdk = CycleTransport(DATA, PYTHON32, gate=gate, guard=guard, timeout=60)
            reference = load_reference()
            def api():
                with urllib.request.urlopen(reference.api_request(), timeout=15) as response:
                    raw = response.read(4*1024*1024+1)
                if len(raw) > 4*1024*1024:
                    raise ValueError('API excedida.')
                return json.loads(raw)
            probe = Cycle(api, lambda: access_inventory(SOURCE, password), sdk, guard=guard,
                          stop=lambda: stopped(run_id,event))
            sender = ProcessSender(folder/'emisor', BASE)
            def publish(value):
                save(folder/'estado.json', value)
                save(pointer, {'pid': os.getpid(), 'run_id': run_id, 'phase': value['phase']})
            run = Service(probe, box, lambda: closures.SafeRTClient(gate, DATA/'cierres', PYTHON32, run_id),
                sender, gate, applying=False, guard=guard, stop=lambda: stopped(run_id,event),
                publish=publish, observed=lambda: read(SYNC/'registros'/'estado.json'),
                before_rt=lambda: capacity(DATA/'originales'))
            run.state['run_id'] = run_id
            print('SERVICIO UNIFICADO SOLO LECTURA. Vigencias r2 permanecen pausadas por gestor.', flush=True)
            result = run.run(seconds)
            current = {p.name for p in (DATA/'cierres').iterdir() if p.is_dir()}
            result['worker_receipts'] = closure_rows(sorted(current-baseline))
            result['sender_pid'] = sender.child.pid if sender.child is not None else None
            result['dates_applied'] = False
            result['trial_passed'] = (result['phase']=='stopped' and result['cycle']['completed']>0 and
                result['cycle']['errors']==0 and not result['reader_error'] and not result['storage_error'] and
                not result['sender_error'] and result['closures_confirmed'])
            save(folder/'resultado.json',result)
            print(json.dumps(result,indent=2))
            print('Evidencia: '+str(folder))
            return 0 if result['trial_passed'] else 1
    finally:
        if box is not None:
            box.close()
        signal.signal(signal.SIGINT,old)


def verify_closed(run_id):
    preflight()
    import respaldo_real_mdb as previous
    from emisor_servicio import read, save
    pointer = read(ROOT/'estado_servicio.json')
    if pointer.get('run_id') != run_id or pointer.get('phase') != 'stopped':
        raise RuntimeError('Ejecucion no detenida o de otra identidad.')
    folder = ROOT/'datos'/'sesiones'/run_id
    result = read(folder/'resultado.json')
    if (result.get('pid') != pointer['pid'] or result.get('run_id') != run_id or
            result.get('phase') != 'stopped' or result.get('closures_confirmed') is not True or
            result.get('dates_applied') is not False or result.get('sdk_gate') != {'active':None,'fault':False}):
        raise RuntimeError('Resultado/cierre no confirmados.')
    from adaptadores_cierre import diagnostic_module
    diag = diagnostic_module()
    with previous.pub().own_lock(ROOT/'servicio.lock'), diag.maintenance_lock():
        rows = closure_rows([r['worker_id'] for r in result['worker_receipts']])
        if rows != result['worker_receipts']:
            raise RuntimeError('Recibos cambiaron.')
        sender = read(folder/'emisor'/'closed.json')
        sender_state = read(folder/'emisor'/'sender.json')
        sender_request = read(folder/'emisor'/'request.json')
        if (sender != {'protocol':1,'pid':result['sender_pid'],'run_id':sender_request['run_id'],
                       'exit_code':sender.get('exit_code'),'report':sender_state} or
                sender.get('exit_code') not in (0,2) or sender_state.get('pid') != result['sender_pid'] or
                sender_state.get('run_id') != sender_request['run_id'] or
                sender_state.get('phase') != ('stopped' if sender['exit_code']==0 else 'blocked')):
            raise RuntimeError('Cierre HTTP no confirmado.')
        previous.quiet([pointer['pid'],result['sender_pid'],*[r['pid'] for r in rows]])
        if read(ROOT/'estado_servicio.json') != pointer:
            raise RuntimeError('Cambio de ejecucion.')
        digest = hashlib.sha256(json.dumps(result,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        proof = {'status':'cierre_servicio_confirmado',**pointer,'result_sha256':digest,
                 'dates_applied':False,'trial_passed':result['trial_passed'],'checked_utc':previous.pub().now()}
        save(folder/'cierre_final.json',proof)
    print(json.dumps(proof,indent=2))
    print('Cierre confirmado. Terminar y reanudar en el gestor; comprobar dos ciclos nuevos.')
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument('--preflight', action='store_true')
    modes.add_argument('--mantenimiento', action='store_true')
    modes.add_argument('--verificar-cierre', action='store_true')
    modes.add_argument('--detener', action='store_true')
    parser.add_argument('--seconds',type=int,default=150)
    parser.add_argument('--run-id')
    args = parser.parse_args()
    try:
        verify_package()
        if args.preflight:
            print(json.dumps(preflight(),indent=2))
            return 0
        if args.detener:
            return request_stop()
        if not args.run_id or str(uuid.UUID(args.run_id)) != args.run_id:
            raise ValueError('UUID requerido.')
        return verify_closed(args.run_id) if args.verificar_cierre else manual(args.seconds,args.run_id)
    except BaseException as exc:
        print('SERVICIO NO CONFIRMADO: '+type(exc).__name__+'. Conservar mantenimiento y evidencia.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
