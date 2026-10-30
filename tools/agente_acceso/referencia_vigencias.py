"""Referencia r2 verificada; validador reutilizable y adaptadores aislados."""
import hashlib
import importlib.util
import json
from functools import lru_cache
from pathlib import Path
import sys
import threading

ROOT = Path(__file__).resolve().parent / 'referencia_r2'
EXPECTED = {
    'sincronizar_vigencias.py': '581dfa4cd428830321e3aa879812d9d8bdc09c785b3497bb97cc39b689915e35',
    'sync_runtime.py': 'adf6ded72c3f87133636a342b4d284376755fb43748679fbbb4468e5ccbfa666',
    'c3_worker.py': '3cfb31a51fd2124d478dea434623753dd02652120eb981d8b27f8a4c571eef4c',
    'c3_panel.py': 'e3c4915c38979477e94ab55de369766446dc4e8de896b49913d298904e3dd6ed',
}
_MODULE_LOCK = threading.RLock()


@lru_cache(maxsize=4)
def _compiled(path, source):
    # Solo codigo, nunca respuestas API ni el estado mutable de un adaptador.
    return compile(source, path, 'exec')


def load_module(name, path, source=None):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    raw = path.read_bytes() if source is None else source
    exec(_compiled(str(path), raw), module.__dict__)
    return module


def _verified_sources():
    source = json.loads((ROOT / 'FUENTE.json').read_text(encoding='utf-8-sig'))
    if source['release'] != '2026.10.14-r2' or source['files'] != EXPECTED:
        raise ValueError('Referencia r2 no coincide con la version preparada.')
    sources = {}
    for name, digest in EXPECTED.items():
        raw = (ROOT / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != digest:
            raise ValueError('Fuente r2 modificada: ' + name)
        sources[name] = raw
    return sources


def _instantiate(root, runtime_source, cycle_source):
    # El registro temporal de imports es compartido entre hilos. Cada llamador
    # recibe modulos nuevos y ejecuta exactamente los bytes ya verificados.
    with _MODULE_LOCK:
        runtime = load_module('_coordinador_runtime_r2', root / 'sync_runtime.py', runtime_source)
        previous = sys.modules.get('sync_runtime')
        try:
            sys.modules['sync_runtime'] = runtime
            return load_module('_coordinador_ciclo_r2', root / 'sincronizar_vigencias.py', cycle_source)
        finally:
            if previous is None:
                sys.modules.pop('sync_runtime', None)
            else:
                sys.modules['sync_runtime'] = previous


def load_reference():
    sources = _verified_sources()
    return _instantiate(ROOT, sources['sync_runtime.py'], sources['sincronizar_vigencias.py'])


@lru_cache(maxsize=1)
def _validator(root, runtime_source, cycle_source):
    # Este modulo privado no se entrega a ReferenceProbe ni a adaptadores que
    # modifican worker/ROOT. El validador r2 es puro y crea un dict nuevo por llamada.
    return _instantiate(root, runtime_source, cycle_source).validate_api


def validate_api(rows):
    sources = _verified_sources()  # Tambien despues de calentar las caches.
    return _validator(ROOT, sources['sync_runtime.py'], sources['sincronizar_vigencias.py'])(rows)


class ReferenceProbe:
    def __init__(self, password):
        self.module = load_reference()
        self.password = password
        (ROOT / 'registros').mkdir(exist_ok=True)

    def __call__(self):
        # No hay argumento de escritura configurable en el coordinador de ensayo.
        self.module.cycle(self.password, False, None)
