"""Simular aplicador/preparador sin DLL, servicios o aprobaciones reales."""
import datetime as dt
import io
import json
from pathlib import Path
import unittest
from preparar_aplicacion import verify_package

ROOT=Path(__file__).resolve().parent


def main():
    verify_package()
    print('Simulando aplicador y preparacion con servicios ficticios. Sin SDK, red, DPAPI, Access ni tareas reales.',flush=True)
    log=io.StringIO();suite=unittest.TestSuite()
    for name in ('test_aplicacion_vigencias.py','test_preparacion_aplicacion.py'):
        suite.addTests(unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern=name))
    result=unittest.TextTestRunner(stream=log,verbosity=2).run(suite)
    folder=ROOT/'registros';folder.mkdir(exist_ok=True)
    name='simulacion_aplicador_'+dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    report={'result':'simulation_ok' if result.wasSuccessful() and result.testsRun==38 and not result.skipped else 'simulation_failed',
            'scope':'aplicador_y_preparacion_ficticios_sin_sdk_red_dpapi_access_tareas_reales',
            'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),
            'ended_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'evidence':str(folder/(name+'.json'))}
    (folder/(name+'.txt')).write_text(log.getvalue(),encoding='utf-8')
    (folder/(name+'.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2));return 0 if report['result']=='simulation_ok' else 1


if __name__=='__main__': raise SystemExit(main())
