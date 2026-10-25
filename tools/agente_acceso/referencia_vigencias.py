"""Copia r2 verificada; solo se expone cycle(password, False, None)."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent / 'referencia_r2'
EXPECTED = {
    'sincronizar_vigencias.py': '581dfa4cd428830321e3aa879812d9d8bdc09c785b3497bb97cc39b689915e35',
    'sync_runtime.py': 'adf6ded72c3f87133636a342b4d284376755fb43748679fbbb4468e5ccbfa666',
    'c3_worker.py': '3cfb31a51fd2124d478dea434623753dd02652120eb981d8b27f8a4c571eef4c',
    'c3_panel.py': 'e3c4915c38979477e94ab55de369766446dc4e8de896b49913d298904e3dd6ed',
}


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_reference():
    source = json.loads((ROOT / 'FUENTE.json').read_text(encoding='utf-8-sig'))
    if source['release'] != '2026.10.14-r2' or source['files'] != EXPECTED:
        raise ValueError('Referencia r2 no coincide con la version preparada.')
    for name, digest in EXPECTED.items():
        if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != digest:
            raise ValueError('Fuente r2 modificada: ' + name)
    runtime = load_module('_coordinador_runtime_r2', ROOT / 'sync_runtime.py')
    previous = sys.modules.get('sync_runtime')
    try:
        sys.modules['sync_runtime'] = runtime
        return load_module('_coordinador_ciclo_r2', ROOT / 'sincronizar_vigencias.py')
    finally:
        if previous is None:
            sys.modules.pop('sync_runtime', None)
        else:
            sys.modules['sync_runtime'] = previous


class ReferenceProbe:
    def __init__(self, password):
        self.module = load_reference()
        self.password = password
        (ROOT / 'registros').mkdir(exist_ok=True)

    def __call__(self):
        # No hay argumento de escritura configurable en el coordinador de ensayo.
        self.module.cycle(self.password, False, None)
