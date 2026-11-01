"""Servicio completo con reloj/SDK/API ficticios y SQLite real temporal."""
import copy
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import servicio_integrado as service
import emisor_servicio as emitter
from outbox import Outbox
import test_agente as existing
import test_coordinador as fixtures


class ServiceTests(unittest.TestCase):
    def setUp(self):
        base = ROOT / 'datos' / 'pruebas_servicio'
        base.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=base)
        self.folder = Path(self.temp.name)
        self.box = Outbox(self.folder / 'outbox.sqlite', existing.AGENT, existing.SERIAL)
        self.t = 0.
        self.events, self.official, self.states = [], [], []
        self.gate = service.SDKGate()
        self.sender = types.SimpleNamespace(start=Mock(), close=Mock(return_value=True),
            snapshot=Mock(return_value={'phase': 'idle', 'last_ack_utc': None}))

    def tearDown(self):
        self.box.close()
        self.temp.cleanup()

    def advance(self, value):
        self.t += value

    def make(self, *, applying=True, cycle_error=None, close_error=False, **kwargs):
        owner = self
        def cycle():
            owner.assertIsNone(owner.gate.active)
            self.events.append(('cycle', self.t))
            self.gate.acquire('vigencias')
            self.t += .1
            self.gate.release('vigencias', clean=True)
            if cycle_error:
                raise cycle_error
            return {'mode': 'apply' if applying else 'readonly',
                    'status': 'verified' if applying else 'compared'}
        class RT:
            def connect(self):
                owner.gate.acquire('rt')
                owner.events.append(('connect', owner.t))
            def read(self):
                owner.events.append(('read', owner.t))
                return fixtures.item()
            def close(self):
                owner.events.append(('close', owner.t))
                owner.gate.release('rt', clean=not close_error)
                if close_error:
                    raise service.UnsafeClosure('fixture close failure')
        return service.Service(cycle, self.box, RT, self.sender, self.gate, applying=applying,
            clock=lambda: self.t, sleep=self.advance, utc=lambda: '2026-10-26T01:00:%02dZ' % int(self.t),
            cycle_interval=2, state_interval=1, publish=self.states.append,
            publish_official=self.official.append, observed=lambda: dict(fixtures.OBSERVED), **kwargs)

    def test_priority_and_confirmed_rt_close_before_every_cycle(self):
        result = self.make().run(7)
        self.assertEqual('stopped', result['phase'])
        self.assertTrue(result['closures_confirmed'])
        self.assertGreaterEqual(result['cycle']['completed'], 3)
        self.assertEqual('cycle', self.events[0][0])
        self.assertIsNone(self.gate.active)
        self.sender.close.assert_called_once()
        cycles = [i for i, entry in enumerate(self.events) if entry[0] == 'cycle']
        self.assertTrue(all(self.events[i-1][0] == 'close' for i in cycles[1:]))

    def test_official_success_only_from_verified_apply_not_rt_or_sender(self):
        self.make(cycle_error=OSError('fixture API unavailable')).run(5)
        self.assertTrue(any(event[0] == 'read' for event in self.events))
        self.assertTrue(all(s['last_ok_utc'] is None for s in self.official))
        self.assertGreater(self.official[-1]['consecutive_errors'], 1)

    def test_readonly_does_not_publish_official_protocol2(self):
        result = self.make(applying=False).run(4)
        self.assertEqual([], self.official)
        self.assertGreater(result['cycle']['completed'], 0)
        bodies = [json.loads(row[0]) for row in self.box.db.execute("SELECT body FROM messages WHERE endpoint='estado'")]
        self.assertTrue(bodies)
        self.assertTrue(all(body['vigencias'] == fixtures.OBSERVED for body in bodies))

    def test_noop_verified_cycle_is_success_without_manufacturing_changes(self):
        result = self.make().run(1)
        self.assertEqual(1, result['cycle']['completed'])
        self.assertIsNotNone(self.official[-1]['last_ok_utc'])

    def test_http_worker_failure_does_not_stop_vigencias(self):
        self.sender.snapshot.side_effect = RuntimeError('fixture dead sender')
        result = self.make().run(5)
        self.assertGreaterEqual(result['cycle']['completed'], 3)
        self.assertEqual('RuntimeError', result['sender_error'])

    def test_missing_sender_snapshot_recovers_only_with_live_fresh_sender_and_ack(self):
        current = self.make()
        self.sender.snapshot.side_effect = [FileNotFoundError('startup fixture'),
            {'phase': 'idle', 'process_exited': False,
             'heartbeat_utc': '2026-10-26T01:00:00Z', 'last_ack_utc': '2026-10-26T01:00:00Z'}]
        current.watch_sender()
        self.assertEqual('FileNotFoundError', current.state['sender_error'])
        official = copy.deepcopy(current.official)
        current.watch_sender()
        self.assertIsNone(current.state['sender_error'])
        self.assertEqual(official, current.official)

    def test_sender_recovery_does_not_hide_fault_blocked_stale_or_missing_ack(self):
        good = {'phase': 'idle', 'process_exited': False,
                'heartbeat_utc': '2026-10-26T01:00:00Z', 'last_ack_utc': '2026-10-26T01:00:00Z'}
        cases = [dict(good, phase='fault'), dict(good, phase='blocked'),
                 dict(good, heartbeat_utc='2026-10-26T00:59:00Z'),
                 dict(good, last_ack_utc='2026-10-26T00:59:00Z'),
                 dict(good, last_ack_utc=None), dict(good, heartbeat_utc='bad'),
                 dict(good, last_ack_utc='2026-10-26T01:01:00Z')]
        for snapshot in cases:
            with self.subTest(snapshot=snapshot):
                current = self.make()
                current.state['sender_error'] = 'FileNotFoundError'
                self.sender.snapshot.return_value = snapshot
                current.watch_sender()
                self.assertEqual('FileNotFoundError', current.state['sender_error'])

    def test_dead_sender_is_still_reported_when_snapshot_file_recovers(self):
        current = self.make()
        current.state['sender_error'] = 'FileNotFoundError'
        self.sender.snapshot.return_value = {'phase': 'idle', 'process_exited': True,
            'heartbeat_utc': '2026-10-26T01:00:00Z', 'last_ack_utc': '2026-10-26T01:00:00Z'}
        current.watch_sender()
        self.assertEqual('sender_exited', current.state['sender_error'])

    def test_disk_capacity_stops_rt_but_not_closed_vigencias(self):
        with patch.object(self.box, 'ensure_capture_capacity', side_effect=OSError('fixture full')):
            result = self.make().run(5)
        self.assertGreaterEqual(result['cycle']['completed'], 3)
        self.assertFalse(any(event[0] == 'connect' for event in self.events))
        self.assertEqual('OSError', result['storage_error'])

    def test_outbox_failure_keeps_original_and_stops_further_consumption(self):
        run = self.make()
        originals = self.folder / 'originales'
        originals.mkdir()
        previous = run.rt_factory
        def factory():
            value = previous()
            def read():
                self.events.append(('read', self.t))
                key = fixtures.captura_rt.persist_receipt(originals, fixtures.EVENT+b'\0', 1,
                    fixtures.START, fixtures.END, None, None)
                return fixtures.captura_rt.receipt(originals, key)
            value.read = read
            return value
        run.rt_factory = factory
        with patch.object(self.box, 'capture', side_effect=OSError('fixture SQLite full')):
            result = run.run(5)
        self.assertEqual(1, sum(e[0] == 'read' for e in self.events))
        self.assertGreaterEqual(result['cycle']['completed'], 3)
        self.assertEqual(1, fixtures.captura_rt.recover(originals, self.box))

    def test_uncertain_disconnect_aborts_before_second_cycle_and_collects_sender(self):
        run = self.make(close_error=True)
        with self.assertRaises(service.StopUnconfirmed):
            run.run(5)
        self.assertEqual(1, sum(e[0] == 'cycle' for e in self.events))
        self.assertEqual('fault', run.state['phase'])
        self.assertFalse(run.state['closures_confirmed'])
        self.assertNotEqual('stopped', self.official[-1]['phase'])
        self.sender.close.assert_called_once()

    def test_partial_application_review_is_fatal_and_never_opens_rt(self):
        run = self.make(cycle_error=service.ReviewRequired('fixture partial write'))
        with self.assertRaises(service.ReviewRequired):
            run.run(5)
        self.assertFalse(any(e[0] == 'connect' for e in self.events))
        self.assertEqual('fault', run.state['phase'])

    def test_stop_before_start_never_touches_sdk(self):
        result = self.make(stop=lambda: True).run(5)
        self.assertEqual([], self.events)
        self.assertEqual('requested', result['stop_reason'])
        self.assertTrue(result['closures_confirmed'])

    def test_unconfirmed_sender_exit_prevents_stopped(self):
        self.sender.close.return_value = False
        run = self.make()
        with self.assertRaises(service.StopUnconfirmed):
            run.run(2)
        self.assertEqual('fault', run.state['phase'])
        self.assertFalse(run.state['closures_confirmed'])

    def test_stop_between_operations_collects_rt_and_sender(self):
        run = self.make(stop=lambda: any(e[0] == 'read' for e in self.events))
        result = run.run(10)
        self.assertEqual('requested', result['stop_reason'])
        self.assertEqual('close', self.events[-1][0])
        self.assertTrue(result['closures_confirmed'])

    def test_official_publish_failure_stops_sdk_work(self):
        run = self.make()
        run.publish_official = Mock(side_effect=OSError('fixture no state disk'))
        with self.assertRaises(OSError):
            run.run(5)
        self.assertEqual([], self.events)
        self.sender.close.assert_called_once()

    def test_continuous_core_has_cooperative_stop_without_trial_deadline(self):
        run = self.make(stop=lambda: self.t > 185)
        result = run.run()
        self.assertEqual('requested', result['stop_reason'])
        self.assertGreater(self.t, 180)
        self.assertGreater(result['cycle']['completed'], 60)

    def test_busy_gate_return_is_never_counted_as_success(self):
        run = self.make()
        def invalid():
            self.gate.acquire('vigencias')
            return {'mode': 'apply', 'status': 'verified'}
        run.cycle = invalid
        with self.assertRaises(service.StopUnconfirmed):
            run.run(5)
        self.assertEqual(0, run.state['cycle']['completed'])

    def test_readonly_runner_rejects_applying_cycle_before_any_child_can_start(self):
        cycle = Mock()
        cycle.applying = True
        with self.assertRaises(ValueError):
            service.Service(cycle,self.box,Mock(),self.sender,self.gate,applying=False)
        self.sender.start.assert_not_called()


class SenderLoopTests(unittest.TestCase):
    def test_retry_preserves_null_last_ack_and_does_not_fake_transport_health(self):
        states = []
        box = types.SimpleNamespace(health=lambda: {'paused': False})
        sender = types.SimpleNamespace(once=Mock(return_value='retry'))
        result = emitter.loop(box, sender, states.append, lambda: len(states) > 6, sleep=lambda _: None)
        self.assertIsNone(result['last_ack_utc'])
        self.assertEqual('retry', result['last_outcome'])

    def test_ack_only_set_after_sender_accepts_ack(self):
        states = []
        box = types.SimpleNamespace(health=lambda: {'paused': False})
        sender = types.SimpleNamespace(once=Mock(side_effect=['acked', 'idle']))
        emitter.loop(box, sender, states.append, lambda: len(states) >= 5, sleep=lambda _: None)
        self.assertIsNone(states[0]['last_ack_utc'])
        self.assertIsNotNone(states[-1]['last_ack_utc'])

    def test_blocked_queue_prevents_another_http_attempt(self):
        sender = types.SimpleNamespace(once=Mock())
        result = emitter.loop(types.SimpleNamespace(health=lambda: {'paused': True}), sender,
                              lambda _: None, lambda: False)
        sender.once.assert_not_called()
        self.assertEqual('blocked', result['phase'])

    def test_emitter_source_does_not_import_sdk_modules(self):
        import ast
        tree = ast.parse((ROOT / 'emisor_servicio.py').read_text())
        names = {node.module for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)}
        names |= {alias.name for node in ast.walk(tree) if isinstance(node, ast.Import) for alias in node.names}
        self.assertFalse(names & {'ctypes', 'pyodbc', 'transporte_aplicador', 'adaptadores_cierre', 'servicio_integrado'})


if __name__ == '__main__':
    unittest.main()
