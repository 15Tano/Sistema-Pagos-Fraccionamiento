"""Simulacion aislada del binding, planes y cierre; no consulta hardware."""
import datetime as dt
import io
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent


def main():
    print('Simulando puente readonly con SDK/API/Access ficticios. Sin DLL, red, DPAPI ni tareas reales.', flush=True)
    log = io.StringIO()
    suite = unittest.defaultTestLoader.discover(str(ROOT / 'tests'), pattern='test_puente_sdk_readonly.py')
    result = unittest.TextTestRunner(stream=log, verbosity=2).run(suite)
    folder = ROOT / 'registros'
    folder.mkdir(exist_ok=True)
    name = 'simulacion_puente_' + dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    report = {'result': 'simulation_ok' if result.wasSuccessful() and result.testsRun == 23 and not result.skipped else 'simulation_failed',
              'scope': 'puente_readonly_ficticio_sin_sdk_red_dpapi_access_tareas_reales',
              'tests': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
              'skipped': len(result.skipped), 'ended_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
              'evidence': str(folder / (name + '.json'))}
    (folder / (name + '.txt')).write_text(log.getvalue(), encoding='utf-8')
    (folder / (name + '.json')).write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 0 if report['result'] == 'simulation_ok' else 1


if __name__ == '__main__':
    raise SystemExit(main())
