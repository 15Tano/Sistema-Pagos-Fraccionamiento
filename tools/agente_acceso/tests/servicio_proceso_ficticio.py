"""Hijos de pruebas. SQLite/DPAPI reales; transporte SDK/HTTP siempre ficticio."""
import argparse
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    if '--sdk' in sys.argv:
        sys.argv.remove('--sdk')
        import sdk_proceso_ficticio as fixture
        import respaldo_ciclo as checkpoint
        original = fixture.transport.worker
        def dispatch(folder, digest, diagnostic=None):
            _, operation = fixture.transport.read_operation(folder, digest)
            if operation['mode'] == 'apply':
                return checkpoint.worker(folder, digest, diagnostic)
            return original(folder, digest, diagnostic)
        fixture.transport.worker = dispatch
        return fixture.main()
    parser = argparse.ArgumentParser()
    parser.add_argument('--sender', type=Path, required=True)
    parser.add_argument('--fault', choices=('missing', 'foreign', 'hang', 'network'))
    args = parser.parse_args()
    import emisor_servicio as emitter
    from emisor import Sender
    from outbox import Outbox
    import test_agente as fixture
    request = emitter.read(args.sender/'request.json')
    identity = {'protocol':1, 'pid':os.getpid(), 'run_id':request['run_id']}
    stop = emitter.parent_channel(sys.stdin)
    box = Outbox(Path(request['base'])/'outbox.sqlite')
    transport = fixture.FakeTransport()
    if args.fault == 'network':
        def offline(*_):
            raise OSError('fixture offline')
        transport.send = offline
    try:
        def publish(value):
            emitter.save(args.sender/'sender.json',dict(value,**identity))
        report = emitter.loop(box, Sender(box, transport), publish, stop)
    finally:
        box.close()
    state = dict(report,**identity)
    state['inherited_secret'] = any(k.upper().startswith('SANISIDRO_') for k in os.environ)
    emitter.save(args.sender/'sender.json',state)
    if args.fault == 'missing':
        return 0
    if args.fault == 'hang':
        import time
        time.sleep(60)
    receipt = dict(identity,exit_code=0,report=state)
    if args.fault == 'foreign':
        receipt['pid'] += 1
    emitter.save(args.sender/'closed.json',receipt)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
