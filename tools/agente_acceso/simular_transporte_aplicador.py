"""Prueba el transporte entre procesos; DLL/SDK/API/MDB siempre ficticios."""
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
from transporte_aplicador import verify_package

ROOT=Path(__file__).resolve().parent


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--python32',type=Path)
    args=parser.parse_args();verify_package();python=str(args.python32 or sys.executable)
    probe=subprocess.run([python,'-B','-c','import struct; print(struct.calcsize("P")*8)'],capture_output=True,text=True,timeout=15,
        env={k:v for k,v in os.environ.items() if not k.upper().startswith('SANISIDRO_')},
        creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    if probe.returncode or probe.stdout.strip() not in ('32','64') or (args.python32 and probe.stdout.strip()!='32'):
        print('Arquitectura del hijo no confirmada.');return 1
    print('Probando procesos Python reales y DPAPI nativa, con SDK/API/MDB ficticios.',flush=True)
    print('Sin DLL, C3, credenciales instaladas ni cambios de tareas.',flush=True)
    previous={name:os.environ.get(name) for name in ('SI_TEST_CHILD_PYTHON','SI_TEST_CHILD_BITS')}
    os.environ['SI_TEST_CHILD_PYTHON']=python;os.environ['SI_TEST_CHILD_BITS']=probe.stdout.strip()
    try:
        suite=unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern='test_transporte_aplicador.py')
        log=io.StringIO();result=unittest.TextTestRunner(stream=log,verbosity=2).run(suite)
    finally:
        for name,value in previous.items():
            if value is None: os.environ.pop(name,None)
            else: os.environ[name]=value
    success=result.wasSuccessful() and result.testsRun==21 and not result.skipped
    folder=ROOT/'registros';folder.mkdir(exist_ok=True);name='transporte_simulado_'+dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    report={'result':'simulation_ok' if success else 'simulation_failed','scope':'procesos_y_dpapi_reales_sdk_api_mdb_ficticios',
            'parent_bits':struct.calcsize('P')*8,'child_bits':int(probe.stdout.strip()),
            'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),
            'ended_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'evidence':str(folder/(name+'.json'))}
    (folder/(name+'.txt')).write_text(log.getvalue(),encoding='utf-8');(folder/(name+'.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2));return 0 if success else 1


if __name__=='__main__': raise SystemExit(main())
