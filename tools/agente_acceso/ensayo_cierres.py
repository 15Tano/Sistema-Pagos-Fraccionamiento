"""Ensayo acotado con adaptadores de cierre. Simulacion por defecto; nunca aplica."""
import argparse
import datetime as dt
import hashlib
import io
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import struct
import sys
import unittest
import uuid

from adaptadores_cierre import SafeReferenceProbe, SafeRTClient, check_ledger
from captura_rt import UnsafeClosure, atomic_json, capacity, diagnostic_module, recover
from coordinador import Coordinator
from outbox import Outbox
from referencia_vigencias import EXPECTED
from trabajador_controlado import SDKGate

ROOT = Path(__file__).resolve().parent
SYNC = Path(r'C:\SanIsidro\ZKSync')
DATA = Path(r'C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento')
STATE = DATA / 'estado_cierres.json'
STOP = DATA / 'detener_cierres.json'
AGENT = 'c8d7ccdc-991f-497c-8383-92fb52921f8a'
SERIAL = 'CO2K225060027'
PYTHON32 = Path(r'C:\Users\Dell\Python32\python.exe')
RELEASE = '2026.10.24-1'


def verify_package():
    manifest = json.loads((ROOT / 'CIERRES_SHA256SUMS.json').read_text(encoding='utf-8-sig'))
    expected = {'adaptadores_cierre.py', 'ensayo_cierres.py', 'trabajador_controlado.py',
        'control_operativo.py', 'captura_rt.py', 'coordinador.py', 'outbox.py', 'protocolo.py',
        'referencia_vigencias.py', 'referencia_r2/sincronizar_vigencias.py', 'referencia_r2/sync_runtime.py',
        'referencia_r2/c3_worker.py', 'referencia_r2/c3_panel.py', 'referencia_r2/FUENTE.json',
        'runtime/lector_eventos.py', 'lanzar_cierres.ps1', 'verificar_cierres.ps1',
        'LEEME_CIERRES.md', 'tests/test_adaptadores_cierre.py'}
    if manifest['release'] != RELEASE or len(manifest['files']) != len(expected) or {row['name'] for row in manifest['files']} != expected:
        raise ValueError('Manifiesto inesperado.')
    for row in manifest['files']:
        if hashlib.sha256((ROOT / row['name']).read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Fuentes alteradas.')


def request_stop():
    state = json.loads(STATE.read_text(encoding='utf-8'))
    if state['phase'] in ('fault', 'stopped'):
        print('Ensayo detenido o pendiente de revision; no se modificaron tareas.')
        return
    atomic_json(STOP, {'pid': state['pid'], 'run_id': state['run_id']})
    print('PARADA SOLICITADA. Esperar Cierre coordinador antes de reanudar por gestor.')


def manual(seconds):
    if os.name != 'nt' or struct.calcsize('P') != 8:
        raise RuntimeError('Usar lanzador con Python x64 y DPAPI instalado.')
    if ROOT.is_relative_to(SYNC.resolve()) or ROOT.is_relative_to(Path(r'C:\SanIsidro\GestionTags').resolve()):
        raise RuntimeError('Usar carpeta separada.')
    if not (DATA / 'outbox.sqlite').is_file():
        raise RuntimeError('Falta almacen real anterior. No crear otra identidad/base.')
    password = os.environ.get('SANISIDRO_ACCESS_PASSWORD')
    if not password:
        raise RuntimeError('Usar lanzador DPAPI.')
    for name, digest in EXPECTED.items():
        if hashlib.sha256((SYNC / name).read_bytes()).hexdigest() != digest:
            raise RuntimeError('Instalacion r2 distinta de referencia.')
    diag, run_id = diagnostic_module(), str(uuid.uuid4())
    handler = RotatingFileHandler(DATA / 'comparacion_cierres.log', maxBytes=2000000, backupCount=2, encoding='utf-8')
    logging.getLogger().addHandler(handler)
    logging.getLogger().setLevel(logging.INFO)
    box, started, unsafe = None, False, False
    try:
        with diag.maintenance_lock():
            if STATE.exists() and json.loads(STATE.read_text(encoding='utf-8-sig')).get('phase') == 'fault':
                raise UnsafeClosure('Estado anterior fault requiere revision.')
            check_ledger(DATA / 'cierres')
            box = Outbox(DATA / 'outbox.sqlite')
            if box.identity['agent_id'] != AGENT or box.identity['device_serial'] != SERIAL:
                raise RuntimeError('Almacen de otra identidad.')
            recovered = recover(DATA / 'originales', box)
            gate = SDKGate()
            probe = SafeReferenceProbe(password, gate, DATA / 'cierres', PYTHON32, run_id)
            def stopped():
                try:
                    request = json.loads(STOP.read_text(encoding='utf-8-sig'))
                    if request.get('pid') == os.getpid() and request.get('run_id') == run_id:
                        return True
                except (OSError, ValueError, AttributeError):
                    pass
                try:
                    maintenance = json.loads((diag.GESTOR / 'mantenimiento.json').read_text(encoding='utf-8-sig'))
                    return maintenance.get('active') is not True or (diag.GESTOR / 'revision_pendiente.json').exists()
                except (OSError, ValueError):
                    return True
            def observed():
                try:
                    return json.loads((SYNC / 'registros' / 'estado.json').read_text(encoding='utf-8-sig'))
                except (OSError, ValueError):
                    return None
            def sink(state):
                atomic_json(STATE, state | {'run_id': run_id, 'adapter_version': RELEASE,
                    'sdk_gate': {'fault': gate.fault, 'active': gate.active}})
            run = Coordinator(box, probe, lambda: SafeRTClient(gate, DATA / 'cierres', PYTHON32, run_id),
                before_rt=lambda: capacity(DATA / 'originales'), stop=stopped, observed_state=observed, sink=sink)
            print('ENSAYO DE CIERRES SOLO LECTURA. Mantener gestor en mantenimiento.', flush=True)
            print('Originales anteriores revisados: ' + str(recovered), flush=True)
            started = True
            state = run.run(seconds=seconds)
            closures = check_ledger(DATA / 'cierres')
            report = {'phase': state['phase'], 'stop_reason': state['stop_reason'],
                'cycle_probe': state['cycle_probe'], 'reader_error': state['reader_error'],
                'storage_error': state['storage_error'], 'sdk_gate_fault': gate.fault,
                'closures_acknowledged': closures, 'health': box.health()}
            atomic_json(DATA / 'resultado_cierres.json', report)
            print(json.dumps(report, indent=2))
            return 0 if not (state['cycle_probe']['total_errors'] or state['reader_error'] or state['storage_error']) else 1
    except UnsafeClosure:
        unsafe = True
        raise
    finally:
        if box is not None:
            box.close()
        logging.getLogger().removeHandler(handler)
        handler.close()
        if unsafe:
            print('CIERRE/IDENTIDAD SDK SIN CONFIRMAR. No reanudar automaticamente; conservar evidencia.', flush=True)
        elif started:
            print('Cierre coordinador. Terminar y reanudar por gestor; comprobar dos ciclos nuevos.', flush=True)
        else:
            print('Ensayo no iniciado. Revisar evidencia antes de otra operacion.', flush=True)


def simulate():
    print('Simulando adaptadores de cierre con trabajadores ficticios. Sin SDK, red, Access ni tareas.', flush=True)
    log = io.StringIO()
    suite = unittest.defaultTestLoader.discover(str(ROOT / 'tests'), pattern='test_adaptadores_cierre.py')
    result = unittest.TextTestRunner(stream=log, verbosity=2).run(suite)
    folder = ROOT / 'registros'
    folder.mkdir(exist_ok=True)
    name = 'simulacion_cierres_' + dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    (folder / (name + '.txt')).write_text(log.getvalue(), encoding='utf-8')
    report = {'result': 'simulation_ok' if result.wasSuccessful() and result.testsRun > 0 and not result.skipped else 'simulation_failed',
        'scope': 'adaptadores_ficticios_sin_sdk_red_access_tareas', 'tests': result.testsRun,
        'failures': len(result.failures), 'errors': len(result.errors), 'skipped': len(result.skipped),
        'evidence': str(folder / (name + '.json'))}
    atomic_json(folder / (name + '.json'), report)
    print(json.dumps(report, indent=2))
    return 0 if report['result'] == 'simulation_ok' else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--simular', action='store_true')
    mode.add_argument('--mantenimiento', action='store_true')
    mode.add_argument('--detener', action='store_true')
    parser.add_argument('--seconds', type=int, default=150)
    args = parser.parse_args()
    try:
        verify_package()
        if args.detener:
            request_stop()
            return 0
        if args.mantenimiento:
            if not 5 <= args.seconds <= 180:
                raise ValueError('Plazo permitido5..180s.')
            return manual(args.seconds)
        return simulate()
    except (Exception, KeyboardInterrupt) as exc:
        print('ENSAYO INTERRUMPIDO: ' + type(exc).__name__ + '. Conservar evidencia, no compartir secretos.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
