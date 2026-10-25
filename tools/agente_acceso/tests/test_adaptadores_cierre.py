"""Adaptadores reales, SDK sustituido y procesos Python ficticios; sin caseta."""
import ctypes
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import adaptadores_cierre as adapter
import captura_rt
from coordinador import Coordinator
from outbox import Outbox
from trabajador_controlado import SDKGate

RUN = '60000000-0000-4000-8000-000000000001'
OTHER = '60000000-0000-4000-8000-000000000002'
START = adapter.now()


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.scratch = ROOT / 'datos' / 'pruebas_cierres'
        self.scratch.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=self.scratch)
        self.folder = Path(self.temp.name)
        self.base = self.folder / 'cierres'
        self.children = []

    def tearDown(self):
        for child in self.children:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=10)
            for stream in (child.stdin, child.stdout, child.stderr):
                if stream is not None and not stream.closed:
                    stream.close()
        if not self.folder.resolve().is_relative_to(self.scratch.resolve()):
            raise RuntimeError('Temporal ajeno.')
        self.temp.cleanup()

    def session(self, role='rt'):
        folder = adapter.new_session(self.base, RUN, role)
        return folder, adapter.request_at(folder / 'request.json')

    def closed(self, folder, request, **changes):
        adapter.write_closure(folder, request, started=START, closed=True,
            operation_ok=True, sdk_sha256=adapter.SDK_HASH)
        value = json.loads((folder / 'closed.json').read_text()) | changes
        (folder / 'closed.json').write_text(json.dumps(value), encoding='utf-8')

    def fake_diag(self, *, bad_serial=False, disconnect_error=False):
        events = []
        def disconnect(handle):
            events.append('disconnect')
            if disconnect_error:
                raise RuntimeError('fixture disconnect failure')
        def param(handle, buf, size, field):
            buf.value = b'~SerialNumber=WRONG' if bad_serial else b'~SerialNumber=CO2K225060027'
            return 0
        def data(handle, buf, size, *args):
            buf.value = b'CardNo,Pin,StartTime,EndTime,Password\r\n12345678,42,20200101,20261105,private_fixture\r\n'
            return 1
        sdk = types.SimpleNamespace(Connect=Mock(side_effect=lambda connection: events.append('connect') or 1),
            Disconnect=Mock(side_effect=disconnect), GetDeviceParam=Mock(side_effect=param),
            GetDeviceData=Mock(side_effect=data), SetDeviceData=Mock(side_effect=AssertionError('No writes')))
        directory = types.SimpleNamespace(close=Mock(side_effect=lambda: events.append('directory_close')))
        diag = types.SimpleNamespace(SERIAL='CO2K225060027', CONNECTION=b'fixture',
            load_sdk=Mock(return_value=(sdk, directory, {'sha256': adapter.SDK_HASH})),
            maintenance_guard=Mock(), pc_timezone=lambda: 'Fixture')
        return diag, sdk, directory, events

    def probe(self, *, timeout=10):
        module = types.SimpleNamespace(ROOT=self.folder, cycle=Mock())
        with patch.object(adapter, 'load_reference', return_value=module):
            probe = adapter.SafeReferenceProbe('fixture_password', SDKGate(), self.base, sys.executable, RUN, worker_timeout=timeout)
        return probe

    def fake_launcher(self, kind='inventory', failure=None):
        script = self.folder / ('fake_' + kind + '.py')
        script.write_text('''import hashlib, json, os, pathlib, sys, time
sys.path.insert(0, sys.argv[1])
import adaptadores_cierre as a
from captura_rt import persist_receipt
path = pathlib.Path(sys.argv[2])
r = a.request_at(path)
folder = path.parent
started = a.now()
kind, failure = sys.argv[3], sys.argv[4]
if any(k.upper().startswith('SANISIDRO_') for k in os.environ): raise SystemExit(8)
if failure == 'exit': raise SystemExit(7)
if failure == 'timeout': time.sleep(30)
if failure == 'read_error':
    a.write_closure(folder,r,started=started,closed=True,operation_ok=False,sdk_sha256=a.SDK_HASH,error_type='ValueError')
    raise SystemExit(0)
if kind == 'inventory':
    raw = b'{"12345678":{"CardNo":"12345678","Pin":"42","StartTime":"20200101","EndTime":"20261105"}}'
    (folder/'response.json').write_bytes(raw)
    a.write_closure(folder,r,started=started,closed=True,operation_ok=True,sdk_sha256=a.SDK_HASH,response=raw)
else:
    for line in sys.stdin:
        command = json.loads(line)['command']
        if command == 'close': break
        result = {'serial':'CO2K225060027'}
        if command == 'read':
            key = persist_receipt(pathlib.Path(r['receipts_dir']), b'2026-10-25 00:00:00,0,0,0,255,0,0\\r\\n\\0',1,started,a.now(),None,None)
            result = {'response_id':key}
        print(json.dumps({'ok':True,'result':result}),flush=True)
    if failure != 'missing':
        a.write_closure(folder,r,started=started,closed=True,operation_ok=True,sdk_sha256=a.SDK_HASH)
''', encoding='utf-8')
        actual = subprocess.Popen
        def launch(command, **kwargs):
            self.assertFalse(any(key.upper().startswith('SANISIDRO_') for key in kwargs['env']))
            child = actual([sys.executable, '-B', str(script), str(ROOT), command[-1], kind, failure or 'ok'], **kwargs)
            self.children.append(child)
            return child
        return launch

    def test_closure_is_bound_to_pid_role_run_nonce_and_sdk_hash(self):
        for change in ({'pid': True}, {'pid': 0}, {'run_id': OTHER}, {'worker_id': OTHER},
                       {'role': 'vigencias'}, {'closed': False}, {'sdk_sha256': 'bad'}, {'ended_utc': 'bad'}):
            with self.subTest(change=change):
                folder, request = self.session()
                self.closed(folder, request, **change)
                with self.assertRaises((ValueError, OSError)):
                    adapter.verified_closure(folder, os.getpid())

    def test_ledger_requires_parent_ack_and_rejects_tampering(self):
        folder, request = self.session()
        self.closed(folder, request)
        with self.assertRaises(captura_rt.UnsafeClosure):
            adapter.check_ledger(self.base)
        adapter.acknowledge(folder, os.getpid())
        self.assertEqual(1, adapter.check_ledger(self.base))
        self.closed(folder, request, operation_ok=False, error_type='fixture')
        with self.assertRaises(captura_rt.UnsafeClosure):
            adapter.check_ledger(self.base)

    def test_parent_crash_before_receipt_blocks_next_sdk_start(self):
        self.session()
        with self.assertRaises(captura_rt.UnsafeClosure):
            adapter.check_ledger(self.base)

    def test_persistent_fault_blocks_restart_even_if_no_pending_workers(self):
        self.base.mkdir()
        (self.folder / 'cierre_inseguro.json').write_text('{}')
        with self.assertRaises(captura_rt.UnsafeClosure):
            adapter.check_ledger(self.base)

    def test_request_cannot_redirect_rt_originals_or_enable_apply(self):
        folder, request = self.session()
        request['receipts_dir'] = str(self.folder / 'wrong')
        (folder / 'request.json').write_text(json.dumps(request))
        with self.assertRaises(ValueError):
            adapter.request_at(folder / 'request.json')
        probe = self.probe()
        with self.assertRaises(ValueError):
            probe.read_inventory({'mode': 'apply'})

    def test_inventory_worker_closes_before_receipt_and_excludes_password_fields(self):
        folder, request = self.session('vigencias')
        diag, sdk, directory, events = self.fake_diag()
        with patch.object(adapter, 'diagnostic_module', return_value=diag):
            self.assertEqual(0, adapter.inventory_worker(folder, request))
        self.assertEqual(['connect', 'disconnect', 'directory_close'], events)
        self.assertTrue(adapter.verified_closure(folder, os.getpid())['operation_ok'])
        raw = (folder / 'response.json').read_bytes()
        self.assertNotIn(b'private_fixture', raw)
        self.assertNotIn(b'Password', raw)
        sdk.SetDeviceData.assert_not_called()

    def test_inventory_without_maintenance_never_loads_sdk(self):
        folder, request = self.session('vigencias')
        diag, sdk, directory, events = self.fake_diag()
        diag.maintenance_guard.side_effect = RuntimeError('fixture')
        with patch.object(adapter, 'diagnostic_module', return_value=diag):
            adapter.inventory_worker(folder, request)
        diag.load_sdk.assert_not_called()
        sdk.Connect.assert_not_called()
        with self.assertRaises(ValueError):
            adapter.verified_closure(folder, os.getpid())

    def test_disconnect_failure_produces_nonclean_receipt_and_closes_directory(self):
        folder, request = self.session('vigencias')
        diag, sdk, directory, events = self.fake_diag(disconnect_error=True)
        with patch.object(adapter, 'diagnostic_module', return_value=diag):
            self.assertEqual(1, adapter.inventory_worker(folder, request))
        directory.close.assert_called_once()
        with self.assertRaises(ValueError):
            adapter.verified_closure(folder, os.getpid())

    def test_wrong_controller_serial_prevents_inventory(self):
        folder, request = self.session('vigencias')
        diag, sdk, directory, events = self.fake_diag(bad_serial=True)
        with patch.object(adapter, 'diagnostic_module', return_value=diag):
            adapter.inventory_worker(folder, request)
        sdk.GetDeviceData.assert_not_called()
        self.assertEqual('ControllerIdentityError', adapter.verified_closure(folder, os.getpid())['error_type'])

    def test_inventory_parser_rejects_duplicates_counts_and_unknown_layout(self):
        for raw, code in ((b'', 0), (b'A,B\r\n1,2\r\n', 1),
                          (b'CardNo,Pin,StartTime,EndTime\r\n1,2,a,b\r\n', 2),
                          (b'CardNo,Pin,StartTime,EndTime\r\n1,2,a,b\r\n1,2,a,b\r\n', 2)):
            with self.assertRaises(ValueError):
                adapter.parse_inventory(raw, code)

    def test_reference_adapter_always_calls_comparison_with_apply_false(self):
        probe = self.probe()
        probe()
        probe.module.cycle.assert_called_once_with('fixture_password', False, None)

    def test_real_fake_inventory_process_has_verified_exit_receipt_and_parent_ack(self):
        probe = self.probe()
        with patch('subprocess.Popen', side_effect=self.fake_launcher()), \
             patch.dict(os.environ, {'SANISIDRO_ACCESS_PASSWORD': 'fixture_password'}):
            result = probe.read_inventory({'mode': 'read'})
        self.assertEqual('42', result['12345678']['Pin'])
        self.assertFalse(probe.gate.fault)
        self.assertIsNone(probe.gate.active)
        self.assertEqual(1, adapter.check_ledger(self.base))

    def test_inventory_timeout_is_fatal_for_coordinator_and_does_not_open_rt(self):
        probe = self.probe(timeout=.3)
        probe.module.cycle.side_effect = lambda *args: probe.read_inventory({'mode': 'read'})
        box = Outbox(self.folder / 'outbox.sqlite', OTHER, 'TEST-C3-001')
        rt_factory = Mock()
        run = Coordinator(box, probe, rt_factory)
        try:
            with patch('subprocess.Popen', side_effect=self.fake_launcher(failure='timeout')):
                with self.assertRaises(captura_rt.UnsafeClosure):
                    run.run(seconds=2)
            self.assertEqual('fault', run.state['phase'])
            rt_factory.assert_not_called()
            self.assertTrue((self.folder / 'cierre_inseguro.json').exists())
            self.assertIsNotNone(self.children[0].poll())
            with self.assertRaises(captura_rt.UnsafeClosure):
                adapter.check_ledger(self.base)
        finally:
            box.close()

    def test_nonzero_inventory_exit_latches_fatal_state(self):
        probe = self.probe()
        with patch('subprocess.Popen', side_effect=self.fake_launcher(failure='exit')):
            with self.assertRaises(captura_rt.UnsafeClosure):
                probe.read_inventory({'mode': 'read'})
        self.assertTrue(probe.gate.fault)

    def test_inventory_data_error_with_confirmed_close_is_not_an_unsafe_sdk(self):
        probe = self.probe()
        with patch('subprocess.Popen', side_effect=self.fake_launcher(failure='read_error')):
            with self.assertRaises(RuntimeError) as caught:
                probe.read_inventory({'mode': 'read'})
        self.assertNotIsInstance(caught.exception, captura_rt.UnsafeClosure)
        self.assertFalse(probe.gate.fault)
        self.assertEqual(1, adapter.check_ledger(self.base))

    def test_reference_does_not_spawn_sdk_while_rt_has_the_turn(self):
        probe = self.probe()
        probe.gate.acquire('rt')
        with patch('subprocess.Popen') as launch:
            with self.assertRaises(captura_rt.UnsafeClosure):
                probe.read_inventory({'mode': 'read'})
        launch.assert_not_called()
        self.assertTrue(probe.gate.fault)

    def test_real_fake_rt_process_preserves_original_and_acknowledges_close(self):
        gate = SDKGate()
        client = adapter.SafeRTClient(gate, self.base, sys.executable, RUN)
        with patch('subprocess.Popen', side_effect=self.fake_launcher('rt')):
            try:
                client.connect()
                item = client.read()
                self.assertEqual(1, item['sdk_return_code'])
                self.assertIn(b'255', item['raw'])
            finally:
                client.close()
        self.assertEqual(1, adapter.check_ledger(self.base))
        self.assertFalse(gate.fault)
        self.assertIsNone(gate.active)
        self.assertTrue(list((self.folder / 'originales').glob('*.payload.bin')))

    def test_rt_exit_zero_without_close_receipt_prevents_next_cycle(self):
        gate, clock = SDKGate(), [0.]
        probe = Mock()
        box = Outbox(self.folder / 'outbox.sqlite', OTHER, 'TEST-C3-001')
        run = Coordinator(box, probe, lambda: adapter.SafeRTClient(gate, self.base, sys.executable, RUN),
            cycle_interval=1, clock=lambda: clock[0], sleep=lambda seconds: clock.__setitem__(0, clock[0]+seconds))
        try:
            with patch('subprocess.Popen', side_effect=self.fake_launcher('rt', 'missing')):
                with self.assertRaises(captura_rt.UnsafeClosure):
                    run.run(seconds=3)
            self.assertEqual(1, probe.call_count)
            self.assertEqual('fault', run.state['phase'])
            self.assertTrue(gate.fault)
        finally:
            box.close()

    def test_rt_read_timeout_remains_fatal_even_if_later_disconnect_is_clean(self):
        class FakeClient:
            def __init__(self, folder, python, *, worker_command):
                self.folder = Path(worker_command[-1]).parent
                self.request = adapter.request_at(self.folder / 'request.json')
                self.process = types.SimpleNamespace(pid=os.getpid())
            def connect(self): pass
            def read(self): raise captura_rt.UnsafeClosure('fixture timeout')
            def close(self):
                adapter.write_closure(self.folder, self.request, started=START, closed=True,
                                      operation_ok=True, sdk_sha256=adapter.SDK_HASH)
        gate = SDKGate()
        client = adapter.SafeRTClient(gate, self.base, sys.executable, RUN, client_factory=FakeClient)
        client.connect()
        with self.assertRaises(captura_rt.UnsafeClosure):
            client.read()
        client.close()
        self.assertTrue(gate.fault)
        with self.assertRaises(captura_rt.UnsafeClosure):
            adapter.check_ledger(self.base)

    def test_rt_worker_writes_receipt_only_after_disconnect_and_directory_close(self):
        folder, request = self.session()
        Path(request['receipts_dir']).mkdir()
        diag, sdk, directory, events = self.fake_diag()
        directory.close.side_effect = lambda: (self.assertFalse((folder / 'closed.json').exists()), events.append('directory_close'))
        with patch.object(captura_rt, 'diagnostic_module', return_value=diag), \
             patch('sys.stdin', io.StringIO('{"command":"connect"}\n{"command":"close"}\n')), \
             patch('sys.stdout', io.StringIO()):
            self.assertEqual(0, adapter.rt_worker(folder, request))
        self.assertEqual(['connect', 'disconnect', 'directory_close'], events)
        adapter.acknowledge(folder, os.getpid())
        self.assertEqual(1, adapter.check_ledger(self.base))

    def test_rt_disconnect_failure_is_not_a_confirmed_close(self):
        folder, request = self.session()
        Path(request['receipts_dir']).mkdir()
        diag, sdk, directory, events = self.fake_diag(disconnect_error=True)
        with patch.object(captura_rt, 'diagnostic_module', return_value=diag), \
             patch('sys.stdin', io.StringIO('{"command":"connect"}\n{"command":"close"}\n')), \
             patch('sys.stdout', io.StringIO()):
            self.assertEqual(1, adapter.rt_worker(folder, request))
        directory.close.assert_called_once()
        with self.assertRaises(ValueError):
            adapter.verified_closure(folder, os.getpid())


if __name__ == '__main__':
    unittest.main()
