"""Aceptacion local del respaldo: fixtures, sin SDK, red, Access ni tareas."""
import argparse
import datetime as dt
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import unittest

ROOT=Path(__file__).resolve().parent


def verify_package():
    manifest=json.loads((ROOT/'RESPALDO_SHA256SUMS.json').read_text(encoding='utf-8-sig'))
    names=[row['name'] for row in manifest['files']]
    if manifest['release']!='2026.10.25-1' or len(names)!=64 or len(set(names))!=64:
        raise ValueError('Manifiesto inesperado.')
    for row in manifest['files']:
        name=row['name']
        if (not name or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or
                ':' in name or '\\' in name or hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=row['sha256']):
            raise ValueError('Fuente/ruta diferente.')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--comprobar-dpapi',action='store_true',help='DPAPI nativa con datos ficticios del usuario actual.')
    args=parser.parse_args();verify_package()
    native=args.comprobar_dpapi
    print('Comprobando DPAPI nativa con datos ficticios.' if native else 'Simulando respaldo/recuperacion con cifrado y SDK ficticios.',flush=True)
    print('Sin C3, red, MDB, credenciales reales ni cambios de tareas.',flush=True)
    pattern='test_respaldo_dpapi.py' if native else 'test_respaldo_protegido.py'
    suite=unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern=pattern)
    log=io.StringIO();result=unittest.TextTestRunner(stream=log,verbosity=2).run(suite)
    success=result.wasSuccessful() and result.testsRun==(3 if native else 31) and not result.skipped
    folder=ROOT/'registros';folder.mkdir(exist_ok=True)
    name=('dpapi_respaldo_' if native else 'simulacion_respaldo_')+dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    report={'result':('dpapi_ok' if native else 'simulation_ok') if success else 'verification_failed',
            'scope':'dpapi_nativa_datos_ficticios' if native else 'respaldo_y_revision_ficticios_sin_sdk_red_dpapi_access_tareas',
            'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),
            'ended_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'evidence':str(folder/(name+'.json'))}
    (folder/(name+'.txt')).write_text(log.getvalue(),encoding='utf-8')
    (folder/(name+'.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2));return 0 if success else 1


if __name__=='__main__': raise SystemExit(main())
