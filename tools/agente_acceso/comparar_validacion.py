"""Comparar837 planes ficticios con la publicacion anterior; sin SDK ni red."""
import hashlib
import json
from pathlib import Path
import time
import types

import aplicacion_vigencias as candidate
import referencia_vigencias as reference

ROOT=Path(__file__).resolve().parent
BASELINE={'referencia_vigencias.py':'8ad86d0110a8e1a6ada78b2e939b5cbcdd6f9839da9fd13f14aa4a6c3e17abe9',
    'aplicacion_vigencias.py':'2ed73096506b7da977239ebb2766a17e28f9fa9e0d5a991f14d055c15ffafc42'}


def baseline():
    modules={}
    for name,digest in BASELINE.items():
        path=ROOT/'baseline_latencia1'/name;raw=path.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=digest:raise ValueError('Baseline de otra publicacion.')
        module=types.ModuleType('_baseline_'+path.stem)
        # La referencia r2 se comparte como solo lectura. El codigo que se
        # ejecuta es el snapshot original verificado de la publicacion1.
        module.__file__=str(ROOT/name)
        exec(compile(raw,str(path),'exec'),module.__dict__)
        modules[name]=module
    planner=modules['aplicacion_vigencias.py']
    planner.load_reference=modules['referencia_vigencias.py'].load_reference
    return planner


def run():
    previous=baseline();cases=[]
    for index in range(837):
        card=str(90000000+index)
        access={'userid':index+1,'card':card,'start':'2020-01-01 00:00:00',
            'end':'2026-10-01 23:59:59' if index%3==0 else '2026-11-05 23:59:59','valid_raw':index%7!=0}
        panel={'CardNo':card,'Pin':str(index+1),'StartTime':'20200101',
            'EndTime':'20261001' if index%5==0 else '20261105'}
        cases.append((card,[{'card_no':card,'expiration':'2026-11-05 23:59:59'}],access,panel))
    start=time.perf_counter();old=[previous.make_plan(*args) for args in cases];old_time=time.perf_counter()-start
    reference._validator.cache_clear();reference._compiled.cache_clear()
    start=time.perf_counter();new=[candidate.make_plan(*args) for args in cases];new_time=time.perf_counter()-start
    if old!=new:raise ValueError('Planes diferentes; no continuar a ensayo real.')
    return {'scope':'837planes_ficticios_sin_sdk_red_mdb_credenciales_tareas','plans':len(cases),
        'identical_plans':True,'original_s':round(old_time,6),'candidate_s':round(new_time,6),
        'plans_sha256':candidate.digest(new),
        'limits':['Una corrida local, no latencia hasta pantalla.',
            'No incluye consulta API, Access, conexion ni inventario C3.',
            'La velocidad no es criterio de aprobacion; si los planes difieren se rechaza.']}


if __name__=='__main__':
    from paquete_latencia import verify_package
    verify_package();print(json.dumps(run(),indent=2))
