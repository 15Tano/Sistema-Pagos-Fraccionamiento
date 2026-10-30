"""Validacion consolidada: procesos/SQLite/DPAPI reales, SDK/HTTP ficticios."""
import argparse
import contextlib
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
PATTERNS=('test_latencia_candidata.py','test_latencia_procesos.py','test_latencia_dell.py',
    'test_servicio_integrado.py','test_sesion_operativa.py','test_sdk_operativo.py',
    'test_referencia_rapida.py')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--python32',type=Path)
    args=parser.parse_args()
    from paquete_latencia import verify_package
    verify_package()
    if os.name!='nt' or struct.calcsize('P')!=8:raise RuntimeError('Usar Python64 Windows.')
    child=str(args.python32 or sys.executable)
    environment={k:v for k,v in os.environ.items() if not k.upper().startswith('SANISIDRO_')}
    probe=subprocess.run([child,'-B','-c','import struct;print(struct.calcsize("P")*8)'],
        capture_output=True,text=True,timeout=15,env=environment,
        creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    bits=probe.stdout.strip()
    if probe.returncode or bits not in ('32','64') or (args.python32 and bits!='32'):
        raise RuntimeError('Arquitectura del hijo no confirmada.')
    previous={key:os.environ.get(key) for key in ('SI_TEST_CHILD_PYTHON','SI_TEST_CHILD_BITS')}
    os.environ['SI_TEST_CHILD_PYTHON']=child;os.environ['SI_TEST_CHILD_BITS']=bits
    print('Probando candidato con procesos, SQLite y DPAPI de prueba. SDK/API ficticios.',flush=True)
    print('Sin DLL, red, MDB instalada, credenciales reales ni cambios de tareas.',flush=True)
    suite=unittest.TestSuite()
    for pattern in PATTERNS:suite.addTests(unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern=pattern))
    log=io.StringIO()
    try:
        with contextlib.redirect_stdout(log):
            result=unittest.TextTestRunner(stream=log,verbosity=2).run(suite)
    finally:
        for key,value in previous.items():
            if value is None:os.environ.pop(key,None)
            else:os.environ[key]=value
    success=result.wasSuccessful() and result.testsRun>=86 and not result.skipped
    comparison=None
    if success:
        print('Comparando837 planes ficticios con el candidato anterior; sin consultar servicios.',flush=True)
        from comparar_validacion import run
        comparison=run()
    folder=ROOT/'registros';folder.mkdir(exist_ok=True)
    name='latencia_simulada_'+dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    report={'result':'simulation_ok' if success else 'simulation_failed',
        'scope':'candidato_ficticio_sin_sdk_red_mdb_instalada_tareas',
        'parent_bits':64,'child_bits':int(bits),'tests':result.testsRun,
        'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),
        'comparison':comparison,
        'ended_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'evidence':str(folder/(name+'.json'))}
    (folder/(name+'.txt')).write_text(log.getvalue(),encoding='utf-8')
    (folder/(name+'.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))
    return 0 if success else 1


if __name__=='__main__':raise SystemExit(main())
