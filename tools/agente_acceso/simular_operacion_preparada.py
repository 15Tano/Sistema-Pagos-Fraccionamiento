"""Una simulacion consolidada de preparacion: solo directorios/procesos ficticios."""
import argparse
import datetime as dt
import io
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import unittest

ROOT=Path(__file__).resolve().parent
PATTERNS=('test_sesion_operativa.py','test_almacen_operativo.py','test_archivo_cierres.py',
    'test_instalacion_operativa.py','test_vigilancia_operativa.py','test_guardias_operativas.py','test_sdk_operativo.py')


def main(python32=None):
    if os.name!='nt' or struct.calcsize('P')!=8:raise RuntimeError('Usar Python64 Windows.')
    child=str(python32 or sys.executable)
    environment={k:v for k,v in os.environ.items() if not k.upper().startswith('SANISIDRO_')}
    probe=subprocess.run([child,'-B','-c','import struct;print(struct.calcsize("P")*8)'],capture_output=True,
        text=True,timeout=15,env=environment,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    bits=probe.stdout.strip()
    if probe.returncode or bits not in ('32','64') or (python32 and bits!='32'):raise RuntimeError('Hijo no confirmado.')
    previous={key:os.environ.get(key) for key in ('SI_TEST_CHILD_PYTHON','SI_TEST_CHILD_BITS')}
    os.environ['SI_TEST_CHILD_PYTHON']=child;os.environ['SI_TEST_CHILD_BITS']=bits
    print('Probando preparacion reversible y 2400 buffers ficticios. Sin DLL, red, datos instalados ni tareas.',flush=True)
    suite=unittest.TestSuite()
    for pattern in PATTERNS:suite.addTests(unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern=pattern))
    log=io.StringIO()
    try:result=unittest.TextTestRunner(stream=log,verbosity=2).run(suite)
    finally:
        for key,value in previous.items():
            if value is None:os.environ.pop(key,None)
            else:os.environ[key]=value
    capacity=None
    if result.wasSuccessful() and not result.skipped:
        from ensayo_capacidad_operativa import run
        capacity=run()
    success=result.wasSuccessful() and result.testsRun>=65 and not result.skipped and capacity is not None
    folder=ROOT/'registros';folder.mkdir(exist_ok=True)
    name='preparacion_simulada_'+dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    report={'result':'simulation_ok' if success else 'simulation_failed',
        'scope':'preparacion_local_sdk_api_tareas_ficticios_sqlite_dpapi_procesos_reales',
        'parent_bits':64,'child_bits':int(bits),'tests':result.testsRun,'failures':len(result.failures),
        'errors':len(result.errors),'skipped':len(result.skipped),'capacity':capacity,
        'ended_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'evidence':str(folder/(name+'.json'))}
    (folder/(name+'.txt')).write_text(log.getvalue(),encoding='utf-8')
    (folder/(name+'.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2));return 0 if success else 1


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--python32',type=Path)
    args=parser.parse_args();raise SystemExit(main(args.python32))
