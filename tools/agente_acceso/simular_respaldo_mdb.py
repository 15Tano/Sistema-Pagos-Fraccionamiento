"""Aceptacion MDB solo con fuentes ficticias; sin SDK o credenciales instaladas."""
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
    manifest=json.loads((ROOT/'RESPALDO_MDB_SHA256SUMS.json').read_text(encoding='utf-8-sig'))
    names=[row['name'] for row in manifest['files']]
    if manifest['release']!='2026.10.25-1' or len(names)!=72 or len(set(names))!=72:
        raise ValueError('Manifiesto inesperado.')
    for row in manifest['files']:
        name=row['name']
        if (not name or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or ':' in name or '\\' in name or
                hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=row['sha256']):
            raise ValueError('Fuente/ruta diferente.')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--comprobar-ace',action='store_true',help='ACE/Win32/ACL reales, exclusivamente sobre MDB ficticios propios.')
    args=parser.parse_args();verify_package();native=args.comprobar_ace
    if native and struct.calcsize('P')!=8:
        print('Usar Python de 64 bits con el controlador Access ya instalado. Consulte LEEME_RESPALDO_MDB.md.')
        return 1
    print('Comprobando ACE/Win32/ACL nativos con MDB ficticios.' if native else 'Simulando copia/validacion MDB con servicios ficticios.',flush=True)
    print('Sin C3, API, MDB de caseta, credenciales instaladas ni cambios de tareas.',flush=True)
    pattern='test_respaldo_mdb_ace.py' if native else 'test_respaldo_mdb.py'
    suite=unittest.defaultTestLoader.discover(str(ROOT/'tests'),pattern=pattern)
    log=io.StringIO();result=unittest.TextTestRunner(stream=log,verbosity=2).run(suite)
    success=result.wasSuccessful() and result.testsRun==(7 if native else 18) and not result.skipped
    folder=ROOT/'registros';folder.mkdir(exist_ok=True)
    name=('ace_mdb_' if native else 'simulacion_mdb_')+dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    report={'result':('ace_ok' if native else 'simulation_ok') if success else 'verification_failed',
            'scope':'ace_win32_acl_nativos_mdb_ficticios' if native else 'copia_mdb_ficticia_sin_sdk_red_ace_credenciales_tareas',
            'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),
            'ended_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'evidence':str(folder/(name+'.json'))}
    (folder/(name+'.txt')).write_text(log.getvalue(),encoding='utf-8')
    (folder/(name+'.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2));return 0 if success else 1


if __name__=='__main__': raise SystemExit(main())
