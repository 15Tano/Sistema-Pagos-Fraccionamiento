"""Simulacion del piloto: SDK/API ficticios, procesos/DPAPI/ACE de prueba reales."""
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

from paquete_piloto import ROOT,verify_package


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--python32',type=Path)
    args=parser.parse_args();verify_package()
    if os.name!='nt' or struct.calcsize('P')!=8:raise RuntimeError('Usar Python64 Windows.')
    child=str(args.python32 or sys.executable)
    probe=subprocess.run([child,'-B','-c','import struct;print(struct.calcsize("P")*8)'],capture_output=True,text=True,
        timeout=15,env={key:value for key,value in os.environ.items() if not key.upper().startswith('SANISIDRO_')},
        creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    bits=probe.stdout.strip()
    if probe.returncode or bits not in ('32','64') or (args.python32 and bits!='32'):raise RuntimeError('Hijo no confirmado.')
    old={key:os.environ.get(key) for key in ('SI_TEST_CHILD_PYTHON','SI_TEST_CHILD_BITS')}
    os.environ['SI_TEST_CHILD_PYTHON']=child;os.environ['SI_TEST_CHILD_BITS']=bits
    print('Simulando piloto y cierre con SDK/API/tareas ficticios. Procesos, DPAPI y MDB de prueba; sin caseta.',flush=True)
    suite=unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern='test_piloto_*.py');log=io.StringIO()
    try:result=unittest.TextTestRunner(stream=log,verbosity=2).run(suite)
    finally:
        for key,value in old.items():
            if value is None:os.environ.pop(key,None)
            else:os.environ[key]=value
    success=result.wasSuccessful() and result.testsRun>=30 and not result.skipped
    folder=ROOT/'registros';folder.mkdir(exist_ok=True);name='piloto_simulado_'+dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    report={'result':'simulation_ok' if success else 'simulation_failed','scope':'piloto_ficticio_sin_sdk_red_datos_instalados_tareas',
        'parent_bits':64,'child_bits':int(bits),'tests':result.testsRun,'failures':len(result.failures),
        'errors':len(result.errors),'skipped':len(result.skipped),'ended_utc':dt.datetime.now(dt.timezone.utc).isoformat(),
        'evidence':str(folder/(name+'.json'))}
    (folder/(name+'.txt')).write_text(log.getvalue(),encoding='utf-8');(folder/(name+'.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2));return 0 if success else 1


if __name__=='__main__':raise SystemExit(main())
