"""Entrada x64 readonly: adapta solo escritura atomica de estado, no SDK."""
import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent


def run_reader(module, writer, seconds):
    module.verify_package()  # Fuentes SDK publicadas verificadas antes de adaptar estado.
    module.atomic_json = writer
    return module.manual(seconds)  # Manual congelado solo expone comparacion apply=False.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mantenimiento', action='store_true', required=True)
    parser.add_argument('--seconds', type=int, default=150)
    args = parser.parse_args()
    try:
        if not 5 <= args.seconds <= 150:
            raise ValueError('Plazo5..150s.')
        from ensayo_conjunto import verify_package, emitter
        verify_package()
        sys.path.insert(0, str(ROOT / 'lector'))
        import ensayo_cierres
        return run_reader(ensayo_cierres, emitter().save, args.seconds)
    except (Exception, KeyboardInterrupt) as exc:
        print('LECTOR CONJUNTO NO CONFIRMADO: ' + type(exc).__name__ + '. Conservar mantenimiento/evidencia.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
