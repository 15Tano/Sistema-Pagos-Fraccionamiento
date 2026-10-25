"""Ensayar orden/parada conjunta con procesos y datos ficticios."""
import datetime as dt
import io
import json
import os
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent


def main():
    try:
        if os.name != 'nt' or any(ROOT.is_relative_to(Path(p).resolve()) for p in (r'C:\SanIsidro\ZKSync', r'C:\SanIsidro\GestionTags')):
            raise RuntimeError('Usar Windows y carpeta separada.')
        from ensayo_conjunto import verify_package
        verify_package()
        print('Simulando lectura/envio conjuntos con procesos ficticios. Sin SDK, red, DPAPI, Access ni tareas reales.', flush=True)
        log = io.StringIO()
        suite = unittest.defaultTestLoader.discover(str(ROOT / 'tests'), pattern='test_conjunto.py')
        result = unittest.TextTestRunner(stream=log, verbosity=2).run(suite)
        folder = ROOT / 'registros'
        folder.mkdir(exist_ok=True)
        name = 'simulacion_conjunto_' + dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        (folder / (name + '.txt')).write_text(log.getvalue(), encoding='utf-8')
        success = result.wasSuccessful() and result.testsRun == 30 and not result.skipped
        report = {'result': 'simulation_ok' if success else 'simulation_failed',
            'scope': 'conjunto_ficticio_sin_sdk_red_dpapi_access_tareas_reales',
            'tests': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
            'skipped': len(result.skipped), 'ended_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
            'evidence': str(folder / (name + '.json'))}
        with (folder / (name + '.json')).open('x', encoding='utf-8') as stream:
            json.dump(report, stream, indent=2)
        print(json.dumps(report, indent=2))
        return 0 if success else 1
    except Exception as exc:
        print('SIMULACION INTERRUMPIDA: ' + type(exc).__name__ + '. Conservar evidencia.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
