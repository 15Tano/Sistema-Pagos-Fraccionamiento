"""Herramienta manual de preparacion; no instala tareas ni realiza consultas SDK."""
import argparse
import getpass
import json
from pathlib import Path
import sqlite3

import credencial
from emisor import HttpTransport, Sender
from outbox import Outbox


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, default=Path(__file__).parent / 'datos' / 'outbox.sqlite')
    commands = parser.add_subparsers(dest='command', required=True)
    init = commands.add_parser('iniciar')
    init.add_argument('--agente', required=True)
    init.add_argument('--serial', required=True)
    capture = commands.add_parser('encolar-respuesta')
    capture.add_argument('--archivo', type=Path, required=True)
    capture.add_argument('--origen', choices=('rt', 'transaction'), required=True)
    capture.add_argument('--codigo', type=int, required=True)
    capture.add_argument('--inicio', required=True)
    capture.add_argument('--fin', required=True)
    state = commands.add_parser('encolar-estado')
    state.add_argument('--archivo', type=Path, required=True)
    send = commands.add_parser('enviar')
    send.add_argument('--url', required=True)
    send.add_argument('--credencial', type=Path, required=True)
    send.add_argument('--ensayo-local', action='store_true')
    send.add_argument('--max-mensajes', type=int, default=20)
    secret = commands.add_parser('guardar-credencial')
    secret.add_argument('--archivo', type=Path, required=True)
    commands.add_parser('estado-local')
    commands.add_parser('reanudar')
    args = parser.parse_args(argv)
    try:
        if args.command == 'guardar-credencial':
            credencial.store(args.archivo, getpass.getpass('Credencial de ingesta (oculta): '))
            print('Credencial DPAPI guardada para el usuario actual.')
            return 0
        box = Outbox(args.db, args.agente, args.serial) if args.command == 'iniciar' else Outbox(args.db)
        try:
            if args.command == 'encolar-respuesta':
                box.capture(args.archivo.read_bytes(), args.origen, args.codigo, args.inicio, args.fin)
            elif args.command == 'encolar-estado':
                box.enqueue_state(json.loads(args.archivo.read_text(encoding='utf-8-sig')))
            elif args.command == 'enviar':
                transport = HttpTransport(args.url, credencial.load(args.credencial), local_trial=args.ensayo_local)
                if not 1 <= args.max_mensajes <= 100:
                    raise ValueError('Maximo de mensajes fuera de limites.')
                for _ in range(args.max_mensajes):
                    if box.build_batch() is None:
                        break
                print(json.dumps({'delivery': Sender(box, transport).run(args.max_mensajes)}))
            elif args.command == 'reanudar':
                box.resume()
            print(json.dumps(box.health(), ensure_ascii=True))
        finally:
            box.close()
        return 0
    except (OSError, ValueError, sqlite3.Error):
        print('Operacion interrumpida; originales conservados. Revisar almacenamiento/configuracion y estado-local.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
