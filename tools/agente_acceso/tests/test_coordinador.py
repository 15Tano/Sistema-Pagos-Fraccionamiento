import contextlib
import ctypes
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
import uuid

import test_agente as existing
import captura_rt
from coordinador import Coordinator, classify
from outbox import Outbox
from referencia_vigencias import ReferenceProbe, load_reference

EVENT = b'2026-10-24 19:01:04,693,12345678,1,0,0,4\r\n'
STATUS = b'2026-10-24 19:01:05,0,0,0,255,0,0\r\n'
START = '2026-10-25T01:01:04.000000Z'
END = '2026-10-25T01:01:04.100000Z'
OBSERVED = {'protocol': 2, 'pid': 1234, 'phase': 'stopped', 'consecutive_errors': 2,
            'last_ok_utc': '2026-10-24T00:00:00Z', 'last_error_type': 'NetworkError'}


def item(raw=EVENT, code=1, terminated=True):
    return {'raw': raw, 'sdk_return_code': code, 'response_id': str(uuid.uuid4()),
            'started_utc': START, 'ended_utc': END, 'terminated': terminated,
            'pc_local_time': '2026-10-24T19:01:04-06:00', 'windows_timezone': 'Central Standard Time (Mexico)'}


class CoordinatorTests(unittest.TestCase):
    def setUp(self):
        existing.TRIAL.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=existing.TRIAL)
        self.directory = Path(self.temp.name)
        self.box = Outbox(self.directory / 'outbox.sqlite', existing.AGENT, existing.SERIAL)
        self.clock = 0.
        self.clients, self.operations = [], []

    def tearDown(self):
        self.box.close()
        existing.cleanup_trial(self.temp)

    def advance(self, seconds):
        self.clock += seconds

    def make(self, *, probe_error=False, read=None, close_error=False, **kwargs):
        test = self
        def probe():
            self.assertTrue(all(c.closed for c in self.clients))
            self.operations.append(('probe', self.clock))
            self.clock += .1
            if probe_error:
                raise OSError('Sin red ficticio')
        class RT:
            def __init__(self):
                if any(not c.closed for c in test.clients):
                    raise AssertionError('Solapamiento RT')
                self.closed = False
                test.clients.append(self)
            def connect(self):
                test.operations.append(('connect', test.clock))
            def read(self):
                test.operations.append(('read', test.clock))
                test.clock += .01
                return read() if read else item()
            def close(self):
                self.closed = True
                test.operations.append(('close', test.clock))
                if close_error:
                    raise captura_rt.UnsafeClosure('Simulated unclean SDK shutdown')
        return Coordinator(self.box, probe, RT, clock=lambda: self.clock, sleep=self.advance,
                           cycle_interval=2, observed_state=lambda: dict(OBSERVED), **kwargs)

    def test_cycle_priority_closes_rt_and_preserves_observed_vigencias(self):
        coordinator = self.make()
        state = coordinator.run(seconds=6)
        self.assertGreaterEqual(state['cycle_probe']['completed'], 3)
        self.assertEqual('stopped', state['phase'])
        self.assertTrue(all(c.closed for c in self.clients))
        self.assertEqual('probe', self.operations[0][0])
        states = [json.loads(row[0]) for row in self.box.db.execute("SELECT body FROM messages WHERE endpoint='estado'")]
        self.assertTrue(states)
        self.assertTrue(all(s['vigencias'] == OBSERVED for s in states))
        self.assertEqual(2, state['observed_vigencias']['consecutive_errors'])
        self.assertNotEqual(state['sdk']['last_ok_utc'], OBSERVED['last_ok_utc'])

    def test_stop_before_start_does_not_connect_or_run_cycle(self):
        state = self.make(stop=lambda: True).run(seconds=6)
        self.assertEqual([], self.operations)
        self.assertEqual('requested', state['stop_reason'])

    def test_stop_file_is_bound_to_pid_and_run_id(self):
        import ensayo_coordinador as trial
        run_id = str(uuid.uuid4())
        captura_rt.atomic_json(self.directory / 'estado.json', {
            'phase': 'waiting', 'pid': os.getpid(), 'run_id': run_id})
        with patch.object(trial, 'MANUAL', self.directory), patch('sys.stdout', io.StringIO()):
            trial.request_stop()
        self.assertTrue(trial.stop_requested(self.directory, run_id))
        self.assertFalse(trial.stop_requested(self.directory, str(uuid.uuid4())))
        request = json.loads((self.directory / 'detener.json').read_text())
        request['pid'] += 1
        captura_rt.atomic_json(self.directory / 'detener.json', request)
        self.assertFalse(trial.stop_requested(self.directory, run_id))

    def test_stop_after_read_closes_rt_without_starting_another_cycle(self):
        coordinator = self.make(stop=lambda: any(op == 'read' for op, _ in self.operations))
        state = coordinator.run(seconds=6)
        self.assertEqual('requested', state['stop_reason'])
        self.assertEqual(1, len([op for op, _ in self.operations if op == 'probe']))
        self.assertTrue(all(c.closed for c in self.clients))

    def test_unclean_close_aborts_before_next_cycle(self):
        coordinator = self.make(close_error=True)
        with self.assertRaises(captura_rt.UnsafeClosure):
            coordinator.run(seconds=6)
        self.assertEqual(1, len([op for op, _ in self.operations if op == 'probe']))
        self.assertEqual('fault', coordinator.state['phase'])

    def test_unsafe_cycle_adapter_never_opens_rt(self):
        coordinator = self.make()
        coordinator.cycle_probe = lambda: (_ for _ in ()).throw(captura_rt.UnsafeClosure('pending child'))
        with self.assertRaises(captura_rt.UnsafeClosure):
            coordinator.run(seconds=5)
        self.assertEqual([], self.clients)
        self.assertEqual('fault', coordinator.state['phase'])

    def test_capacity_failure_stops_rt_but_not_future_cycle_probes(self):
        with patch.object(self.box, 'ensure_capture_capacity', side_effect=OSError('no space')):
            state = self.make().run(seconds=6)
        self.assertEqual([], self.clients)
        self.assertGreaterEqual(state['cycle_probe']['completed'], 3)
        self.assertEqual('OSError', state['storage_error'])

    def test_failure_after_sdk_does_not_consume_more_rt_and_original_is_recoverable(self):
        folder = self.directory / 'originales'
        folder.mkdir()
        def read():
            key = captura_rt.persist_receipt(folder, EVENT + b'\0', 1, START, END, None, None)
            return captura_rt.receipt(folder, key)
        with patch.object(self.box, 'capture', side_effect=OSError('write failed')):
            state = self.make(read=read).run(seconds=6)
        self.assertEqual(1, len([op for op, _ in self.operations if op == 'read']))
        self.assertGreaterEqual(state['cycle_probe']['completed'], 3)
        self.assertEqual(1, captura_rt.recover(folder, self.box))
        self.assertEqual(1, captura_rt.recover(folder, self.box))
        self.assertEqual(1, self.box.health()['responses'])

    def test_sdk_error_unknown_or_unterminated_payload_kept_without_more_reads(self):
        for raw, code, terminated in [(b'\xff\0error', -2, True), (b'unknown', 1, True),
                                      (EVENT, 1, False), (b'', 0, True)]:
            with self.subTest(code=code, raw=raw):
                self.clock, self.operations, self.clients = 0, [], []
                before = self.box.health()['responses']
                state = self.make(read=lambda: item(raw, code, terminated)).run(seconds=4)
                self.assertTrue(state['reader_error'])
                self.assertEqual(before + 1, self.box.health()['responses'])
                self.assertEqual(1, len([op for op, _ in self.operations if op == 'read']))

    def test_cycle_probe_failure_is_not_masked_by_successful_rt(self):
        state = self.make(probe_error=True, read=lambda: item(STATUS)).run(seconds=5)
        self.assertGreaterEqual(state['cycle_probe']['consecutive_errors'], 2)
        self.assertIsNone(state['cycle_probe']['last_completed_utc'])
        self.assertIsNotNone(state['sdk']['last_ok_utc'])
        self.assertEqual(OBSERVED['last_ok_utc'], state['observed_vigencias']['last_ok_utc'])

    def test_classification_never_treats_255_as_a_vehicle_event(self):
        self.assertEqual('status_observed', classify(item(STATUS)))
        self.assertEqual('catching_up', classify(item(EVENT + STATUS)))
        self.assertEqual('unknown', classify(item(b'x' * 7)))

    def test_reference_is_unchanged_and_adapter_never_applies_dates(self):
        reference = load_reference()  # Verifica las cuatro fuentes del ZIP r2.
        with patch('referencia_vigencias.load_reference', return_value=reference):
            probe = ReferenceProbe('ficticio')
        with patch.object(reference, 'cycle') as cycle:
            probe()
        cycle.assert_called_once_with('ficticio', False, None)

    def test_receipt_tampering_or_partial_file_prevents_recovery(self):
        folder = self.directory / 'originales'
        folder.mkdir()
        key = captura_rt.persist_receipt(folder, EVENT + b'\0', 1, START, END, None, None)
        (folder / (key + '.payload.bin')).write_bytes(b'changed')
        with self.assertRaises(ValueError):
            captura_rt.recover(folder, self.box)
        self.assertEqual(0, self.box.health()['responses'])

    def test_real_owned_subprocess_strips_secrets_persists_then_exits(self):
        script = self.directory / 'fake_rt.py'
        script.write_text('''import json, pathlib, sys
sys.path.insert(0, sys.argv[1])
from captura_rt import persist_receipt
for line in sys.stdin:
    cmd = json.loads(line)['command']
    if cmd == 'close': break
    result = {'serial':'CO2K225060027'}
    if cmd == 'read':
        key = persist_receipt(pathlib.Path(sys.argv[2]), b'original\\0', -2,
            '2026-10-25T01:00:00Z','2026-10-25T01:00:01Z', None, None)
        result = {'response_id':key}
    print(json.dumps({'ok':True,'result':result}), flush=True)
''', encoding='utf-8')
        actual_popen = subprocess.Popen
        folder = self.directory / 'originales'
        def launch(command, **kwargs):
            self.assertNotIn('SANISIDRO_ACCESS_PASSWORD', kwargs['env'])
            self.assertNotIn('SANISIDRO_API_TOKEN', kwargs['env'])
            return actual_popen([sys.executable, '-B', str(script), str(Path(captura_rt.__file__).parent), str(folder)], **kwargs)
        with patch.dict(os.environ, {'SANISIDRO_ACCESS_PASSWORD':'ficticio', 'SANISIDRO_API_TOKEN':'ficticio'}), \
             patch.object(captura_rt.subprocess, 'Popen', side_effect=launch):
            client = captura_rt.RTClient(folder, sys.executable)
            try:
                client.connect()
                response = client.read()
                captura_rt.capture_in_outbox(self.box, response)
            finally:
                client.close()
        self.assertEqual(0, client.process.poll())
        self.assertEqual(b'original', self.box.db.execute('SELECT raw FROM responses').fetchone()[0])


class WorkerTests(unittest.TestCase):
    def test_worker_denies_connection_without_maintenance(self):
        from unittest.mock import Mock
        sdk = types.SimpleNamespace(Connect=Mock())
        diag = types.SimpleNamespace(load_sdk=lambda: (sdk, types.SimpleNamespace(close=lambda: None), {}),
                                     maintenance_guard=Mock(side_effect=RuntimeError('maintenance missing')))
        existing.TRIAL.mkdir(parents=True, exist_ok=True)
        temp = tempfile.TemporaryDirectory(dir=existing.TRIAL)
        try:
            folder = Path(temp.name) / 'originales'
            folder.mkdir()
            with patch.object(captura_rt, 'diagnostic_module', return_value=diag), \
                 patch('sys.stdin', io.StringIO('{"command":"connect"}\n')), patch('sys.stdout', io.StringIO()):
                captura_rt.worker(folder)
            sdk.Connect.assert_not_called()
        finally:
            existing.cleanup_trial(temp)

    def test_worker_saves_original_before_reply_and_disconnects_on_negative_code(self):
        existing.TRIAL.mkdir(parents=True, exist_ok=True)
        temp = tempfile.TemporaryDirectory(dir=existing.TRIAL)
        sdk = types.SimpleNamespace(Connect=lambda connection: 1,
            GetDeviceParam=lambda handle, buf, size, field: (setattr(buf, 'value', b'~SerialNumber=CO2K225060027') or 0),
            GetRTLog=lambda handle, buf, size: (setattr(buf, 'value', b'negative-original') or -2))
        disconnected = []
        sdk.Disconnect = lambda handle: disconnected.append(handle)
        diag = types.SimpleNamespace(SERIAL='CO2K225060027', CONNECTION=b'ficticio',
            maintenance_guard=lambda: None, load_sdk=lambda: (sdk, types.SimpleNamespace(close=lambda: None), {}),
            pc_timezone=lambda: 'Central Standard Time (Mexico)')
        try:
            folder = Path(temp.name) / 'originales'
            folder.mkdir()
            with patch.object(captura_rt, 'diagnostic_module', return_value=diag), \
                 patch('sys.stdin', io.StringIO('{"command":"connect"}\n{"command":"read"}\n{"command":"close"}\n')), \
                 patch('sys.stdout', io.StringIO()) as output:
                captura_rt.worker(folder)
            replies = [json.loads(line) for line in output.getvalue().splitlines()]
            self.assertTrue(replies[1]['ok'])
            response = captura_rt.receipt(folder, replies[1]['result']['response_id'])
            self.assertEqual(-2, response['sdk_return_code'])
            self.assertEqual(b'negative-original', response['raw'])
            self.assertEqual([1], disconnected)
        finally:
            existing.cleanup_trial(temp)


class CoordinatorLaravelTests(existing.LaravelTests):
    test_lost_ack_after_laravel_commit_replays_same_batch_after_restart = None
    test_state_unicode_digest_and_raw_status_binary_error_responses_match_laravel = None
    test_real_conflict_pauses_original_without_deleting_evidence = None

    def test_coordinator_state_and_every_raw_response_are_accepted_by_laravel(self):
        clock = [0.]
        responses = iter([item(EVENT), item(STATUS), item(b'\xff\0error', -2)])
        class RT:
            def connect(self): pass
            def read(self): return next(responses)
            def close(self): pass
        run = Coordinator(self.box, lambda: None, RT, observed_state=lambda: dict(OBSERVED),
            clock=lambda: clock[0], sleep=lambda seconds: clock.__setitem__(0, clock[0] + seconds))
        run.run(seconds=6)
        self.assertEqual(3, self.box.health()['responses'])
        self.assertEqual(['acked', 'acked', 'idle'], existing.Sender(self.box, self.transport).run())
        self.assertEqual(1, self.server_count('control_acceso_estados'))
        self.assertEqual(3, self.server_count('control_acceso_respuestas'))
        self.assertEqual(2, self.server_count('control_acceso_filas'))


if __name__ == '__main__':
    unittest.main()
