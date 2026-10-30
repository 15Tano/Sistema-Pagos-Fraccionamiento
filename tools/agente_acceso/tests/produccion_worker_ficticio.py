"""Solo pruebas: recibos/DPAPI/procesos reales con Panel ficticio, sin DLL o red."""
import argparse
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import produccion_r2 as production
import sesion_operativa as owner
from test_produccion_r2 import panel_fixture

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--worker',type=Path,required=True);p.add_argument('--sha256',required=True);a=p.parse_args()
    # Nunca aceptar raiz de caseta ni una carpeta fuera del area de pruebas.
    allowed=(ROOT/'datos'/'pruebas_produccion').resolve()
    if not a.root.resolve().is_relative_to(allowed): raise SystemExit(1)
    rows=[{'CardNo':'99000177','Pin':'123','Password':'fixture','Group':'0','StartTime':'20200101','EndTime':'20261105','SuperAuthorize':'0'}]
    panel,_,_=panel_fixture(rows)
    raise SystemExit(production.execute_worker(a.worker,a.sha256,panel_factory=panel,
        guard=lambda:owner.checked_worker(a.worker,a.sha256,root=a.root)))
