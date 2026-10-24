"""Pruebas sin DLL, red, tareas ni hardware."""
import contextlib
import datetime as dt
import io
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

import lector_eventos as reader


class FakeSDK:
    def __init__(self, fail=False):
        self.fail = fail
        self.disconnected = False

    def Connect(self, connection):
        return 1

    def Disconnect(self, handle):
        self.disconnected = True

    def GetDeviceParam(self, handle, buf, size, field):
        buf.value = ('~SerialNumber=' + reader.SERIAL).encode()
        return 0

    def GetRTLog(self, handle, buf, size):
        buf.value = b'2026-10-23 12:00:00,1,5324916,1,0,0,4\r\n'
        return -3 if self.fail else 1

    def GetDeviceData(self, handle, buf, size, table, fields, condition, options):
        assert table == b'transaction' and condition == b'Cardno=5324916' and options == b''
        buf.value = b'Cardno,Pin,Verified,DoorID,EventType,InOutState,Time_second\r\n5324916,1,4,1,0,0,1\r\n'
        return 1


class ReaderTests(unittest.TestCase):
    def test_status_never_identified_as_card_event(self):
        row = reader.rt_rows(b'2026-10-23 12:00:00,0,5324916,0,255,0,200\r\n')[0]
        self.assertEqual(row['kind'], 'status')

    def test_unknown_format_rejected(self):
        with self.assertRaises(RuntimeError):
            reader.rt_rows(b'not,seven,columns')
        with self.assertRaises(RuntimeError):
            reader.history_rows(b'Cardno,Pin\r\n1,2\r\n', 2)

    def test_raw_error_kept_and_disconnected(self):
        for fail in [False, True]:
            sdk = FakeSDK(fail)
            commands = '\n'.join(json.dumps(c) for c in [
                {'command': 'connect'}, {'command': 'history', 'tag': '5324916'},
                {'command': 'rt'}, {'command': 'close'}])
            output = io.StringIO()
            with tempfile.TemporaryDirectory() as tmp, \
                 patch.object(reader, 'load_sdk', return_value=(sdk, types.SimpleNamespace(close=lambda: None), {})), \
                 patch.object(reader, 'maintenance_guard'), \
                 patch('sys.stdin', io.StringIO(commands)), patch('sys.stdout', output):
                reader.worker(Path(tmp), 'A')
                raw = (Path(tmp) / 'A_0003_GetRTLog.buffer.bin').read_bytes()
                payload = (Path(tmp) / 'A_0003_GetRTLog.payload.bin').read_bytes()
                meta = json.loads((Path(tmp) / 'A_0003_GetRTLog.json').read_text())
                self.assertEqual(len(raw), 65536)
                self.assertEqual(raw.split(b'\0', 1)[0], payload)
                self.assertTrue(sdk.disconnected)
                self.assertEqual(meta['return_code'], -3 if fail else 1)
                self.assertEqual(json.loads(output.getvalue().splitlines()[-1])['ok'], not fail)

    def test_maintenance_denied_before_connect(self):
        sdk = FakeSDK()
        with patch.object(reader, 'load_sdk', return_value=(sdk, types.SimpleNamespace(close=lambda: None), {})), \
             patch.object(reader, 'maintenance_guard', side_effect=RuntimeError('no maintenance')), \
             patch.object(sdk, 'Connect') as connect, \
             patch('sys.stdin', io.StringIO('{"command":"connect"}\n')), patch('sys.stdout', io.StringIO()):
            reader.worker(Path('.'), 'A')
            connect.assert_not_called()

    def test_history_duplicate_loss_detected(self):
        result = reader.history_comparison([{'a': '1'}, {'a': '1'}], [{'a': '1'}])
        self.assertEqual(len(result['missing_rows']), 1)

    def test_session_sdk_failure_closes_clients_and_records_error(self):
        clients = []
        class Client:
            def __init__(self, folder, name):
                self.name, self.closed = name, False
                clients.append(self)
            def call(self, command, **kwargs):
                if self.name == 'B' and command == 'connect':
                    raise RuntimeError('second connection refused')
                return {'rows': []}
            def close(self):
                self.closed = True
        with tempfile.TemporaryDirectory() as tmp, \
             patch.object(reader, 'ROOT', Path(tmp)), \
             patch.object(reader, 'load_sdk', return_value=(None, types.SimpleNamespace(close=lambda: None), {})), \
             patch.object(reader, 'maintenance_lock', contextlib.nullcontext), \
             patch.object(reader, 'Client', Client), patch('sys.stdout', io.StringIO()):
            with self.assertRaisesRegex(RuntimeError, 'second connection'):
                reader.session(types.SimpleNamespace(tag='5324916', pluma='test', seconds=5))
            report = json.loads(next(Path(tmp).rglob('resumen.json')).read_text())
            self.assertEqual(report['status'], 'incomplete')
            self.assertIn('error', report)
            self.assertTrue(all(c.closed for c in clients))

    def test_complete_experiment_keeps_distinct_clients_and_reconnects(self):
        clients = []
        class Client:
            def __init__(self, folder, name):
                self.name, self.closed, self.calls = name, False, []
                clients.append(self)
            def call(self, command, **kwargs):
                self.calls.append(command)
                if command != 'rt':
                    return {'file': self.name, 'rows': []}
                # Baseline first, then controlled event for each first reader.
                count = self.calls.count('rt')
                payload = f'2026-10-23 12:00:0{count},1,5324916,1,0,0,4\r\n'.encode()
                rows = reader.rt_rows(payload) if count == 2 or (self.name == 'B' and count == 4) else []
                return {'file': self.name, 'rows': rows}
            def close(self):
                self.closed = True
        with tempfile.TemporaryDirectory() as tmp, \
             patch.object(reader, 'ROOT', Path(tmp)), \
             patch.object(reader, 'load_sdk', return_value=(None, types.SimpleNamespace(close=lambda: None), {})), \
             patch.object(reader, 'maintenance_lock', contextlib.nullcontext), \
             patch.object(reader, 'Client', Client), patch('builtins.input', return_value='observado'), \
             patch('sys.stdout', io.StringIO()):
            reader.session(types.SimpleNamespace(tag='5324916', pluma='test', seconds=5))
            report = json.loads(next(Path(tmp).rglob('resumen.json')).read_text())
            self.assertEqual(report['status'], 'captured_pending_review')
            self.assertEqual([r['first'] for r in report['rounds']], ['A', 'B'])
            self.assertIn('history_first_experiment', report)
            self.assertEqual([c.name for c in clients], ['A', 'B', 'C_reconexion'])
            self.assertTrue(all(c.closed for c in clients))

    def test_remote_history_has_no_rt_or_operator_prompts(self):
        for rows in [[{'Cardno': '5324916', 'Time_second': '123'}], []]:
            clients = []
            class Client:
                def __init__(self, folder, name):
                    self.name, self.closed, self.calls = name, False, []
                    clients.append(self)
                def call(self, command, **kwargs):
                    self.calls.append(command)
                    if command not in ('connect', 'history'):
                        raise AssertionError('Remote history must not read RT')
                    return {'file': self.name, 'rows': rows}
                def close(self):
                    self.closed = True
            with tempfile.TemporaryDirectory() as tmp, \
                 patch.object(reader, 'ROOT', Path(tmp)), \
                 patch.object(reader, 'load_sdk', return_value=(None, types.SimpleNamespace(close=lambda: None), {})), \
                 patch.object(reader, 'maintenance_lock', contextlib.nullcontext), \
                 patch.object(reader, 'Client', Client), patch('builtins.input', side_effect=AssertionError('No prompts')), \
                 patch('sys.stdout', io.StringIO()):
                reader.history_session(types.SimpleNamespace(tag='5324916'))
                report = json.loads(next(Path(tmp).rglob('resumen.json')).read_text())
                self.assertEqual(len(report['snapshots']), 5)
                self.assertEqual(len(report['comparisons']), 4)
                expected = 'history_captured_pending_review' if rows else 'history_empty_pending_review'
                self.assertEqual(report['status'], expected)
                self.assertEqual([c.name for c in clients], ['A', 'B', 'C_reconexion'])
                self.assertTrue(all(c.closed for c in clients))


    def test_sequential_clients_never_overlap_and_close_on_failure(self):
        for fail in [False, True]:
            clients = []
            class Client:
                def __init__(self, folder, name):
                    if any(not c.closed for c in clients):
                        raise AssertionError('Two clients alive together')
                    self.name, self.closed = name, False
                    clients.append(self)
                def call(self, command, **kwargs):
                    if command not in ('connect', 'history'):
                        raise AssertionError('RT forbidden')
                    if fail and self.name == 'B' and command == 'history':
                        raise RuntimeError('simulated timeout')
                    return {'file': self.name, 'rows': [{'Cardno': '6344928'}], 'payload_sha256': 'abc'}
                def close(self):
                    self.closed = True
            with tempfile.TemporaryDirectory() as tmp, \
                 patch.object(reader, 'ROOT', Path(tmp)), \
                 patch.object(reader, 'load_sdk', return_value=(None, types.SimpleNamespace(close=lambda: None), {})), \
                 patch.object(reader, 'maintenance_lock', contextlib.nullcontext), \
                 patch.object(reader, 'Client', Client), patch('sys.stdout', io.StringIO()):
                args = types.SimpleNamespace(tag='6344928', historial_secuencial=True)
                if fail:
                    with self.assertRaisesRegex(RuntimeError, 'simulated timeout'):
                        reader.history_session(args)
                else:
                    reader.history_session(args)
                report = json.loads(next(Path(tmp).rglob('resumen.json')).read_text())
                self.assertEqual(report['mode'], 'history_sequential')
                self.assertEqual(report['status'], 'incomplete' if fail else 'history_captured_pending_review')
                if not fail:
                    self.assertIn('B_reread', report['snapshots'])
                    self.assertIn('C_after_reconnect', report['snapshots'])
                self.assertTrue(all(c.closed for c in clients))


    def test_rt_observation_distinguishes_new_baseline_and_no_events(self):
        for scenario in ['new', 'baseline', 'none']:
            clients = []
            event = reader.rt_rows(b'2026-10-23 20:10:00,1,6344928,1,0,0,4\r\n')[0]
            class Client:
                def __init__(self, folder, name):
                    if any(not c.closed for c in clients):
                        raise AssertionError('Overlapping RT clients')
                    self.name, self.closed, self.rt_count = name, False, 0
                    clients.append(self)
                def call(self, command, **kwargs):
                    rows = []
                    if command == 'rt':
                        self.rt_count += 1
                        if scenario == 'new' and ((self.name == 'RT_A' and self.rt_count == 3) or self.name != 'RT_A'):
                            rows = [event]
                        elif scenario == 'baseline' and self.name == 'RT_A' and self.rt_count == 1:
                            rows = [event]
                    elif command == 'history':
                        assert kwargs['tag'] == '6344928'
                        rows = [{'Cardno': '6344928'}]
                    return {'file': self.name + str(self.rt_count), 'rows': rows}
                def close(self):
                    self.closed = True
            with tempfile.TemporaryDirectory() as tmp, \
                 patch.object(reader, 'ROOT', Path(tmp)), \
                 patch.object(reader, 'load_sdk', return_value=(None, types.SimpleNamespace(close=lambda: None), {})), \
                 patch.object(reader, 'maintenance_lock', contextlib.nullcontext), \
                 patch.object(reader, 'Client', Client), patch('builtins.input', side_effect=AssertionError('No physical prompts')), \
                 patch.object(reader.time, 'monotonic', side_effect=[0, 0] if scenario == 'new' else [0, 100]), \
                 patch('sys.stdout', io.StringIO()):
                reader.observe_rt(types.SimpleNamespace(seconds=5))
                report = json.loads(next(Path(tmp).rglob('resumen.json')).read_text())
                self.assertEqual(report['status'], {'new': 'rt_after_baseline_pending_review',
                                                   'baseline': 'rt_baseline_only_pending_review',
                                                   'none': 'rt_no_card_event_inconclusive'}[scenario])
                self.assertTrue(all(c.closed for c in clients))
                if scenario != 'none':
                    self.assertEqual(report['selected_in_reread'], [False])
                    self.assertEqual(report['history_comparison']['missing_rows'], [])
                else:
                    self.assertEqual(len(clients), 1)

    def test_rt_failure_closes_client_and_leaves_incomplete_evidence(self):
        clients = []
        class Client:
            def __init__(self, folder, name):
                self.closed = False
                clients.append(self)
            def call(self, command, **kwargs):
                if command == 'rt':
                    raise RuntimeError('unknown RT format')
                return {'rows': []}
            def close(self):
                self.closed = True
        with tempfile.TemporaryDirectory() as tmp, \
             patch.object(reader, 'ROOT', Path(tmp)), \
             patch.object(reader, 'load_sdk', return_value=(None, types.SimpleNamespace(close=lambda: None), {})), \
             patch.object(reader, 'maintenance_lock', contextlib.nullcontext), \
             patch.object(reader, 'Client', Client), patch('sys.stdout', io.StringIO()):
            with self.assertRaisesRegex(RuntimeError, 'unknown RT format'):
                reader.observe_rt(types.SimpleNamespace(seconds=5))
            report = json.loads(next(Path(tmp).rglob('resumen.json')).read_text())
            self.assertEqual(report['status'], 'incomplete')
            self.assertTrue(all(c.closed for c in clients))


    def test_status_clock_uses_explicit_pc_offset_and_midpoint(self):
        result = {'file': 'test', 'started_local': '2026-10-23T20:00:00-06:00',
                  'ended_local': '2026-10-23T20:00:02-06:00',
                  'started_utc': '2026-10-24T02:00:00+00:00',
                  'ended_utc': '2026-10-24T02:00:02+00:00'}
        sample = reader.status_clock_sample(result, {'device_time_raw': '2026-10-23 19:59:58'})
        self.assertEqual(sample['device_minus_pc_seconds'], -3)
        self.assertEqual(sample['call_seconds'], 2)
        with self.assertRaises(ValueError):
            reader.status_clock_sample({**result, 'ended_local': '2026-10-23T20:00:02-05:00'},
                                       {'device_time_raw': '2026-10-23 19:59:58'})

    def test_drain_bounds_and_requires_separated_statuses_without_intervening_event(self):
        for scenario in ['status', 'limit', 'empty', 'failure']:
            clock = [0.0]
            clients = []
            epoch = dt.datetime.fromisoformat('2026-10-23T20:00:00-06:00')
            class Client:
                def __init__(self, folder, name):
                    self.calls, self.closed = 0, False
                    clients.append(self)
                def call(self, command, **kwargs):
                    if command == 'connect':
                        return {'rows': []}
                    if command != 'rt':
                        raise AssertionError('Only RT is allowed')
                    self.calls += 1
                    if scenario == 'failure':
                        raise RuntimeError('SDK format failure')
                    clock[0] += 0.05
                    point = epoch + dt.timedelta(seconds=clock[0])
                    code = 255 if scenario == 'status' and self.calls not in [1, 3] else 0
                    stamp = point.strftime('%Y-%m-%d %H:%M:%S')
                    rows = reader.rt_rows(f'{stamp},0,0,0,{code},0,200\r\n'.encode())
                    return {'file': str(self.calls), 'rows': [] if scenario == 'empty' else rows,
                            'started_local': point.isoformat(), 'ended_local': point.isoformat(),
                            'started_utc': point.astimezone(dt.timezone.utc).isoformat(),
                            'ended_utc': point.astimezone(dt.timezone.utc).isoformat()}
                def close(self):
                    self.closed = True
            with tempfile.TemporaryDirectory() as tmp, \
                 patch.object(reader, 'ROOT', Path(tmp)), \
                 patch.object(reader, 'load_sdk', return_value=(None, types.SimpleNamespace(close=lambda: None), {})), \
                 patch.object(reader, 'pc_timezone', return_value='Central Standard Time (Mexico)'), \
                 patch.object(reader, 'maintenance_lock', contextlib.nullcontext), \
                 patch.object(reader, 'Client', Client), \
                 patch.object(reader.time, 'monotonic', side_effect=lambda: clock[0]), \
                 patch.object(reader.time, 'sleep', side_effect=lambda seconds: clock.__setitem__(0, clock[0] + seconds)), \
                 patch('sys.stdout', io.StringIO()):
                args = types.SimpleNamespace(seconds=5, max_consultas=15 if scenario == 'status' else 2)
                if scenario == 'failure':
                    with self.assertRaisesRegex(RuntimeError, 'SDK format'):
                        reader.drain_rt(args)
                else:
                    reader.drain_rt(args)
                report = json.loads(next(Path(tmp).rglob('resumen.json')).read_text())
                if scenario == 'status':
                    self.assertEqual(report['status'], 'two_status_responses_pending_clock_review')
                    self.assertEqual(report['event_rows_received'], 2)
                    self.assertGreater(int(report['status_pair'][0]['file']), 3)
                    self.assertGreaterEqual(len(report['poll_files']), 8)
                elif scenario in ('limit', 'empty'):
                    self.assertEqual(report['status'], 'limit_reached_queue_end_unconfirmed')
                    self.assertEqual(clients[0].calls, 2)
                    self.assertNotIn('status_pair', report)
                else:
                    self.assertEqual(report['status'], 'incomplete')
                self.assertTrue(all(c.closed for c in clients))


if __name__ == '__main__':
    unittest.main()
