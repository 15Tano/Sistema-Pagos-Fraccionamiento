"""Pruebas de union; SDK/API siempre ficticios, ACE opcional sobre otra MDB ficticia."""
import argparse
import datetime as dt
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import struct
import unittest

ROOT=Path(__file__).resolve().parent


def verify_package():
    manifest=json.loads((ROOT/'INTEGRACION_APLICADOR_SHA256SUMS.json').read_text(encoding='utf-8-sig'))
    names=[row['name'] for row in manifest['files']]
    if manifest['release']!='2026.10.25-1' or len(names)!=86 or len(set(names))!=86:
        raise ValueError('Manifiesto inesperado.')
    for row in manifest['files']:
        name=row['name']
        if (not name or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or ':' in name or '\\' in name or
                hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=row['sha256']):
            raise ValueError('Fuente/ruta diferente.')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--comprobar-ace',action='store_true')
    args=parser.parse_args();verify_package();native=args.comprobar_ace
    if native and struct.calcsize('P')!=8:
        print('Usar Python64 con ACE instalado.');return 1
    print('Ensayando conciliacion en MDB ficticia separada con ACE/DPAPI nativos.' if native else 'Simulando union MDB/perfil/aplicador con servicios ficticios.',flush=True)
    print('Sin C3, API, MDB instalada, credenciales reales ni cambios de tareas.',flush=True)
    pattern='test_aplicador_integrado_ace.py' if native else 'test_aplicador_integrado.py'
    suite=unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern=pattern)
    log=io.StringIO();result=unittest.TextTestRunner(stream=log,verbosity=2).run(suite)
    success=result.wasSuccessful() and result.testsRun==(1 if native else 25) and not result.skipped
    folder=ROOT/'registros';folder.mkdir(exist_ok=True)
    name=('conciliacion_ace_' if native else 'integracion_simulada_')+dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    report={'result':('lab_reconciliation_ok' if native else 'simulation_ok') if success else 'verification_failed',
            'scope':'mdb_y_dpapi_nativos_en_copia_ficticia_sdk_api_ficticios' if native else 'union_ficticia_sin_sdk_red_ace_dpapi_reales_tareas',
            'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),
            'ended_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'evidence':str(folder/(name+'.json'))}
    (folder/(name+'.txt')).write_text(log.getvalue(),encoding='utf-8')
    (folder/(name+'.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2));return 0 if success else 1


if __name__=='__main__': raise SystemExit(main())
