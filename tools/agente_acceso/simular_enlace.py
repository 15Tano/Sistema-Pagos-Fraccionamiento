"""Validar control candidato sobre fixtures; no consulta SDK/tareas/Access/red."""
import datetime as dt
import io
import json
import os
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent


def main():
    try:
        if os.name != 'nt' or any(ROOT.is_relative_to(Path(path).resolve()) for path in (
                r'C:\SanIsidro\ZKSync', r'C:\SanIsidro\GestionTags')):
            raise RuntimeError('Usar Windows en carpeta separada.')
        from enlace_candidato import verify_package
        verify_package()
        print('Simulando controles con tareas y procesos ficticios. Sin SDK, red, Access ni tareas reales.', flush=True)
        log = io.StringIO()
        suite = unittest.defaultTestLoader.discover(str(ROOT / 'tests'), pattern='test_enlace_candidato.py')
        result = unittest.TextTestRunner(stream=log, verbosity=2).run(suite)
        folder = ROOT / 'registros'
        folder.mkdir(exist_ok=True)
        name = 'simulacion_enlace_' + dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        (folder / (name + '.txt')).write_text(log.getvalue(), encoding='utf-8')
        success = result.wasSuccessful() and result.testsRun == 41 and not result.skipped
        report = {'result': 'simulation_ok' if success else 'simulation_failed',
            'scope': 'controles_ficticios_sin_sdk_red_access_tareas_reales',
            'tests': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
            'skipped': len(result.skipped), 'powershell_checks_included': 14 if success else None,
            'ended_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
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
