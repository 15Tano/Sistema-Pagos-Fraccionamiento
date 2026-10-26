"""Controles ficticios del respaldo real y prueba del lanzador con DPAPI ficticia."""
import datetime as dt
import io
import json
from pathlib import Path
import unittest
from respaldo_real_mdb import verify_package

ROOT=Path(__file__).resolve().parent


def main():
    verify_package()
    print('Probando controles con servicios ficticios y lanzador con credencial DPAPI ficticia.',flush=True)
    print('Sin SDK, API, MDB instalada, credenciales reales ni cambios de tareas.',flush=True)
    suite=unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern='test_respaldo_real_mdb.py')
    log=io.StringIO();result=unittest.TextTestRunner(stream=log,verbosity=2).run(suite)
    success=result.wasSuccessful() and result.testsRun==32 and not result.skipped
    folder=ROOT/'registros';folder.mkdir(exist_ok=True)
    name='simulacion_respaldo_real_'+dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    report={'result':'simulation_ok' if success else 'simulation_failed',
            'scope':'controles_ficticios_y_lanzador_dpapi_ficticia_sin_sdk_red_mdb_instalada_tareas',
            'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),
            'ended_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'evidence':str(folder/(name+'.json'))}
    (folder/(name+'.txt')).write_text(log.getvalue(),encoding='utf-8')
    (folder/(name+'.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2));return 0 if success else 1


if __name__=='__main__': raise SystemExit(main())
