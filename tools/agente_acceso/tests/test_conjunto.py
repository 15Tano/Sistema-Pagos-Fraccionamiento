"""Orden conjunto y contratos sobre fixtures; nunca llama SDK/tareas/red reales."""
import contextlib
import datetime as dt
import hashlib
import io as output_io
import json
import os
import sqlite3
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
for folder in (ROOT / 'envio', ROOT / 'envio/runtime', ROOT):
    sys.path.insert(0, str(folder))
import ensayo_conjunto as app
from lector_conjunto import run_reader
import envio_vigilado as io
import enlace_candidato as control
from coordinacion_conjunta import coordinate
ORIGINAL_NATIVE = app.native_sdk_process
ORIGINAL_INVENTORY = app.safe_inventory

RUN = '80000000-0000-4000-8000-000000000001'
OLD = '80000000-0000-4000-8000-000000000002'
SENDER = '80000000-0000-4000-8000-000000000003'


class FakeProcess:
    def __init__(self, hooks, role):
        self.hooks, self.role, self.returncode = hooks, role, None
        self.pid = 401 if role == 'sdk' else 402

    def poll(self):
        if self.role == 'sdk' and (self.hooks.instant >= self.hooks.sdk_end or self.hooks.sdk_requested) and not self.hooks.hang:
            self.returncode = 0
        if self.role == 'sender' and (self.hooks.sender_requested or self.hooks.sender_failed):
            self.returncode = 1 if self.hooks.sender_failed else 0
        return self.returncode

    def wait(self, timeout):
        self.hooks.events.append('wait_' + self.role)
        if self.poll() is None:
            raise subprocess.TimeoutExpired('ficticio', timeout)
        return self.returncode

    def kill(self):
        raise AssertionError('No se permite matar SDK/supervisores desde coordinador conjunto.')


class FakeHooks:
    def __init__(self):
        self.instant, self.sdk_end = 0., 1.
        self.events, self.children, self.publications = [], {}, []
        self.sdk_requested = self.sender_requested = self.sender_failed = self.hang = False
        self.sdk_proof_bad = self.sender_proof_bad = self.no_bind = self.stale_state = False
        self.pending = 0
        self.unsafe = False

    def start(self, role, seconds):
        self.events.append('start_' + role)
        process = FakeProcess(self, role)
        self.children[role] = process
        return process

    def bind(self, role, process):
        if self.no_bind and role == 'sdk': return None
        return {'pid': 901 if role == 'sdk' else process.pid, 'run_id': RUN if role == 'sdk' else SENDER}

    def request(self, role, target):
        self.events.append('request_' + role)
        if role == 'sdk': self.sdk_requested = True
        else: self.sender_requested = True

    def proof(self, role, target, returncode):
        self.events.append('proof_' + role)
        if role == 'sdk':
            if 'sender' in self.children:
                assert self.children['sender'].poll() is not None
            if self.sdk_proof_bad: raise RuntimeError('recibo SDK ficticio invalido')
        elif self.sender_proof_bad: raise RuntimeError('recibo emisor ficticio invalido')
        return {'identity': target, 'returncode': returncode}

    def unsafe_sdk(self): self.unsafe = True

    def health(self): return {'pending_count': self.pending, 'paused': False}

    def publish(self, state): self.publications.append(dict(state))


class CoordinationTests(unittest.TestCase):
    def run_graph(self, hooks=None, stopped=lambda: False):
        self.hooks = hooks or FakeHooks()
        def sleep(seconds): self.hooks.instant += seconds
        return coordinate(self.hooks, 5, stopped, clock=lambda: self.hooks.instant, sleep=sleep, drain_seconds=1)

    def test_reader_then_sender_then_joint_proof(self):
        value = self.run_graph()
        self.assertTrue(value['safe_to_resume_candidate'])
        self.assertEqual(value['phase'], 'stopped')
        self.assertLess(self.hooks.events.index('start_sdk'), self.hooks.events.index('start_sender'))
        self.assertLess(self.hooks.events.index('request_sender'), self.hooks.events.index('proof_sdk'))

    def test_stop_is_cooperative_sdk_before_sender(self):
        self.run_graph(stopped=lambda: True)
        self.assertLess(self.hooks.events.index('request_sdk'), self.hooks.events.index('request_sender'))

    def test_sender_failure_does_not_abort_readonly_window(self):
        hooks = FakeHooks()
        hooks.sender_failed, hooks.sender_proof_bad = True, True
        result = self.run_graph(hooks)
        self.assertTrue(result['sdk_closure_confirmed'])
        self.assertFalse(result['safe_to_resume_candidate'])
        self.assertFalse(hooks.sdk_requested)
        self.assertGreaterEqual(hooks.instant, hooks.sdk_end)

    def test_sdk_hang_not_killed_and_sender_still_collected(self):
        hooks = FakeHooks()
        hooks.hang = True
        value = self.run_graph(hooks, stopped=lambda: True)
        self.assertTrue(hooks.unsafe)
        self.assertFalse(value['sdk_closure_confirmed'])
        self.assertTrue(value['sender_closure_confirmed'])

    def test_sdk_receipt_failure_blocks_resume_and_persists_fault(self):
        hooks = FakeHooks()
        hooks.sdk_proof_bad = True
        result = self.run_graph(hooks)
        self.assertTrue(hooks.unsafe)
        self.assertEqual(result['phase'], 'fault')

    def test_sender_receipt_failure_keeps_sdk_result_separate(self):
        hooks = FakeHooks()
        hooks.sender_proof_bad = True
        value = self.run_graph(hooks)
        self.assertTrue(value['sdk_closure_confirmed'])
        self.assertFalse(hooks.unsafe)
        self.assertFalse(value['sender_closure_confirmed'])

    def test_sdk_identity_unbound_never_starts_sender(self):
        hooks = FakeHooks()
        hooks.no_bind = True
        value = self.run_graph(hooks)
        self.assertNotIn('start_sender', hooks.events)
        self.assertFalse(value['safe_to_resume_candidate'])

    def test_capture_deadline_requests_stop(self):
        hooks = FakeHooks()
        hooks.sdk_end = 999
        self.run_graph(hooks)
        self.assertTrue(hooks.sdk_requested)

    def test_pending_messages_drain_only_bounded_time(self):
        hooks = FakeHooks()
        hooks.pending = 10
        value = self.run_graph(hooks)
        self.assertTrue(value['sdk_closure_confirmed'])
        self.assertLess(hooks.instant, 3)
        self.assertEqual(hooks.pending, 10)

    def test_publication_error_still_requests_reader_stop(self):
        hooks = FakeHooks()
        old = hooks.publish
        def publish(value):
            if value['phase'] == 'running': raise OSError('disco ficticio')
            old(value)
        hooks.publish = publish
        result = self.run_graph(hooks)
        self.assertTrue(hooks.sdk_requested)
        self.assertEqual(result['orchestration_error_type'], 'OSError')

    def test_invalid_duration_starts_nothing(self):
        hooks = FakeHooks()
        for value in (True, 0, 151, '5'):
            with self.assertRaises(ValueError): coordinate(hooks, value, lambda: False)
        self.assertEqual(hooks.events, [])


class IOTests(unittest.TestCase):
    def setUp(self):
        self.scratch = ROOT / 'datos/pruebas_conjunto'
        self.scratch.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=self.scratch)
        self.folder = Path(self.temp.name)
        self.data = self.folder / 'data'
        self.data.mkdir()
        self.started = dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=10)
        self.state = {'pid': 901, 'run_id': RUN, 'scope': 'ensayo_coordinador_sin_escrituras_sdk',
            'adapter_version': '2026.10.24-1', 'phase': 'waiting', 'started_utc': self.started.isoformat(),
            'heartbeat_utc': self.started.isoformat(), 'stop_reason': 'limit',
            'sdk_gate': {'fault': False, 'active': None}, 'cycle_probe': {'completed': 1}}
        self.enterContext(patch.object(app, 'ROOT', self.folder))
        self.enterContext(patch.object(app, 'DATA', self.data))
        self.enterContext(patch.object(app, 'SDK_STATE', self.data / 'state.json'))
        self.enterContext(patch.object(app, 'SDK_STOP', self.data / 'stop.json'))
        self.enterContext(patch.object(app, 'emitter', return_value=io))
        self.native = self.enterContext(patch.object(app, 'native_sdk_process', return_value=True))
        self.inventory = {'tasks': [], 'processes': []}
        self.inspect = types.SimpleNamespace(inventory=lambda: self.inventory,
            argv_windows=control.argv_windows, require_no_readers=control.require_no_readers)
        self.enterContext(patch.object(app, 'inspector', return_value=self.inspect))
        self.enterContext(patch.object(app, 'safe_inventory', side_effect=lambda: self.inventory))
        self.sdk = types.SimpleNamespace(check_ledger=Mock(return_value=1),
            diagnostic_module=lambda: types.SimpleNamespace(maintenance_lock=contextlib.nullcontext))
        self.enterContext(patch.object(app, 'sdk_control', return_value=self.sdk))
        self.hooks = app.Hooks(self.folder, (self.started - dt.timedelta(seconds=1)).isoformat(), {'pid': 900, 'run_id': OLD})
        io.save(app.SDK_STATE, self.state)

    def tearDown(self):
        if not self.folder.resolve().is_relative_to(self.scratch.resolve()): raise RuntimeError('Temporal ajeno.')
        self.temp.cleanup()

    def test_sdk_binding_requires_new_run_time_and_native_path(self):
        process = types.SimpleNamespace(pid=401)
        self.assertEqual(self.hooks.bind('sdk', process), {'pid': 901, 'run_id': RUN})
        self.native.return_value = False
        self.assertIsNone(self.hooks.bind('sdk', process))

    def test_old_snapshot_cannot_bind_new_sdk(self):
        self.hooks.previous = {'pid': 901, 'run_id': RUN}
        self.assertIsNone(self.hooks.bind('sdk', types.SimpleNamespace(pid=401)))

    def test_future_sdk_time_not_accepted(self):
        value = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=60)).isoformat()
        io.save(app.SDK_STATE, self.state | {'started_utc': value, 'heartbeat_utc': value})
        self.assertIsNone(self.hooks.bind('sdk', types.SimpleNamespace(pid=401)))

    def test_sender_identity_must_match_owned_process(self):
        path = self.folder / 'envio'
        path.mkdir()
        io.save(path / 'estado_envio.json', {'pid': 402, 'run_id': SENDER, 'phase': 'running'})
        self.assertIsNotNone(self.hooks.bind('sender', types.SimpleNamespace(pid=402)))
        self.assertIsNone(self.hooks.bind('sender', types.SimpleNamespace(pid=403)))

    def test_changed_sdk_run_refuses_stop(self):
        with self.assertRaises(RuntimeError): self.hooks.request('sdk', {'pid': 901, 'run_id': OLD})
        self.assertFalse(app.SDK_STOP.exists())

    def test_sdk_stop_request_is_bound(self):
        target = {'pid': 901, 'run_id': RUN}
        self.hooks.request('sdk', target)
        self.assertEqual(io.read(app.SDK_STOP), target)

    def proof_fixture(self, run=RUN):
        io.save(app.SDK_STATE, self.state | {'phase': 'stopped'})
        folder = self.data / 'cierres' / 'worker'
        folder.mkdir(parents=True)
        io.save(folder / 'request.json', {'run_id': run, 'role': 'vigencias'})

    def test_sdk_proof_uses_current_run_ledger(self):
        self.proof_fixture()
        proof = self.hooks.proof('sdk', {'pid': 901, 'run_id': RUN}, 0)
        self.assertEqual(proof['closures_acknowledged_total'], 1)

    def test_old_receipts_never_prove_new_run(self):
        self.proof_fixture(OLD)
        with self.assertRaises(RuntimeError): self.hooks.proof('sdk', {'pid': 901, 'run_id': RUN}, 0)

    def test_unknown_process_blocks_sdk_proof(self):
        self.proof_fixture()
        self.inventory['processes'] = [{'pid': 500, 'role': 'other_sanisidro'}]
        with self.assertRaises(RuntimeError): self.hooks.proof('sdk', {'pid': 901, 'run_id': RUN}, 0)

    def test_fault_gate_is_not_clean(self):
        self.proof_fixture()
        value = io.read(app.SDK_STATE)
        io.save(app.SDK_STATE, value | {'sdk_gate': {'fault': True, 'active': None}})
        with self.assertRaises(RuntimeError): self.hooks.proof('sdk', {'pid': 901, 'run_id': RUN}, 0)

    def test_spawn_arguments_are_readonly_and_environment_filtered(self):
        with patch.object(app.subprocess, 'Popen', return_value=Mock()) as spawn, \
             patch.dict(os.environ, {'SANISIDRO_FIXTURE': 'ficticio'}):
            self.hooks.start('sdk', 5)
            first = spawn.call_args
            self.hooks.start('sender', 180)
            second = spawn.call_args
        self.assertNotIn('SANISIDRO_FIXTURE', first.kwargs['env'])
        self.assertNotIn('SANISIDRO_FIXTURE', second.kwargs['env'])
        self.assertNotIn('--aplicar', first.args[0])
        self.assertIn('--ensayo', second.args[0])

    def test_native_binding_rejects_incidental_path(self):
        path = self.folder / 'lector_conjunto.py'
        for prefix, expected in (('-B', True), ('-c', False)):
            row = {'name': 'python.exe', 'command': f'python.exe {prefix} "{path}" --mantenimiento',
                   'created_utc': self.started.isoformat()}
            with patch.object(app.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, json.dumps(row).encode(), b'')):
                self.assertEqual(ORIGINAL_NATIVE(901, self.started.isoformat()), expected)

    def test_watchdog_exception_requires_exact_script_and_hash(self):
        path = self.folder / 'vigilar_sync.py'
        path.write_bytes(b'monitor_ficticio')
        row = {'pid': 501, 'role': 'other_sanisidro', 'command': f'python.exe -B "{path}"'}
        self.inventory['processes'] = [row]
        with patch.object(app, 'MONITOR', path), patch.object(app, 'MONITOR_HASH', hashlib.sha256(path.read_bytes()).hexdigest()):
            self.assertEqual(ORIGINAL_INVENTORY()['processes'][0]['role'], 'external')
            row['role'] = 'other_sanisidro'
            path.write_bytes(b'codigo_distinto')
            self.assertEqual(ORIGINAL_INVENTORY()['processes'][0]['role'], 'other_sanisidro')

    def test_sdk_state_changed_during_proof_is_rejected(self):
        self.proof_fixture()
        def change(_):
            value = io.read(app.SDK_STATE)
            io.save(app.SDK_STATE, value | {'sdk_gate': {'fault': True, 'active': None}})
            return 1
        self.sdk.check_ledger.side_effect = change
        with self.assertRaises(RuntimeError): self.hooks.proof('sdk', {'pid': 901, 'run_id': RUN}, 0)

    def test_final_verifier_does_not_trust_result_without_joint_acceptance(self):
        io.save(self.folder / 'estado_conjunto.json', {'pid': 777, 'run_id': RUN, 'phase': 'stopped'})
        session = self.folder / 'datos/sesiones' / RUN
        session.mkdir(parents=True)
        io.save(session / 'resultado.json', {'pid': 777, 'run_id': RUN, 'safe_to_resume_candidate': False})
        with self.assertRaises(RuntimeError): app.verify_closed()

    def test_reader_adapter_verifies_before_delegating_readonly_manual(self):
        events = []
        module = types.SimpleNamespace(verify_package=lambda: events.append('verify'))
        writer = lambda path, value: None
        def manual(seconds):
            self.assertEqual(events, ['verify'])
            self.assertIs(module.atomic_json, writer)
            self.assertEqual(seconds, 5)
            return 0
        module.manual = manual
        self.assertEqual(run_reader(module, writer, 5), 0)

    def test_reader_adapter_never_runs_unverified_source(self):
        module = types.SimpleNamespace(verify_package=Mock(side_effect=ValueError('ficticio')), manual=Mock())
        with self.assertRaises(ValueError): run_reader(module, io.save, 5)
        module.manual.assert_not_called()

    def test_final_verifier_rechecks_both_proofs_and_rejects_reused_pid(self):
        io.save(self.folder / 'estado_conjunto.json', {'pid': 777, 'run_id': RUN, 'phase': 'stopped'})
        session = self.folder / 'datos/sesiones' / RUN
        session.mkdir(parents=True)
        io.save(session / 'resultado.json', {'pid': 777, 'run_id': RUN, 'safe_to_resume_candidate': True,
            'sdk_launcher_pid': 401, 'sdk_identity': {'pid': 901, 'run_id': RUN}, 'sdk_returncode': 0,
            'sender_identity': {'pid': 402, 'run_id': SENDER}, 'sender_returncode': 0,
            'sender_proof': {'worker_pid': 999}})
        proof = Mock(return_value={'confirmed': True})
        with patch.object(app, 'Hooks', return_value=types.SimpleNamespace(proof=proof)):
            with contextlib.redirect_stdout(output_io.StringIO()): self.assertEqual(app.verify_closed(), 0)
            self.assertEqual(proof.call_count, 2)
            self.inventory['processes'] = [{'pid': 401, 'role': 'external'}]
            with self.assertRaises(RuntimeError): app.verify_closed()


FAKE_PIPELINE = r'''
import json,pathlib,sys,time
sys.path.insert(0,sys.argv[1])
from outbox import Outbox
from protocolo import digest,json_bytes,now
from emisor import Sender
root=pathlib.Path(sys.argv[2]); role=sys.argv[3]
box=Outbox(root/'pipeline.sqlite')
if role=='sdk':
    for index in range(2):
        stamp=now()
        box.capture(b'2026-10-25 12:00:00,1,12345678,1,0,0,4\r\n','rt',1,stamp,stamp)
        box.build_batch()
        time.sleep(.15)
else:
    class Transport:
        def send(self,endpoint,body):
            payload=json.loads(body)
            result={'protocol_version':1,'status':'accepted','agent_id':payload['agent_id'],
                'content_sha256':digest(json_bytes(payload)),'server_received_at_utc':now(),
                'batch_id':payload['batch_id'],'responses_stored':len(payload['responses']),
                'rows_stored':len(payload['responses']),'events_stored':len(payload['responses']),
                'statuses_stored':0,'responses_pending_interpretation':0}
            return 201,result,None
    sender=Sender(box,Transport())
    until=time.monotonic()+8
    while not (root/'stop_sender').exists() and time.monotonic()<until:
        box.build_batch(); sender.once(); time.sleep(.05)
box.close()
'''


class NativePipelineTests(unittest.TestCase):
    def test_owned_fictitious_reader_and_sender_share_real_wal_outbox(self):
        scratch = ROOT / 'datos/pruebas_conjunto'
        scratch.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as temp:
            folder = Path(temp)
            if not folder.resolve().is_relative_to(scratch.resolve()): raise RuntimeError('Temporal ajeno.')
            libraries = ROOT / 'envio/runtime' if (ROOT / 'envio/runtime/outbox.py').exists() else ROOT
            sys.path.insert(0, str(libraries))
            try:
                from outbox import Outbox
                box = Outbox(folder / 'pipeline.sqlite', RUN, 'TEST-JOINT')
                box.close()
            finally:
                sys.path.pop(0)
            children = {}
            class Hooks:
                def start(self, role, seconds):
                    child = subprocess.Popen([sys.executable, '-B', '-c', FAKE_PIPELINE, str(libraries), str(folder), role],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                    children[role] = child
                    return child
                def bind(self, role, process): return {'pid': process.pid, 'run_id': RUN if role == 'sdk' else SENDER}
                def request(self, role, target):
                    if role == 'sender': (folder / 'stop_sender').touch()
                def health(self):
                    with contextlib.closing(sqlite3.connect(folder / 'pipeline.sqlite')) as db:
                        pending = db.execute("SELECT COUNT(*) FROM messages WHERE state!='acked'").fetchone()[0]
                    return {'pending_count': pending, 'paused': False}
                def proof(self, role, target, returncode):
                    if returncode != 0: raise RuntimeError('Hijo ficticio fallo.')
                    return {'identity': target}
                def unsafe_sdk(self): raise AssertionError('No se esperaba fallo de hijo ficticio.')
                def publish(self, value): pass
            try:
                result = coordinate(Hooks(), 5, lambda: False)
                self.assertTrue(result['safe_to_resume_candidate'])
                with contextlib.closing(sqlite3.connect(folder / 'pipeline.sqlite')) as db:
                    self.assertEqual(db.execute('SELECT COUNT(*) FROM responses').fetchone()[0], 2)
                    self.assertTrue(all(bytes(row[0]).endswith(b'\r\n') for row in db.execute('SELECT raw FROM responses')))
                    self.assertEqual(db.execute("SELECT COUNT(*) FROM messages WHERE state='acked'").fetchone()[0], 2)
            finally:
                for child in children.values():
                    if child.poll() is None: child.kill()  # Solo estos hijos ficticios de la prueba, nunca SDK.
                    child.wait(timeout=5)


if __name__ == '__main__':
    unittest.main()
