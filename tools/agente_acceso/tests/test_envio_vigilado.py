"""Emisor/vigilancia con transporte, inventario y credenciales ficticios."""
import copy
import datetime as dt
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import types
import unittest
from unittest.mock import Mock, patch
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'runtime') if (ROOT / 'runtime').is_dir() else str(ROOT))
sys.path.insert(0, str(ROOT))
import entregar_coordinador as delivery_module
from outbox import Outbox
from protocolo import digest, json_bytes
from bucle_envio import run_sender
from vigilancia_envio import assess_sender, combined
import envio_vigilado as app

RUN = '70000000-0000-4000-8000-000000000001'
IDENTITY = {'pid': 42, 'run_id': RUN}
NOW = dt.datetime(2026, 10, 25, 19, tzinfo=dt.timezone.utc)


def at(seconds=0):
    return (NOW + dt.timedelta(seconds=seconds)).isoformat()


def ack(payload):
    value = {'protocol_version': 1, 'status': 'accepted', 'agent_id': payload['agent_id'],
        'content_sha256': digest(json_bytes(payload)), 'server_received_at_utc': at()}
    if 'batch_id' in payload:
        value |= {'batch_id': payload['batch_id'], 'responses_stored': len(payload['responses']),
            'rows_stored': len(payload['responses']), 'events_stored': len(payload['responses']),
            'statuses_stored': 0, 'responses_pending_interpretation': 0}
    else:
        value |= {'session_id': payload['session_id'], 'sequence': payload['sequence']}
    return value


class Transport:
    def __init__(self):
        self.calls, self.status, self.offline, self.invalid = [], 201, False, False
        self.after = lambda: None

    def send(self, endpoint, body):
        self.calls.append((endpoint, body))
        if self.offline:
            raise urllib.error.URLError('ficticio')
        result = ack(json.loads(body))
        if self.invalid:
            result['agent_id'] = RUN
        self.after()
        return self.status, result, None


class Fixture(unittest.TestCase):
    def setUp(self):
        self.scratch = ROOT / 'datos' / 'pruebas_envio'
        self.scratch.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=self.scratch)
        self.folder = Path(self.temp.name)
        self.base = self.folder / 'base'
        self.base.mkdir()
        for name in delivery_module.EXPECTED:
            source = ROOT / 'runtime' / name if (ROOT / 'runtime' / name).is_file() else ROOT / name
            (self.base / name).write_bytes(source.read_bytes())
        box = Outbox(self.base / 'datos/lectura_mantenimiento/outbox.sqlite', delivery_module.AGENT, delivery_module.SERIAL)
        try:
            box.capture(b'2026-10-25 12:00:00,693,12230693,1,0,0,4\r\n', 'rt', 1, at(), at())
        finally:
            box.close()
        self.delivery = delivery_module.Delivery(self.base)
        self.instant = 1000.
        self.delivery.box.clock = lambda: self.instant
        self.transport, self.states = Transport(), []
        self.children = []

    def tearDown(self):
        for child in self.children:
            if child.poll() is None:
                child.kill()
            child.communicate(timeout=5)
        self.delivery.close()
        if not self.folder.resolve().is_relative_to(self.scratch.resolve()):
            raise RuntimeError('Temporal fuera de ensayos.')
        self.temp.cleanup()

    def sleep(self, value):
        self.instant += value

    def run_loop(self, stop=lambda: False, publish=None):
        return run_sender(self.delivery, self.transport, IDENTITY, 5,
            publish or (lambda value: self.states.append(copy.deepcopy(value))), stop,
            clock=lambda: self.instant, sleep=self.sleep, utc=at)


class LoopTests(Fixture):
    def test_ack_and_idle_preserve_originals_and_existing_bodies(self):
        self.delivery.box.build_batch()
        before = self.delivery.message_hashes()
        report = self.run_loop()
        self.assertEqual(len(self.transport.calls), 1)
        self.assertEqual(report['health']['pending_count'], 0)
        self.assertEqual(report['delivery_report']['ack_totals']['responses_stored'], 1)
        self.assertTrue(report['originals_preserved'])
        self.assertEqual(before, self.delivery.message_hashes())

    def test_offline_keeps_same_message_bytes_and_pending(self):
        self.transport.offline = True
        report = self.run_loop()
        self.assertGreaterEqual(report['outcomes']['retry'], 1)
        self.assertEqual(report['health']['pending_count'], 1)
        self.assertEqual(len({body for _, body in self.transport.calls}), 1)
        self.assertEqual(report['last_delivery_outcome'], 'retry')

    def test_invalid_ack_pauses_and_does_not_resume_automatically(self):
        self.transport.invalid = True
        report = self.run_loop()
        self.assertEqual(report['phase'], 'blocked')
        self.assertTrue(report['health']['paused'])
        self.assertEqual(len(self.transport.calls), 1)

    def test_stop_before_send_does_not_touch_transport(self):
        report = self.run_loop(stop=lambda: True)
        self.assertEqual(report['stop_reason'], 'requested')
        self.assertEqual(self.transport.calls, [])

    def test_stop_after_ack_does_not_send_another_message(self):
        stopped = [False]
        self.transport.after = lambda: stopped.__setitem__(0, True)
        report = self.run_loop(stop=lambda: stopped[0])
        self.assertEqual(report['stop_reason'], 'requested')
        self.assertEqual(len(self.transport.calls), 1)

    def test_already_paused_never_sends(self):
        self.delivery.box.db.execute("UPDATE meta SET value='ficticio' WHERE key='paused'")
        self.assertEqual(self.run_loop()['stop_reason'], 'blocked')
        self.assertFalse(self.transport.calls)

    def test_tampered_original_refused_before_transport(self):
        self.delivery.box.db.execute("UPDATE responses SET raw=x'01'")
        with self.assertRaises(ValueError): self.run_loop()
        self.assertFalse(self.transport.calls)

    def test_publish_error_prevents_http(self):
        def bad(_): raise OSError('disco ficticio')
        with self.assertRaises(OSError): self.run_loop(publish=bad)
        self.assertFalse(self.transport.calls)

    def test_concurrent_new_originals_do_not_change_previous_evidence(self):
        inserted = [False]
        def capture():
            if not inserted[0]:
                inserted[0] = True
                self.delivery.box.capture(b'2026-10-25 12:00:01,0,0,0,255,0,0\r\n', 'rt', 1, at(), at())
        self.transport.after = capture
        report = self.run_loop()
        self.assertEqual(report['health']['responses'], 2)
        self.assertEqual(report['health']['pending_count'], 0)
        self.assertTrue(report['originals_preserved'])

    def test_bounded_duration_validated(self):
        for value in (True, 0, 181, '5'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                run_sender(self.delivery, self.transport, IDENTITY, value, lambda _: None, lambda: False)


def sender_state(**changes):
    return {'protocol': 1, **IDENTITY, 'phase': 'idle', 'heartbeat_utc': at(),
        'health': {'pending_count': 0, 'oldest_pending_utc': None, 'paused': False},
        'last_ack_utc': None, 'last_delivery_outcome': None} | changes


class WatchTests(unittest.TestCase):
    def test_empty_queue_does_not_certify_transport(self):
        self.assertEqual(assess_sender(sender_state(), IDENTITY, NOW)['reason'], 'transport_not_verified_in_this_run')

    def test_fresh_ack_recognized(self):
        self.assertEqual(assess_sender(sender_state(last_ack_utc=at(-1)), IDENTITY, NOW)['reason'], 'ack_observed_in_this_run')

    def test_wrong_identity_rejected(self):
        self.assertEqual(assess_sender(sender_state(pid=99), IDENTITY, NOW)['status'], 'desconocido')

    def test_stale_or_future_worker_rejected(self):
        for seconds in (-21, 1):
            self.assertEqual(assess_sender(sender_state(heartbeat_utc=at(seconds)), IDENTITY, NOW)['status'], 'desconocido')

    def test_paused_and_old_pending_degraded(self):
        for health in ({'pending_count': 1, 'oldest_pending_utc': at(-1), 'paused': True},
                       {'pending_count': 1, 'oldest_pending_utc': at(-301), 'paused': False}):
            self.assertEqual(assess_sender(sender_state(health=health), IDENTITY, NOW)['status'], 'degradado')

    def test_expected_stop_does_not_announce_active_sender(self):
        value = assess_sender(sender_state(phase='stopped'), IDENTITY, NOW, expected_stopped=True)
        self.assertEqual(value['status'], 'detenido')

    def test_queue_date_without_pending_unknown(self):
        state = sender_state(health={'pending_count': 0, 'oldest_pending_utc': at(-1), 'paused': False})
        self.assertEqual(assess_sender(state, IDENTITY, NOW)['status'], 'desconocido')

    def test_transport_success_does_not_hide_vigencias_alert(self):
        operational = {'vigencias': {'status': 'alerta', 'reason': 'no_recent_successful_cycle'}}
        report = combined(operational, sender_state(last_ack_utc=at()), IDENTITY, NOW)
        self.assertEqual(report['operacion_observada'], operational)
        self.assertEqual(report['operacion_observada']['vigencias']['status'], 'alerta')


CHILD = r'''
import datetime,json,os,pathlib,sys,time
folder=pathlib.Path(sys.argv[1]); mode=sys.argv[2]
handshake=json.loads(sys.stdin.readline()); ident={'pid':os.getpid(),'run_id':handshake['run_id']}
value={'protocol':1,**ident,'phase':'idle','heartbeat_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'health':{'pending_count':0,'oldest_pending_utc':None,'paused':False}}
(folder/'sender.json').write_text(json.dumps(value))
if mode=='hang': time.sleep(30)
else: sys.stdin.readline()
code=2 if mode=='blocked' else 0
value.update(phase='blocked' if code else 'stopped')
value['heartbeat_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
if mode=='badreport': value['run_id']='otro'
(folder/'sender.json').write_text(json.dumps(value))
if mode!='missing': (folder/'closed.json').write_text(json.dumps({'protocol':1,**ident,'exit_code':code,'report':value,
 'filtered_env':not any(k.upper().startswith('SANISIDRO_') for k in os.environ)}))
sys.exit(code)
'''


class SupervisorTests(Fixture):
    def test_worker_channel_can_exit_at_deadline_while_parent_pipe_remains_open(self):
        code = '''import ctypes,json,sys,time
ctypes.windll.kernel32.SetErrorMode(2)
sys.path.insert(0,sys.argv[1])
import envio_vigilado as app
app.parent_channel(sys.stdin,{'parent_pid':123,'run_id':sys.argv[2]})
time.sleep(.1)
'''
        child = subprocess.Popen([sys.executable, '-B', '-c', code, str(ROOT), RUN],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        self.children.append(child)
        child.stdin.write((json.dumps({'parent_pid': 123, 'run_id': RUN}) + '\n').encode())
        child.stdin.flush()
        child.wait(timeout=6)  # Conservar stdin abierto: simula limite del hijo antes del padre.
        self.assertEqual(child.returncode, 0, child.stderr.read().decode(errors='replace')[-1200:])

    def test_atomic_snapshot_retries_when_reader_temporarily_holds_file(self):
        path = self.folder / 'snapshot.json'
        app.save(path, {'old': True})
        handle = path.open('rb')
        closer = threading.Thread(target=lambda: (time.sleep(.15), handle.close()))
        closer.start()
        try:
            app.save(path, {'new': True})
        finally:
            closer.join(timeout=2)
            handle.close()
        self.assertEqual(app.read(path), {'new': True})

    def test_persistent_permission_failure_is_bounded_and_keeps_old_snapshot(self):
        path = self.folder / 'snapshot.json'
        app.save(path, {'old': True})
        with patch.object(app.os, 'replace', side_effect=PermissionError(13, 'ficticio')) as replace, \
             patch.object(app.time, 'sleep') as sleep:
            with self.assertRaises(PermissionError): app.save(path, {'new': True})
        self.assertEqual(replace.call_count, 21)
        self.assertEqual(sleep.call_count, 20)
        self.assertEqual(app.read(path), {'old': True})
        self.assertFalse(list(self.folder.glob('snapshot.json.*.tmp')))

    def supervise(self, mode='ok', observe=lambda: {'vigencias': {'status': 'correcto'}}):
        request = {'protocol': 1, 'parent_pid': os.getpid(), 'run_id': RUN, 'seconds': 5}
        return app.supervise(self.folder, request, observe, lambda: True,
            worker_command=[sys.executable, '-B', '-c', CHILD, str(self.folder), mode], grace=.3 if mode == 'hang' else 5)

    def test_collects_owned_child_exit_and_receipt(self):
        report = self.supervise()
        self.assertEqual(report['phase'], 'stopped')
        self.assertTrue(report['worker_closure_confirmed'])
        self.assertEqual(report['last_watch']['emisor']['status'], 'detenido')

    def test_missing_receipt_is_not_clean_close(self):
        report = self.supervise('missing')
        self.assertEqual(report['phase'], 'fault')
        self.assertFalse(report['worker_closure_confirmed'])

    def test_receipt_and_nested_report_must_match_identity(self):
        self.assertEqual(self.supervise('badreport')['phase'], 'fault')

    def test_blocked_sender_is_closed_but_not_successful_delivery(self):
        report = self.supervise('blocked')
        self.assertTrue(report['worker_closure_confirmed'])
        self.assertEqual(report['worker_exit_code'], 2)
        self.assertEqual(report['last_watch']['emisor']['status'], 'degradado')

    def test_timeout_kills_only_owned_http_child_and_records_fault(self):
        report = self.supervise('hang')
        self.assertTrue(report['forced_own_sender_exit'])
        self.assertFalse(report['worker_closure_confirmed'])
        self.assertEqual(report['phase'], 'fault')

    def test_child_environment_does_not_include_sanisidro(self):
        with patch.dict(os.environ, {'SANISIDRO_FIXTURE': 'dato_ficticio'}):
            self.supervise()
        self.assertTrue(app.read(self.folder / 'closed.json')['filtered_env'])

    def test_parent_channel_eof_requests_stop(self):
        request = {'parent_pid': os.getpid(), 'run_id': RUN}
        stop = app.parent_channel(io.StringIO(json.dumps(request) + '\n'), request)
        for _ in range(100):
            if stop(): break
            time.sleep(.001)
        self.assertTrue(stop())

    def test_wrong_parent_handshake_rejected(self):
        with self.assertRaises(ValueError): app.parent_channel(io.StringIO('{}\n'), {'parent_pid': 1, 'run_id': RUN})

    def test_supervisor_lock_excludes_second_owner(self):
        path = self.folder / 'supervisor.lock'
        with app.own_lock(path):
            with self.assertRaises(OSError):
                with app.own_lock(path): pass
        with app.own_lock(path): pass

    def test_request_cannot_redirect_database_or_endpoint(self):
        with patch.object(app, 'ROOT', self.folder):
            folder = self.folder / 'datos' / 'sesiones' / RUN
            folder.mkdir(parents=True)
            request = {'protocol': 1, 'parent_pid': 42, 'run_id': RUN, 'seconds': 5}
            app.save(folder / 'request.json', request)
            self.assertEqual(app.request_at(folder), request)
            app.save(folder / 'request.json', request | {'url': 'http://no-permitido'})
            with self.assertRaises(ValueError): app.request_at(folder)
            with self.assertRaises(ValueError): app.request_at(self.folder)

    def test_monitor_error_is_explicit_without_interrupting_child(self):
        calls = [0]
        def stop():
            calls[0] += 1
            return calls[0] > 1
        def observe(): raise RuntimeError('inventario ficticio no disponible')
        request = {'protocol': 1, 'parent_pid': os.getpid(), 'run_id': RUN, 'seconds': 5}
        result = app.supervise(self.folder, request, observe, stop,
            worker_command=[sys.executable, '-B', '-c', CHILD, str(self.folder), 'ok'])
        self.assertTrue(result['worker_closure_confirmed'])
        self.assertEqual(result['last_watch']['operacion_observada']['status'], 'desconocido')

    def test_parent_interruption_still_collects_owned_child(self):
        def observe(): raise KeyboardInterrupt()
        request = {'protocol': 1, 'parent_pid': os.getpid(), 'run_id': RUN, 'seconds': 5}
        with self.assertRaises(KeyboardInterrupt):
            app.supervise(self.folder, request, observe, lambda: False,
                worker_command=[sys.executable, '-B', '-c', CHILD, str(self.folder), 'ok'])
        result = app.read(self.folder / 'resultado.json')
        self.assertEqual(result['phase'], 'fault')
        self.assertTrue(result['worker_closure_confirmed'])


class WorkerTests(Fixture):
    def start(self, *, secret_error=False, wrong_url=False, loop_error=None):
        sessions = self.folder / 'datos' / 'sesiones'
        folder = sessions / RUN
        folder.mkdir(parents=True)
        app.save(folder / 'request.json', {'protocol': 1, 'parent_pid': os.getpid(), 'run_id': RUN, 'seconds': 5})
        module = types.SimpleNamespace(Delivery=lambda base: self.delivery,
            URL='http://no-permitido' if wrong_url else app.DESTINATION)
        def loop(*args, **kwargs):
            if loop_error is not None:
                raise loop_error
            return run_sender(*args, **kwargs, clock=lambda: self.instant, sleep=self.sleep, utc=at)
        with patch.object(app, 'ROOT', self.folder), patch.object(app, 'BASE', self.base), \
             patch.object(app, 'parent_channel', return_value=lambda: False), \
             patch.object(app, 'load_runtime', return_value=module), patch.object(app, 'run_sender', side_effect=loop), \
             patch.object(self.delivery.lib.secret, 'load', side_effect=OSError('ficticio') if secret_error else None,
                          return_value='sica_'+'a'*64), \
             patch.object(self.delivery.lib.sender, 'HttpTransport', return_value=self.transport):
            code = app.worker(folder)
        return code, app.read(folder / 'closed.json')

    def test_worker_uses_existing_store_and_keeps_credential_out_of_report(self):
        code, receipt = self.start()
        self.assertEqual(code, 0)
        self.assertEqual(receipt['report']['health']['pending_count'], 0)
        self.assertNotIn('sica_', json.dumps(receipt))

    def test_dpapi_error_never_reaches_transport(self):
        code, receipt = self.start(secret_error=True)
        self.assertEqual(code, 1)
        self.assertEqual(receipt['report']['phase'], 'fault')
        self.assertFalse(self.transport.calls)

    def test_destination_cannot_be_production(self):
        code, receipt = self.start(wrong_url=True)
        self.assertEqual(code, 1)
        self.assertEqual(receipt['report']['error_type'], 'ValueError')
        self.assertFalse(self.transport.calls)

    def test_permission_report_keeps_codes_without_paths_or_secret_text(self):
        error = PermissionError(13, 'ruta_ficticia_y_secreto_que_no_se_debe_publicar')
        error.winerror = 5
        error.snapshot_operation, error.snapshot_role = 'replace_snapshot', 'sender.json'
        code, receipt = self.start(loop_error=error)
        self.assertEqual(code, 1)
        report = receipt['report']
        self.assertEqual(report['error_stage'], 'sender_loop')
        self.assertEqual(report['os_winerror'], 5)
        self.assertEqual(report['snapshot_role'], 'sender.json')
        self.assertNotIn('secreto_que_no_se_debe_publicar', json.dumps(report))


if __name__ == '__main__':
    unittest.main()
