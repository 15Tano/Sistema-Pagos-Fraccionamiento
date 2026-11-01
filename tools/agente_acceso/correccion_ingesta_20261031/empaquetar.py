"""Release opt-in sobre Almacén-3, con delta exacto y actualización reversible."""
import hashlib
import json
from pathlib import Path
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BASE = ROOT/'Lecturas_Correccion_Almacen_2026.10.31-3.zip'
BASE_SHA = '22647c03b7e89c464448b24eaa1df5153a23beb84bf16ec9b7ab44e0eeb3a889'
OLD = '3d16ee4ff08a2844aaddfb8abcafae3795978e1d2e0054ee3a03ff3e7ef903e4'
RELEASE = '2026.10.31-4a'
ADDITIONS = {'ingesta_resumida.py', 'actualizar_ingesta.py', 'LEEME_INGESTA_RESUMIDA.md',
             'tests/test_ingesta_resumida.py', 'tests/test_correccion_ingesta.py'}


def sha(raw): return hashlib.sha256(raw).hexdigest()


def once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('Ancla del release distinta: '+str(before)[:70])
    return text.replace(before, after)


def entries():
    if sha(BASE.read_bytes()) != BASE_SHA:
        raise ValueError('ZIP instalado de referencia distinto.')
    with zipfile.ZipFile(BASE) as archive:
        if archive.testzip() is not None:
            raise ValueError('CRC base distinto.')
        files = {name: archive.read(name) for name in archive.namelist()}
    if sha(files.pop('OPERATIVA_SHA256SUMS.json')) != OLD:
        raise ValueError('Manifiesto base distinto.')
    # Solo estas fuentes reutilizables se sustituyen; el runner se parchea sobre
    # los bytes reales del release3, conservando correcciones previas de Dell.
    changed = ['sdk_operativo.py', 'servicio_integrado.py', 'emisor.py', 'tests/sdk_operativo_ficticio.py']
    for name in changed:
        files[name] = (ROOT/name).read_bytes()
    value = files['runner_produccion.py']
    value = once(value, b'from almacen_operativo import Originals,HotOutbox,Archives',
        b'from almacen_operativo import Originals,Archives\nfrom ingesta_resumida import SummaryOutbox as HotOutbox, MaintenanceService as LatencyService')
    value = once(value, b'from servicio_latencia import LatencyService\n', b'')
    files['runner_produccion.py'] = once(value, b"version='produccion-r2-2026.10.31-3'", f"version='produccion-r2-{RELEASE}'".encode())
    files['produccion_worker.py'] = once(files['produccion_worker.py'],
        b'diag=sdk.diagnostic(args.worker,args.sha256))', b'diag=sdk.diagnostic(args.worker,args.sha256),summarize_status=True)')
    value = once(files['produccion_emisor.py'], b'from emisor import HttpTransport,Sender',
        b'from emisor import HttpTransport\nfrom ingesta_resumida import ResilientSender as Sender, MaintainingSender')
    files['produccion_emisor.py'] = once(value, b'sender=ArchivingSender(Sender(box,transport),box,archives)',
        b'sender=MaintainingSender(ArchivingSender(Sender(box,transport),box,archives),archives,box)')
    files['produccion_paquete.py'] = once(files['produccion_paquete.py'], b"RELEASE='2026.10.31-3'", f"RELEASE='{RELEASE}'".encode())
    changed += ['runner_produccion.py', 'produccion_worker.py', 'produccion_emisor.py', 'produccion_paquete.py']
    files['ingesta_resumida.py'] = (ROOT/'ingesta_resumida.py').read_bytes()
    files['tests/test_ingesta_resumida.py'] = (ROOT/'tests/test_ingesta_resumida.py').read_bytes()
    files['LEEME_INGESTA_RESUMIDA.md'] = (HERE/'LEEME_INGESTA_RESUMIDA.md').read_bytes()

    source = files['actualizar_almacen.py'].decode('utf-8')
    source = once(source, "OLD = '3eca5b039d106d5dbe383074b940d321fbe438b5a38a9964569a9316200e1a6e'", f'OLD = {OLD!r}')
    source = once(source, "BASE_ZIP_SHA = 'e130384297c7c4ea859c2d5a157fea0ed3d9d4732b994fc9bc3930605ea3a812'", f'BASE_ZIP_SHA = {BASE_SHA!r}')
    source = once(source, "RELEASE = '2026.10.31-3'", f'RELEASE = {RELEASE!r}')
    if source.count("OLD, '2026.10.30-2'") != 2:
        raise ValueError('Referencias de actualización/reversión distintas.')
    source = source.replace("OLD, '2026.10.30-2'", "OLD, '2026.10.31-3'")
    start = source.index('ADDITIONS = ')
    end = source.index('\n\n\ndef sha', start)
    expected = {name: sha(files[name]) for name in changed}
    additions_literal = '{' + ', '.join(repr(name) for name in sorted(ADDITIONS)) + '}'
    source = source[:start] + f'ADDITIONS = {additions_literal}\nALLOWED_DELTA_HASHES = {expected!r}' + source[end:]
    source = once(source, 'import sesion_operativa as ownership', 'import sesion_operativa as ownership\nfrom ingesta_resumida import backend_ready')
    source = once(source, '    def plan(self):\n        self.guard()', '    def plan(self):\n        self.guard()\n        backend_ready(self.root)')
    source = once(source, "'scan_policy': 'windows_scandir', 'cross_call_size_cache': False,",
        "'scan_policy': 'windows_scandir', 'cross_call_size_cache': False,\n            'backend_policy': 'summary-v1', 'retry_window_days': 7, 'local_ack_days': 7,\n            'health_interval_seconds': 30, 'status_policy': 'counter_snapshot',")
    source = source.replace('storage_scan', 'source_summary').replace('storage_update', 'source_update')
    source = source.replace('actualizaciones_almacen', 'actualizaciones_ingesta').replace('previous_storage_release', 'previous_source_release')
    source = source.replace('Actualizar solo el recorrido de archivos', 'Actualizar ingesta y conservación automática')
    files['actualizar_ingesta.py'] = source.encode('utf-8')

    tests = files['tests/test_correccion_almacen.py'].decode('utf-8')
    tests = tests.replace('import actualizar_almacen as app', 'import actualizar_ingesta as app')
    tests = tests.replace('SI_STORAGE_BASE_ZIP', 'SI_SUMMARY_BASE_ZIP').replace('pruebas_correccion_almacen', 'pruebas_correccion_ingesta')
    tests = tests.replace('storage_update', 'source_update').replace('actualizaciones_almacen', 'actualizaciones_ingesta')
    tests = once(tests, '    def setUp(self):\n', "    def setUp(self):\n        remote = patch.object(app, 'backend_ready', return_value={'storage_policy': 'summary-v1'})\n        remote.start()\n        self.addCleanup(remote.stop)\n")
    tests = once(tests, "        self.assertEqual('windows_scandir', plan['scan_policy'])",
        "        self.assertEqual('windows_scandir', plan['scan_policy'])\n        self.assertEqual('summary-v1', plan['backend_policy'])\n        self.assertEqual(30, plan['health_interval_seconds'])")
    files['tests/test_correccion_ingesta.py'] = tests.encode('utf-8')
    value = {'release': RELEASE, 'scope': 'production_r2_reference', 'base': {'name': BASE.name, 'sha256': BASE_SHA},
        'changed_base_sources': changed, 'files': [{'name': name, 'sha256': sha(raw)} for name, raw in sorted(files.items())]}
    files['OPERATIVA_SHA256SUMS.json'] = (json.dumps(value, indent=2)+'\n').encode()
    return files


def write(path):
    files = entries()
    with zipfile.ZipFile(path, 'x', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, raw in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 31, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            archive.writestr(info, raw)
    return {'file': str(path), 'files': len(files), 'bytes': path.stat().st_size,
        'sha256': sha(path.read_bytes()), 'manifest_sha256': sha(files['OPERATIVA_SHA256SUMS.json'])}


if __name__ == '__main__':
    print(json.dumps(write(ROOT/f'Lecturas_Ingesta_Resumida_{RELEASE}.zip'), indent=2))
