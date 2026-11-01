"""Microbenchmark Windows en archivos ficticios; no usa ni modifica datos Dell."""
import json
from pathlib import Path
import platform
import statistics
import sys
import tempfile
import time

REPO=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(REPO/'tools'/'agente_acceso'))
from almacen_operativo import directory_usage


def main():
    area=REPO/'output'/'escaneo-archivos-20261031';area.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=area) as temporary:
        root=Path(temporary).resolve()
        assert root.is_relative_to(area.resolve())
        count=20000
        for n in range(count):
            (root/f'{n:06d}.fixture').write_bytes(b'fixture')
        samples={'before':[],'after':[]}
        for iteration in range(5):
            # Alternar orden para reducir el sesgo de cache del sistema operativo.
            for name in (('before','after') if iteration%2==0 else ('after','before')):
                started=time.perf_counter()
                value=(sum(p.stat().st_size for p in root.iterdir() if p.is_file())
                    if name=='before' else directory_usage(root))
                samples[name].append(time.perf_counter()-started)
                assert value==count*7
    medians={k:statistics.median(v) for k,v in samples.items()}
    result={'scope':'local_synthetic_files_not_dell', 'platform':platform.platform(),
        'python':platform.python_version(),'files':count,'equal_total_bytes':count*7,
        'seconds':samples,'median_seconds':medians,'speedup':medians['before']/medians['after'],
        'physical_reading_latency_measured':False,'production_changed':False}
    (area/'resultado.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))


if __name__=='__main__': main()
