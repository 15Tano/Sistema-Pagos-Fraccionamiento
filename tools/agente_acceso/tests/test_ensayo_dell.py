import contextlib
import base64
import io
import json
import sqlite3
import unittest
from unittest.mock import patch

import test_agente as existing
import ensayo_dell as trial
from emisor import Sender
import tempfile
from pathlib import Path

TOKEN, TRIAL, cleanup_trial = existing.TOKEN, existing.TRIAL, existing.cleanup_trial


class TrialHelperTests(unittest.TestCase):
    def test_import_accepts_only_expected_identity_and_exact_keys(self):
        data = {'agent_id': trial.AGENT, 'device_serial': trial.SERIAL, 'token': TOKEN}
        self.assertEqual(TOKEN, trial.read_credential(io.BytesIO(json.dumps(data).encode())))
        for changed in (data | {'device_serial': 'CO2K225060027'}, data | {'agent_id': 'wrong'},
                        data | {'url': 'https://example.test'}, data | {'token': 4},
                        data | {'token': 'bad'}):
            with self.assertRaises(ValueError):
                trial.read_credential(io.BytesIO(json.dumps(changed).encode()))
        for raw in (b'x' * 4097, b'{"token":"one","token":"two"}', b'[]'):
            with self.assertRaises(ValueError):
                trial.read_credential(io.BytesIO(raw))

    def test_configure_writes_only_dpapi_and_does_not_echo_secret(self):
        TRIAL.mkdir(parents=True, exist_ok=True)
        temporary = tempfile.TemporaryDirectory(dir=TRIAL)
        try:
            data = Path(temporary.name)
            stdin = io.TextIOWrapper(io.BytesIO(json.dumps({
                'agent_id': trial.AGENT, 'device_serial': trial.SERIAL, 'token': TOKEN}).encode()))
            output = io.StringIO()
            with patch.object(trial, 'DATA', data), patch('sys.stdin', stdin), contextlib.redirect_stdout(output):
                self.assertEqual(0, trial.main(['configurar']))
            self.assertNotIn(TOKEN, output.getvalue())
            self.assertNotIn(TOKEN.encode(), (data / 'credencial.dpapi').read_bytes())
            self.assertEqual(TOKEN, trial.credencial.load(data / 'credencial.dpapi'))
            self.assertEqual([], list(data.glob('*.json')))
        finally:
            cleanup_trial(temporary)


class TrialLaravelTests(existing.LaravelTests):
    # Reuse actual Laravel fixture setup, not the inherited test methods.
    test_lost_ack_after_laravel_commit_replays_same_batch_after_restart = None
    test_state_unicode_digest_and_raw_status_binary_error_responses_match_laravel = None
    test_real_conflict_pauses_original_without_deleting_evidence = None

    def test_seed_is_repeatable_and_laravel_ack_preserves_all_originals(self):
        trial.prepare(self.box)
        first = [dict(row) for row in self.box.db.execute('SELECT * FROM messages ORDER BY rowid')]
        trial.prepare(self.box)
        self.assertEqual(first, [dict(row) for row in self.box.db.execute('SELECT * FROM messages ORDER BY rowid')])
        self.assertEqual(['acked', 'acked', 'idle'], Sender(self.box, self.transport).run(maximum=3))
        self.assertEqual('idle', Sender(self.box, self.transport).once())
        trial.prepare(self.box)
        self.assertEqual(0, self.box.health()['pending_count'])
        self.assertEqual(1, self.server_count('control_acceso_lotes'))
        self.assertEqual(1, self.server_count('control_acceso_estados'))
        self.assertEqual(3, self.server_count('control_acceso_respuestas'))
        self.assertEqual(2, self.server_count('control_acceso_filas'))
        result = trial.report(self.box)
        self.assertEqual(3, len(result['originals']))
        self.assertEqual({'acked': 2}, result['health']['messages'])
        ack = result['messages'][0]['ack']
        self.assertEqual((3, 2, 1, 1, 1), tuple(ack[key] for key in (
            'responses_stored', 'rows_stored', 'events_stored', 'statuses_stored',
            'responses_pending_interpretation')))
        with contextlib.closing(sqlite3.connect(self.directory / 'laravel.sqlite')) as connection:
            self.assertEqual('ok', connection.execute('PRAGMA quick_check').fetchone()[0])
            received = {key: base64.b64decode(raw) for key, raw in connection.execute(
                'SELECT response_id,raw_payload_base64 FROM control_acceso_respuestas')}
            self.assertEqual({key: raw for key, _, raw in trial.FIXTURES}, received)


if __name__ == '__main__':
    unittest.main()
