"""Ensayos simulados de presentacion; no cargan DLL ni conectan hardware."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

import captura_controlada as controlled
import lector_eventos as reader

EVENT = reader.rt_rows(b'2026-10-23 19:49:05,724,12230693,2,0,1,4\r\n')[0]
STATUS = reader.rt_rows(b'2026-10-23 20:00:00,0,0,0,255,0,0\r\n')[0]
HISTORY = {'Cardno': '12230693', 'Pin': '724', 'Verified': '4', 'DoorID': '2',
           'EventType': '0', 'InOutState': '1', 'Time_second': '861738545'}


class ControlledTests(unittest.TestCase):
    def test_tuple_conversion_and_multiplicity_match_known_packed_time(self):
        self.assertEqual(HISTORY, controlled.history_event(EVENT))
        self.assertEqual(2, controlled.count_in_history(EVENT, [HISTORY, HISTORY]))
        self.assertEqual(0, controlled.count_in_history(EVENT, [HISTORY | {'EventType': '20'}]))
        self.assertEqual(1, controlled.count_in_history(EVENT, [HISTORY | {'Cardno': '012230693'}]))
        with self.assertRaises(ValueError):
            controlled.history_event(EVENT | {'device_time_raw': 'bad'})

    def run_capture(self, scenario):
        clients, prompts, clock = [], [], [0.0]
        class Client:
            def __init__(self, folder, name):
                if any(not client.closed for client in clients):
                    raise AssertionError('No deben solaparse clientes SDK')
                self.name, self.closed, self.rt, self.history = name, False, 0, 0
                clients.append(self)
            def call(self, command, **kwargs):
                clock[0] += 0.05
                rows = []
                if command == 'rt':
                    self.rt += 1
                    if scenario != 'queue':
                        rows = [STATUS]
                        if self.name == 'Captura_A' and self.rt == 6:
                            rows = [EVENT | {'card': '777'}] if scenario == 'other' else [EVENT]
                            if scenario == 'duplicate':
                                rows = [EVENT, EVENT]
                if command == 'history':
                    assert kwargs['tag'] == '12230693'
                    self.history += 1
                    if scenario == 'failure' and self.name == 'Captura_A' and self.history == 2:
                        raise RuntimeError('historial fallo')
                    old = scenario == 'old'
                    rows = [HISTORY] if old or self.name != 'Captura_A' or self.history > 1 else []
                    if scenario == 'missing':
                        rows = []
                return {'file': self.name + str(self.rt) + '_' + str(self.history), 'rows': rows}
            def close(self):
                self.closed = True
        with tempfile.TemporaryDirectory() as tmp, \
             patch.object(controlled, 'ROOT', Path(tmp)), \
             patch.object(reader, 'load_sdk', return_value=(None, types.SimpleNamespace(close=lambda: None), {})), \
             patch.object(reader, 'maintenance_lock', contextlib.nullcontext), \
             patch.object(reader, 'Client', Client), \
             patch.object(controlled.time, 'monotonic', side_effect=lambda: clock[0]), \
             patch.object(controlled.time, 'sleep', side_effect=lambda seconds: clock.__setitem__(0, clock[0] + seconds)), \
             patch('builtins.input', side_effect=lambda prompt: prompts.append(prompt) or 'pluma de entrada; observacion ficticia'), \
             patch('sys.stdout', io.StringIO()) as output:
            args = types.SimpleNamespace(tag='12230693', pluma='entrada', seconds=5)
            if scenario == 'failure':
                with self.assertRaisesRegex(RuntimeError, 'historial fallo'):
                    controlled.capture(args)
            else:
                controlled.capture(args)
            report = json.loads(next(Path(tmp).rglob('resumen.json')).read_text())
            self.assertTrue(all(client.closed for client in clients))
            return report, clients, prompts, output.getvalue()

    def test_controlled_capture_arms_then_matches_new_history_with_sequential_reconnect(self):
        report, clients, prompts, output = self.run_capture('ok')
        self.assertEqual('rt_and_new_history_confirmed_pending_operator_review', report['status'])
        self.assertEqual(['Captura_A', 'Captura_B_reconexion'], [c.name for c in clients])
        self.assertEqual(2, len(prompts))
        self.assertIn('ARMADO: presente el tag 12230693', output)
        self.assertEqual([False], report['same_event_in_reread'])
        self.assertEqual([False], report['same_event_after_reconnect'])
        self.assertEqual({'history_before': 0, 'history_after': 1, 'history_reread': 1,
                          'history_after_reconnect': 1}, report['correlation'][0]['counts'])

    def test_old_missing_or_insufficient_multiplicity_never_confirm_new_history(self):
        for scenario in ('old', 'missing', 'duplicate'):
            with self.subTest(scenario=scenario):
                report, _, _, _ = self.run_capture(scenario)
                self.assertEqual('rt_captured_history_pending_review', report['status'])

    def test_no_target_or_queue_end_is_inconclusive_and_does_not_reconnect(self):
        for scenario, expected in [('queue', 'queue_end_unconfirmed_not_armed'),
                                   ('other', 'no_target_event_inconclusive')]:
            with self.subTest(scenario=scenario):
                report, clients, prompts, output = self.run_capture(scenario)
                self.assertEqual(expected, report['status'])
                self.assertEqual(1, len(clients))
                self.assertEqual(1, len(prompts))
                if scenario == 'queue':
                    self.assertNotIn('ARMADO: presente', output)

    def test_failure_preserves_selection_and_marks_incomplete(self):
        report, _, _, _ = self.run_capture('failure')
        self.assertEqual('incomplete', report['status'])
        self.assertEqual([EVENT], report['selected_events'])
        self.assertIn('historial fallo', report['error'])


if __name__ == '__main__':
    unittest.main()
