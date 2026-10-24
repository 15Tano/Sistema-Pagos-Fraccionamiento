"""Diagnostico manual C3: dos procesos SDK, buffers originales y bloqueo compartido.

No importa modulos operativos ni expone funciones de escritura del SDK.
"""
import argparse
from collections import Counter
import contextlib
import csv
import ctypes
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import queue
import struct
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parent
DLL = Path(r'C:\Program Files (x86)\ZKTeco\ZKAccess3.5\NewSDK\plcommpro.dll')
SYNC = Path(r'C:\SanIsidro\ZKSync')
GESTOR = Path(r'C:\SanIsidro\GestionTags')
EXPECTED_HASH = '82bda08dbbab24b918ebe7de68eeb3e4fb952f275eecc992cb9148c5384a413a'
SERIAL = 'CO2K225060027'
CONNECTION = b'protocol=TCP,ipaddress=192.168.1.201,port=4370,timeout=10000,passwd='


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def save(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=True, indent=2), encoding='utf-8')


def inspect_dll(path=DLL):
    data = path.read_bytes()
    if data[:2] != b'MZ':
        raise RuntimeError('No es un ejecutable PE.')
    offset = struct.unpack_from('<I', data, 0x3c)[0]
    if data[offset:offset + 4] != b'PE\0\0' or struct.unpack_from('<H', data, offset + 4)[0] != 0x14c:
        raise RuntimeError('La biblioteca no es PE x86.')
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXPECTED_HASH:
        raise RuntimeError('DLL distinta del inventario verificado. Conservar version/hash y revisar; no sustituirla.')
    return {'path': str(path), 'sha256': digest, 'machine': 'x86', 'python': sys.version,
            'python_executable': sys.executable, 'utc': now()}


def load_sdk():
    if os.name != 'nt' or struct.calcsize('P') != 4:
        raise RuntimeError('Ejecutar con el Python de 32 bits instalado en Dell.')
    info = inspect_dll()
    directory = os.add_dll_directory(str(DLL.parent))
    try:
        # DLL y dependencias solo en su directorio instalado y directorios de Windows.
        sdk = ctypes.WinDLL(str(DLL), winmode=0x00000100 | 0x00001000 | 0x00000800)
        pointer = ctypes.c_void_p
        text = ctypes.c_char_p
        buffer = ctypes.POINTER(ctypes.c_char)
        signatures = {
            'Connect': ([text], pointer),
            'Disconnect': ([pointer], None),
            'GetRTLog': ([pointer, buffer, ctypes.c_int], ctypes.c_int),
            'GetDeviceData': ([pointer, buffer, ctypes.c_int, text, text, text, text], ctypes.c_int),
            'GetDeviceParam': ([pointer, buffer, ctypes.c_int, text], ctypes.c_int),
            'PullLastError': ([], ctypes.c_int),
        }
        for name, (args, result) in signatures.items():
            function = getattr(sdk, name)  # Verifica exportacion antes de conectar.
            function.argtypes, function.restype = args, result
        info['exports'] = list(signatures)
        return sdk, directory, info
    except BaseException:
        directory.close()
        raise


def rt_rows(payload):
    rows = []
    for values in csv.reader(io.StringIO(payload.decode('utf-8', errors='strict'))):
        if not values:
            continue
        if len(values) != 7 or not values[4].strip().isdigit():
            raise RuntimeError('Formato RT no documentado; revisar el buffer original.')
        rows.append({'device_time_raw': values[0], 'pin': values[1], 'card': values[2],
                     'door_raw': values[3], 'event_code': int(values[4]),
                     'direction_raw': values[5], 'verification_raw': values[6],
                     'kind': 'status' if int(values[4]) == 255 else 'event'})
    return rows


def history_rows(payload, count):
    rows = list(csv.DictReader(io.StringIO(payload.decode('utf-8', errors='strict'))))
    if len(rows) != count or any(None in r or any(v is None for v in r.values()) for r in rows):
        raise RuntimeError('Historial incompleto o formato inesperado; revisar buffer.')
    return rows


def same_card(value, tag):
    return value.strip().isdigit() and value.strip().lstrip('0') == tag.lstrip('0')


def worker(folder, client):
    sdk, directory, info = load_sdk()
    handle = None
    sequence = 0
    def buffered(function, size, suffix, parser):
        nonlocal sequence
        sequence += 1
        name = f'{client}_{sequence:04d}_{suffix}'
        buf = ctypes.create_string_buffer(size)
        started = now()
        started_local = dt.datetime.now().astimezone().isoformat()
        result = function(buf)
        ended = now()
        ended_local = dt.datetime.now().astimezone().isoformat()
        original = buf.raw
        # Guardar incluso respuestas negativas, vacias o imposibles de interpretar.
        (folder / (name + '.buffer.bin')).write_bytes(original)
        payload = original.split(b'\0', 1)[0]
        (folder / (name + '.payload.bin')).write_bytes(payload)
        meta = {'client': client, 'pid': os.getpid(), 'function': suffix,
                'started_utc': started, 'ended_utc': ended, 'return_code': result,
                'started_local': started_local, 'ended_local': ended_local,
                'buffer_size': size, 'payload_bytes': len(payload),
                'buffer_sha256': hashlib.sha256(original).hexdigest(),
                'payload_sha256': hashlib.sha256(payload).hexdigest()}
        save(folder / (name + '.json'), meta)
        if result < 0 or b'\0' not in original:
            raise RuntimeError(f'{name}: codigo SDK {result} o buffer sin terminador; evidencia conservada.')
        rows = parser(payload, result)
        meta['rows'] = rows
        save(folder / (name + '.json'), meta)
        return {'file': name, 'return_code': result, 'rows': rows,
                'payload_sha256': meta['payload_sha256'],
                'started_utc': started, 'ended_utc': ended,
                'started_local': started_local, 'ended_local': ended_local}
    try:
        for line in sys.stdin:
            request = json.loads(line)
            command = request['command']
            try:
                if command == 'connect':
                    if handle:
                        raise RuntimeError('Cliente ya conectado.')
                    maintenance_guard()
                    handle = sdk.Connect(CONNECTION)
                    if not handle:
                        raise RuntimeError('Connect fallo: ' + str(sdk.PullLastError()))
                    result = buffered(lambda b: sdk.GetDeviceParam(handle, b, len(b), b'~SerialNumber'),
                                      4096, 'identity', lambda p, n: p.decode('ascii', errors='strict'))
                    if result['rows'].strip() != '~SerialNumber=' + SERIAL:
                        raise RuntimeError('Serial no coincide exactamente; revisar identity.payload.bin.')
                    result['compatibility'] = info
                elif command == 'close':
                    break
                elif not handle:
                    raise RuntimeError('Cliente desconectado.')
                elif command == 'rt':
                    result = buffered(lambda b: sdk.GetRTLog(handle, b, len(b)), 65536, 'GetRTLog',
                                      lambda p, n: rt_rows(p))
                elif command == 'history':
                    tag = request['tag']
                    if not tag.isascii() or not tag.isdigit():
                        raise RuntimeError('Tag invalido.')
                    result = buffered(lambda b: sdk.GetDeviceData(handle, b, len(b), b'transaction',
                                      b'*', ('Cardno=' + tag).encode('ascii'), b''),
                                      4 * 1024 * 1024, 'GetDeviceData_transaction', history_rows)
                    if any(not same_card(row.get('Cardno', ''), tag) for row in result['rows']):
                        raise RuntimeError('Filtro de tag no respetado o esquema distinto. No continuar.')
                else:
                    raise RuntimeError('Comando no permitido.')
                print(json.dumps({'ok': True, 'result': result}), flush=True)
            except Exception as exc:
                print(json.dumps({'ok': False, 'error': str(exc)}), flush=True)
                break
    finally:
        if handle:
            sdk.Disconnect(handle)
        directory.close()


class Client:
    def __init__(self, folder, name):
        self.name = name
        self.stderr = (folder / (name + '.stderr.txt')).open('a', encoding='utf-8')
        self.process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()),
                                        '--worker', str(folder), name], stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE, stderr=self.stderr, text=True)
        self.replies = queue.Queue()
        threading.Thread(target=self.read_replies, daemon=True).start()

    def read_replies(self):
        for line in self.process.stdout:
            self.replies.put(line)
        self.replies.put(None)

    def call(self, command, **kwargs):
        self.process.stdin.write(json.dumps({'command': command, **kwargs}) + '\n')
        self.process.stdin.flush()
        try:
            line = self.replies.get(timeout=25)
        except queue.Empty:
            raise RuntimeError('Cliente ' + self.name + ' no respondio en 25 s; abortar prueba.')
        if line is None:
            raise RuntimeError('Cliente termino; revisar stderr conservado.')
        reply = json.loads(line)
        if not reply['ok']:
            raise RuntimeError(self.name + ': ' + reply['error'])
        return reply['result']

    def close(self):
        if self.stderr.closed:
            return
        try:
            if self.process.poll() is None:
                self.process.stdin.write('{"command":"close"}\n')
                self.process.stdin.flush()
                self.process.wait(timeout=15)
        except (OSError, subprocess.TimeoutExpired, KeyboardInterrupt):
            self.process.terminate()  # Solo nuestro subproceso diagnostico.
            self.process.wait(timeout=10)
        finally:
            self.stderr.close()


def maintenance_guard():
    state = json.loads((GESTOR / 'mantenimiento.json').read_text(encoding='utf-8-sig'))
    if not state.get('active') or (GESTOR / 'revision_pendiente.json').exists():
        raise RuntimeError('Preparar mantenimiento en el gestor; resolver revisiones pendientes.')
    command = "$ErrorActionPreference='Stop'; $t=Get-ScheduledTask -TaskName 'SanIsidro-Vigencias'; if($t.Settings.Enabled -or $t.State -eq 'Running'){exit 2}"
    subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command], check=True)


@contextlib.contextmanager
def maintenance_lock():
    import msvcrt
    maintenance_guard()
    # Exige el bloqueo instalado existente. No crea ni elimina ese archivo.
    with (SYNC / 'sync.lock').open('r+b') as stream:
        msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        try:
            maintenance_guard()
            yield
        finally:
            stream.seek(0)
            msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)


def history_comparison(before, after):
    left = Counter(json.dumps(row, sort_keys=True) for row in before)
    right = Counter(json.dumps(row, sort_keys=True) for row in after)
    return {'before': len(before), 'after': len(after),
            'missing_rows': list((left - right).elements()),
            'added_rows': list((right - left).elements()),
            'interpretation': 'Observacion de esta muestra; no prueba cursor New Record ni otros programas.'}


def history_session(args):
    """Consulta remota sin presentacion de tag ni llamadas GetRTLog."""
    sequential = getattr(args, 'historial_secuencial', False)
    sdk, directory, info = load_sdk()
    directory.close()
    folder = ROOT / 'registros' / dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    folder.mkdir(parents=True)
    report = {'started_utc': now(), 'compatibility': info, 'tag': args.tag,
              'mode': 'history_sequential' if sequential else 'history_only',
              'status': 'incomplete', 'snapshots': {},
              'limits': 'Historial existente de transaction, opciones vacias. No prueba RT, New Record, ZKAccess ni paso fisico.'}
    save(folder / 'resumen.json', report)
    print('Evidencia: ' + str(folder), flush=True)
    try:
        with maintenance_lock():
            clients = []
            try:
                a = Client(folder, 'A'); clients.append(a)
                a.call('connect')
                def snapshot(label, client):
                    result = client.call('history', tag=args.tag)
                    report['snapshots'][label] = result
                    save(folder / 'resumen.json', report)
                    print(label + ': filas=' + str(len(result['rows'])) +
                          ' SHA256=' + result.get('payload_sha256', 'no disponible'), flush=True)
                    return result
                before = snapshot('A_first', a)
                snapshot('A_reread', a)
                if sequential:
                    a.close(); clients.clear()  # Disconnect y salida antes de otra sesion.
                b = Client(folder, 'B'); clients.append(b)
                b.call('connect')
                snapshot('B_after_A', b)
                if sequential:
                    snapshot('B_reread', b)
                    b.close(); clients.clear()
                else:
                    snapshot('A_after_B', a)
                    a.close(); b.close(); clients.clear()
                c = Client(folder, 'C_reconexion'); clients.append(c)
                c.call('connect')
                snapshot('C_after_reconnect', c)
                report['comparisons'] = {name: history_comparison(before['rows'], value['rows'])
                                         for name, value in report['snapshots'].items() if name != 'A_first'}
                report['status'] = 'history_captured_pending_review' if before['rows'] else 'history_empty_pending_review'
                print('Filas historicas del tag en primera lectura: ' + str(len(before['rows'])), flush=True)
                print('Muestra de hasta 10 filas recibidas (orden del SDK, sin interpretar hora):', flush=True)
                print(json.dumps(before['rows'][-10:], ensure_ascii=True, indent=2), flush=True)
                counts = {name: {'before': value['before'], 'after': value['after'],
                                 'missing': len(value['missing_rows']), 'added': len(value['added_rows'])}
                          for name, value in report['comparisons'].items()}
                print('Comparaciones: ' + json.dumps(counts, ensure_ascii=True), flush=True)
            finally:
                for client in clients:
                    client.close()
    except BaseException as exc:
        report['error'] = str(exc) or type(exc).__name__
        raise
    finally:
        report['ended_utc'] = now()
        save(folder / 'resumen.json', report)
        print('Cierre diagnostico. Use Terminar y reanudar en el gestor y revise dos ciclos correctos.', flush=True)


def card_events(result):
    return [row for row in result['rows'] if row['kind'] == 'event'
            and row['card'].strip().isascii() and row['card'].strip().isdigit()
            and 0 < int(row['card'].strip()) and len(row['card'].strip()) <= 20]


def observe_rt(args):
    """RT por trafico normal; un cliente a la vez, sin presentacion controlada."""
    sdk, directory, info = load_sdk()
    directory.close()
    folder = ROOT / 'registros' / dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    folder.mkdir(parents=True)
    report = {'started_utc': now(), 'compatibility': info, 'mode': 'observe_rt',
              'status': 'incomplete', 'poll_files': [],
              'limits': 'Observacion sin control fisico. Distinto de baseline no certifica instante de generacion, paso ni reloj.'}
    save(folder / 'resumen.json', report)
    print('Evidencia: ' + str(folder), flush=True)
    try:
        with maintenance_lock():
            clients = []
            try:
                a = Client(folder, 'RT_A'); clients.append(a)
                a.call('connect')
                baseline = a.call('rt')
                report['baseline'] = baseline
                save(folder / 'resumen.json', report)
                report['baseline_immediate_reread'] = a.call('rt')
                known = card_events(baseline)
                observed = [row for row in card_events(report['baseline_immediate_reread']) if row not in known]
                if observed:
                    report['observation'] = report['baseline_immediate_reread']
                    report['immediate_reread'] = a.call('rt')
                save(folder / 'resumen.json', report)
                print('Base RT guardada. Observando trafico normal durante hasta ' + str(args.seconds) + ' segundos.', flush=True)
                deadline = time.monotonic() + args.seconds
                while not observed and time.monotonic() < deadline:
                    result = a.call('rt')
                    report['poll_files'].append(result['file'])
                    observed = [row for row in card_events(result) if row not in known]
                    if observed:
                        report['observation'] = result
                        report['immediate_reread'] = a.call('rt')
                        break
                    time.sleep(0.5)
                # La base tambien puede contener registros previos a esta sesion.
                chosen = observed[:1] or card_events(baseline)[:1]
                report['selected_events'] = chosen
                report['status'] = ('rt_after_baseline_pending_review' if observed else
                                    'rt_baseline_only_pending_review' if chosen else 'rt_no_card_event_inconclusive')
                save(folder / 'resumen.json', report)
                if chosen:
                    reference = report.get('immediate_reread', report['baseline_immediate_reread'])
                    report['selected_in_reread'] = [row in reference['rows'] for row in chosen]
                    tag = chosen[0]['card'].strip()
                    report['history_A'] = a.call('history', tag=tag)
                    a.close(); clients.clear()
                    b = Client(folder, 'RT_B_reconexion'); clients.append(b)
                    b.call('connect')
                    report['rt_after_reconnect'] = b.call('rt')
                    report['selected_after_reconnect'] = [row in report['rt_after_reconnect']['rows'] for row in chosen]
                    report['history_B'] = b.call('history', tag=tag)
                    report['history_comparison'] = history_comparison(report['history_A']['rows'], report['history_B']['rows'])
                    print('Eventos observados (hora y puerta del equipo, sin certificar paso):', flush=True)
                    print(json.dumps(chosen, ensure_ascii=True, indent=2), flush=True)
                    print('Mismo evento en relectura: ' + json.dumps(report['selected_in_reread']), flush=True)
                    print('Mismo evento tras reconexion: ' + json.dumps(report['selected_after_reconnect']), flush=True)
                    comparison = report['history_comparison']
                    print('Historial del tag observado: antes=' + str(comparison['before']) +
                          ', despues=' + str(comparison['after']) +
                          ', faltantes=' + str(len(comparison['missing_rows'])) +
                          ', agregadas=' + str(len(comparison['added_rows'])), flush=True)
                print('Resultado: ' + report['status'], flush=True)
            finally:
                for client in clients:
                    client.close()
    except BaseException as exc:
        report['status'] = 'incomplete'
        report['error'] = str(exc) or type(exc).__name__
        raise
    finally:
        report['ended_utc'] = now()
        save(folder / 'resumen.json', report)
        print('Cierre diagnostico. Use Terminar y reanudar en el gestor y revise dos ciclos correctos.', flush=True)


def pc_timezone():
    import winreg
    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                        r'SYSTEM\CurrentControlSet\Control\TimeZoneInformation') as key:
        return winreg.QueryValueEx(key, 'TimeZoneKeyName')[0].strip('\0')


def status_clock_sample(result, row):
    """Diferencia respecto al reloj local configurado del PC, sin escribir hora."""
    before = dt.datetime.fromisoformat(result['started_local'])
    after = dt.datetime.fromisoformat(result['ended_local'])
    if before.tzinfo is None or after.tzinfo is None or after < before:
        raise ValueError('Tiempos del PC sin offset o no monotonicos; comparar manualmente.')
    if before.utcoffset() != after.utcoffset():
        raise ValueError('Cambio de offset local durante la llamada; comparar manualmente.')
    device = dt.datetime.strptime(row['device_time_raw'].strip(), '%Y-%m-%d %H:%M:%S')
    middle = before.replace(tzinfo=None) + (after - before) / 2
    return {'file': result['file'], 'device_time_raw': row['device_time_raw'],
            'pc_started_utc': result['started_utc'], 'pc_ended_utc': result['ended_utc'],
            'pc_started_local': result['started_local'], 'pc_ended_local': result['ended_local'],
            'device_minus_pc_seconds': round((device - middle).total_seconds(), 3),
            'call_seconds': round((after - before).total_seconds(), 3),
            'meaning': 'Comparacion contra PC configurado; no certifica hora externa ni zona del controlador.'}


def drain_rt(args):
    """Consulta RT acotada hasta dos estados 255 separados; no vacia historial."""
    sdk, directory, info = load_sdk()
    directory.close()
    folder = ROOT / 'registros' / dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    folder.mkdir(parents=True)
    report = {'started_utc': now(), 'compatibility': info, 'mode': 'drain_rt_bounded',
              'status': 'incomplete', 'poll_files': [], 'clock_samples': [],
              'event_rows_received': 0, 'status_rows_received': 0,
              'limits': {'seconds': args.seconds, 'max_calls': args.max_consultas,
                         'note': 'Plazo de consulta, mas ultima llamada/cierre. Sin borrar historial ni escribir parametros.'}}
    save(folder / 'resumen.json', report)
    print('Evidencia: ' + str(folder), flush=True)
    try:
        report['pc_timezone_key'] = pc_timezone()
        with maintenance_lock():
            client = Client(folder, 'Cola_A')
            try:
                client.call('connect')
                deadline = time.monotonic() + args.seconds
                first_status_at = None
                print('Leyendo cola; maximo ' + str(args.max_consultas) + ' consultas en ' + str(args.seconds) + ' s.', flush=True)
                while len(report['poll_files']) < args.max_consultas and time.monotonic() < deadline:
                    result = client.call('rt')
                    report['poll_files'].append(result['file'])
                    events = [row for row in result['rows'] if row['kind'] == 'event']
                    statuses = [row for row in result['rows'] if row['kind'] == 'status']
                    report['event_rows_received'] += len(events)
                    report['status_rows_received'] += len(statuses)
                    if events:
                        report.setdefault('first_event', events[0])
                        report['last_event'] = events[-1]
                    # Un buffer mixto/vacio no acredita fin de cola.
                    if statuses and not events:
                        sample = {'file': result['file'], 'device_time_raw': statuses[0]['device_time_raw']}
                        try:
                            sample = status_clock_sample(result, statuses[0])
                        except (ValueError, KeyError) as exc:
                            sample['clock_parse_error'] = str(exc)
                        report['clock_samples'].append(sample)
                        if first_status_at is None:
                            first_status_at = time.monotonic()
                            first_status_sample = sample
                            print('Estado 255 observado; comprobando una segunda muestra.', flush=True)
                        elif time.monotonic() - first_status_at >= 1:
                            report['status_pair'] = [first_status_sample, sample]
                            report['status'] = 'two_status_responses_pending_clock_review'
                            break
                    else:
                        first_status_at = None
                    if len(report['poll_files']) % 25 == 0:
                        print('Consultas=' + str(len(report['poll_files'])) +
                              ', eventos recibidos=' + str(report['event_rows_received']), flush=True)
                    save(folder / 'resumen.json', report)
                    time.sleep(0.2)
                if report['status'] == 'incomplete':
                    report['status'] = 'limit_reached_queue_end_unconfirmed'
                print('Resultado: ' + report['status'], flush=True)
                print('Consultas=' + str(len(report['poll_files'])) + ', eventos=' +
                      str(report['event_rows_received']) + ', estados=' + str(report['status_rows_received']), flush=True)
                print('Zona configurada PC: ' + report['pc_timezone_key'], flush=True)
                print('Muestras de estado/reloj:', flush=True)
                print(json.dumps(report.get('status_pair', report['clock_samples'][-2:]), ensure_ascii=True, indent=2), flush=True)
            finally:
                client.close()
    except BaseException as exc:
        report['status'] = 'incomplete'
        report['error'] = str(exc) or type(exc).__name__
        raise
    finally:
        report['ended_utc'] = now()
        save(folder / 'resumen.json', report)
        print('Cierre diagnostico. Use Terminar y reanudar en el gestor y revise dos ciclos correctos.', flush=True)


def session(args):
    sdk, directory, info = load_sdk()  # Sin Connect: compatibilidad local primero.
    directory.close()
    folder = ROOT / 'registros' / dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    folder.mkdir(parents=True)
    report = {'started_utc': now(), 'compatibility': info, 'tag': args.tag,
              'pluma_observada': args.pluma, 'rounds': [], 'status': 'incomplete',
              'limits': 'Dos procesos de nuestra herramienta. ZKAccess y polling no probados como clientes concurrentes.'}
    save(folder / 'resumen.json', report)
    print('Evidencia: ' + str(folder), flush=True)
    try:
        with maintenance_lock():
            clients = []
            try:
                a = Client(folder, 'A'); clients.append(a)
                a.call('connect')
                before = a.call('history', tag=args.tag)
                b = Client(folder, 'B'); clients.append(b)
                b.call('connect')  # Segunda conexion: si falla, abortar sin insistir.
                report['history_before_B'] = history_comparison(before['rows'], b.call('history', tag=args.tag)['rows'])
                for first, second in [(a, b), (b, a)]:
                    input('Retire el tag de la antena. ENTER para armar ' + first.name + ' -> ' + second.name + ': ')
                    baseline_first = first.call('rt')
                    baseline_second = second.call('rt')
                    previous = baseline_first['rows'] + baseline_second['rows']
                    started = now()
                    print('ARMADO: presente el tag UNA vez y retirelo. Ventana ' + str(args.seconds) + ' s.', flush=True)
                    deadline = time.monotonic() + args.seconds
                    found = None
                    while time.monotonic() < deadline:
                        result = first.call('rt')
                        matches = [r for r in result['rows'] if r['kind'] == 'event'
                                   and same_card(r['card'], args.tag) and r not in previous]
                        if matches:
                            found = {'response': result['file'], 'events': matches}
                            break
                        time.sleep(0.5)
                    if found is None:
                        raise RuntimeError('No se identifico el tag en la ventana; resultado inconcluso.')
                    print('Evento identificado: ' + json.dumps(found['events'], ensure_ascii=True), flush=True)
                    reread = first.call('rt')
                    other = second.call('rt')
                    round_result = {'started_utc': started, 'first': first.name, 'second': second.name,
                                    'baseline': [baseline_first, baseline_second],
                                    'found': found, 'reread': reread, 'other_client': other}
                    round_result['same_event_in_reread'] = [e in reread['rows'] for e in found['events']]
                    round_result['same_event_in_other_client'] = [e in other['rows'] for e in found['events']]
                    report['rounds'].append(round_result)
                    save(folder / 'resumen.json', report)
                    after = second.call('history', tag=args.tag)
                    round_result['history_after'] = after
                    round_result['history_reread'] = history_comparison(after['rows'], second.call('history', tag=args.tag)['rows'])
                    round_result['observacion_operador'] = input('Anote pluma, hora local, respuesta fisica y otras lecturas (sin datos personales): ')
                    save(folder / 'resumen.json', report)
                input('Retire el tag. ENTER para preparar la consulta de HISTORIAL antes del RT: ')
                baseline = [a.call('rt'), b.call('rt')]
                input('Presente UNA vez el tag, retirelo y pulse ENTER inmediatamente: ')
                history_first = a.call('history', tag=args.tag)
                report['history_first_experiment'] = {'baseline': baseline, 'history_A': history_first,
                                                      'rt_B_after_history_A': b.call('rt'),
                                                      'rt_A_after_B': a.call('rt'),
                                                      'history_B': b.call('history', tag=args.tag)}
                save(folder / 'resumen.json', report)
                # Reconexion real en un tercer proceso tras cerrar ambos anteriores.
                a.close(); b.close(); clients.clear()
                c = Client(folder, 'C_reconexion'); clients.append(c)
                c.call('connect')
                report['rt_after_reconnect'] = c.call('rt')
                report['history_after_reconnect'] = c.call('history', tag=args.tag)
                report['history_preservation'] = history_comparison(before['rows'], report['history_after_reconnect']['rows'])
                report['status'] = 'captured_pending_review'
            finally:
                for client in clients:
                    client.close()
    except BaseException as exc:
        report['error'] = str(exc) or type(exc).__name__
        raise
    finally:
        report['ended_utc'] = now()
        save(folder / 'resumen.json', report)
        print('Cierre diagnostico. Use Terminar y reanudar en el gestor y revise dos ciclos correctos.', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preflight', action='store_true', help='Verifica DLL/exports sin conectar a C3.')
    parser.add_argument('--worker', nargs=2, help=argparse.SUPPRESS)
    parser.add_argument('--tag')
    parser.add_argument('--historial', action='store_true', help='Consulta eventos guardados sin presentar un tag ni leer RT.')
    parser.add_argument('--historial-secuencial', action='store_true', help='Historial con una sola sesion conectada a la vez.')
    parser.add_argument('--observar-rt', action='store_true', help='Observa RT del trafico normal sin presentar un tag.')
    parser.add_argument('--revisar-cola', action='store_true', help='Busca dos respuestas de estado 255 con consultas limitadas.')
    parser.add_argument('--max-consultas', type=int, default=300)
    parser.add_argument('--pluma', default='sin identificar')
    parser.add_argument('--seconds', type=int, default=45)
    args = parser.parse_args()
    if args.worker:
        worker(Path(args.worker[0]), args.worker[1])
    elif args.preflight:
        sdk, directory, info = load_sdk()
        directory.close()
        save(ROOT / 'compatibilidad.json', info)
        print(json.dumps(info, indent=2))
        print('Exportaciones compatibles; no se conecto. Firmware/comportamiento pendientes.')
    else:
        if not 5 <= args.seconds <= 60:
            parser.error('--seconds debe estar entre 5 y 60.')
        if args.revisar_cola:
            if args.historial or args.historial_secuencial or args.observar_rt:
                parser.error('Elegir un solo modo de consulta.')
            if not 2 <= args.max_consultas <= 300:
                parser.error('--max-consultas debe estar entre 2 y 300.')
            drain_rt(args)
            return
        if args.observar_rt:
            if args.historial or args.historial_secuencial:
                parser.error('Elegir un solo modo de consulta.')
            observe_rt(args)
            return
        if not args.tag or not args.tag.isascii() or not args.tag.isdigit() or int(args.tag) == 0 or len(args.tag) > 20:
            parser.error('--tag requiere un numero decimal conocido, distinto de cero, hasta 20 digitos.')
        if args.historial or args.historial_secuencial:
            history_session(args)
        else:
            session(args)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('DIAGNOSTICO INTERRUMPIDO: ' + str(exc), file=sys.stderr)
        sys.exit(1)
