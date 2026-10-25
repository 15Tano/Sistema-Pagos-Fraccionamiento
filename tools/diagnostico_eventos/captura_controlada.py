"""Presentacion fisica de un tag, con un solo cliente SDK a la vez."""
import argparse
from collections import Counter
import datetime as dt
import json
from pathlib import Path
import sys
import time

import lector_eventos as reader

ROOT = Path(__file__).resolve().parent


def history_event(event):
    stamp = dt.datetime.strptime(event['device_time_raw'].strip(), '%Y-%m-%d %H:%M:%S')
    if stamp.year < 2000:
        raise ValueError('Hora del evento fuera del formato ZK esperado.')
    packed = (((stamp.year - 2000) * 12 + stamp.month - 1) * 31 + stamp.day - 1) * 86400
    packed += stamp.hour * 3600 + stamp.minute * 60 + stamp.second
    def number(value):
        value = str(value).strip()
        if not value.isascii() or not value.isdigit():
            raise ValueError('Campo numerico inesperado; conservar evidencia y revisar.')
        return str(int(value))
    return {key: number(value) for key, value in {
        'Cardno': event['card'], 'Pin': event['pin'], 'Verified': event['verification_raw'],
        'DoorID': event['door_raw'], 'EventType': event['event_code'],
        'InOutState': event['direction_raw'], 'Time_second': packed}.items()}


def count_in_history(event, rows):
    expected = history_event(event)
    return sum(all(str(row.get(key, '')).strip().isascii() and
                   str(row.get(key, '')).strip().isdigit() and
                   str(int(str(row[key]).strip())) == value
                   for key, value in expected.items()) for row in rows)


def capture(args):
    _, directory, info = reader.load_sdk()
    directory.close()
    folder = ROOT / 'registros' / dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    folder.mkdir(parents=True)
    report = {'mode': 'controlled_single_client', 'status': 'incomplete', 'tag': args.tag,
              'pluma_observada': args.pluma, 'compatibility': info, 'started_utc': reader.now(),
              'drain_files': [], 'poll_files': [],
              'limits': 'Presentacion observada por operador. No modifica vigencias, reloj o permisos; no certifica cruce ni independencia de otros programas.'}
    def persist():
        reader.save(folder / 'resumen.json', report)
    persist()
    print('Evidencia: ' + str(folder), flush=True)
    try:
        with reader.maintenance_lock():
            clients = []
            try:
                input('Mantenga el tag LEJOS de la antena. ENTER para preparar la captura: ')
                a = reader.Client(folder, 'Captura_A'); clients.append(a)
                a.call('connect')
                report['history_before'] = a.call('history', tag=args.tag)
                persist()
                first_status = None
                deadline = time.monotonic() + 60
                print('Preparando base RT (hasta 60 s / 300 consultas). NO presente el tag todavia.', flush=True)
                while len(report['drain_files']) < 300 and time.monotonic() < deadline:
                    result = a.call('rt')
                    report['drain_files'].append(result['file'])
                    if result['rows'] and all(row['kind'] == 'status' for row in result['rows']):
                        if first_status is None:
                            first_status = (time.monotonic(), result)
                        elif time.monotonic() - first_status[0] >= 1:
                            report['baseline_status_pair'] = [first_status[1], result]
                            break
                    else:
                        first_status = None
                    persist()
                    time.sleep(0.2)
                if 'baseline_status_pair' not in report:
                    report['status'] = 'queue_end_unconfirmed_not_armed'
                    print('NO ARMADO: no se confirmaron dos estados 255. No presente el tag.', flush=True)
                    return
                report['armed_utc'] = reader.now()
                persist()
                print('ARMADO: presente el tag ' + args.tag + ' UNA vez y retirelo. Ventana ' + str(args.seconds) + ' s.', flush=True)
                deadline = time.monotonic() + args.seconds
                while time.monotonic() < deadline:
                    result = a.call('rt')
                    report['poll_files'].append(result['file'])
                    matches = [row for row in reader.card_events(result) if reader.same_card(row['card'], args.tag)]
                    if matches:
                        report['observation'] = result
                        report['selected_events'] = matches
                        report['reread'] = a.call('rt')
                        report['same_event_in_reread'] = [row in report['reread']['rows'] for row in matches]
                        persist()
                        print('Tag recibido. Retirelo y no vuelva a presentarlo.', flush=True)
                        print(json.dumps(matches, ensure_ascii=True, indent=2), flush=True)
                        break
                    persist()
                    time.sleep(0.2)
                if 'selected_events' not in report:
                    report['status'] = 'no_target_event_inconclusive'
                    print('Sin evento del tag elegido en esta ventana; resultado inconcluso.', flush=True)
                    return
                report['history_after'] = a.call('history', tag=args.tag)
                report['history_reread'] = a.call('history', tag=args.tag)
                persist()
                a.close(); clients.clear()  # Disconnect y salida antes de abrir B.
                b = reader.Client(folder, 'Captura_B_reconexion'); clients.append(b)
                b.call('connect')
                report['rt_after_reconnect'] = b.call('rt')
                report['same_event_after_reconnect'] = [row in report['rt_after_reconnect']['rows']
                                                       for row in report['selected_events']]
                report['history_after_reconnect'] = b.call('history', tag=args.tag)
                b.close(); clients.clear()
                report['history_comparisons'] = {key: reader.history_comparison(
                    report['history_before']['rows'], report[key]['rows'])
                    for key in ('history_after', 'history_reread', 'history_after_reconnect')}
                report['correlation'] = [{
                    'event': event, 'expected_history_fields': history_event(event),
                    'counts': {key: count_in_history(event, report[key]['rows']) for key in (
                        'history_before', 'history_after', 'history_reread', 'history_after_reconnect')}
                } for event in report['selected_events']]
                # Require multiplicity for every selected occurrence, not just tuple presence.
                required = Counter(json.dumps(history_event(e), sort_keys=True) for e in report['selected_events'])
                confirmed = all(all(c['counts'][key] - c['counts']['history_before'] >=
                                    required[json.dumps(c['expected_history_fields'], sort_keys=True)]
                                    for key in ('history_after', 'history_reread', 'history_after_reconnect'))
                                for c in report['correlation'])
                preserved = all(not value['missing_rows'] for value in report['history_comparisons'].values())
                report['status'] = ('rt_and_new_history_confirmed_pending_operator_review'
                                    if confirmed and preserved else 'rt_captured_history_pending_review')
                persist()
                report['operator_note_utc'] = reader.now()
                report['observacion_operador'] = input('Anote pluma, hora aproximada y si abrio/rechazo/no hubo respuesta (sin datos personales): ')
                print('Resultado: ' + report['status'], flush=True)
                print('Correlacion: ' + json.dumps(report['correlation'], ensure_ascii=True), flush=True)
                print('Mismo evento en relectura RT: ' + json.dumps(report['same_event_in_reread']), flush=True)
                print('Mismo evento RT tras reconexion: ' + json.dumps(report['same_event_after_reconnect']), flush=True)
                print('Filas historicas faltantes: ' + json.dumps({key: len(value['missing_rows'])
                      for key, value in report['history_comparisons'].items()}), flush=True)
            finally:
                for client in clients:
                    client.close()
    except BaseException as exc:
        report['status'] = 'incomplete'
        report['error'] = str(exc) or type(exc).__name__
        raise
    finally:
        report['ended_utc'] = reader.now()
        persist()
        print('Cierre diagnostico. Use Terminar y reanudar en el gestor y revise dos ciclos correctos.', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--pluma', required=True)
    parser.add_argument('--seconds', type=int, default=60)
    args = parser.parse_args()
    if not args.tag.isascii() or not args.tag.isdigit() or not 0 < int(args.tag) or len(args.tag) > 20:
        parser.error('--tag requiere numero decimal, hasta 20 digitos, distinto de cero.')
    if not args.pluma.strip() or len(args.pluma) > 100 or not 5 <= args.seconds <= 60:
        parser.error('--pluma requiere descripcion (hasta 100 caracteres); --seconds entre 5 y 60.')
    capture(args)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('DIAGNOSTICO INTERRUMPIDO: ' + str(exc), file=sys.stderr)
        sys.exit(1)
