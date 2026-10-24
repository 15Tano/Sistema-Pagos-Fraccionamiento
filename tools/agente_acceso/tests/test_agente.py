import contextlib
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from credencial import load, store
from emisor import HttpTransport, Sender
from outbox import Outbox
from protocolo import digest, json_bytes, now

ROOT = Path(__file__).resolve().parents[3]
TRIAL = ROOT / 'backend/storage/app/agente-acceso-ensayo'
AGENT = '10000000-0000-4000-8000-000000000001'
SERIAL = 'TEST-C3-001'
TOKEN = 'sica_' + 'f' * 64
RAW = b'2026-10-23 19:49:05,42,12345678,2,0,1,4\r\n'
START = '2026-10-24T02:12:01.854246Z'
END = '2026-10-24T02:12:01.951000Z'


def snapshot():
    return {'reported_at_utc': END, 'agent_version': 'ensayo-1', 'pid': 100,
            'vigencias': {'protocol': 2, 'pid': 100, 'phase': 'idle', 'consecutive_errors': 0},
            'sdk': {'last_ok_utc': None}, 'reader': {'state': 'unknown'},
            'sender': {'pending_count': 1}}


def cleanup_trial(temporary):
    if not Path(temporary.name).resolve().is_relative_to(TRIAL.resolve()):
        raise RuntimeError('Temporal fuera de la carpeta de ensayo.')
    temporary.cleanup()


def good_ack(payload):
    ack = {'protocol_version': 1, 'status': 'accepted', 'agent_id': payload['agent_id'],
           'content_sha256': digest(json_bytes(payload)), 'server_received_at_utc': now()}
    if 'batch_id' in payload:
        ack |= {'batch_id': payload['batch_id'], 'responses_stored': len(payload['responses']),
                'rows_stored': len(payload['responses']), 'events_stored': len(payload['responses']),
                'statuses_stored': 0, 'responses_pending_interpretation': 0}
    else:
        ack |= {'session_id': payload['session_id'], 'sequence': payload['sequence']}
    return ack


class FakeTransport:
    def __init__(self, status=201, mutate=None, retry_after=None):
        self.status, self.mutate, self.retry_after = status, mutate, retry_after
        self.calls = []

    def send(self, endpoint, body):
        self.calls.append((endpoint, body))
        ack = good_ack(json.loads(body))
        if self.mutate:
            ack.update(self.mutate)
        return self.status, ack, self.retry_after


class StorageTests(unittest.TestCase):
    def setUp(self):
        TRIAL.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=TRIAL)
        self.path = Path(self.temp.name) / 'outbox.sqlite'
        self.clock = 1000.0
        self.box = Outbox(self.path, AGENT, SERIAL, clock=lambda: self.clock)

    def tearDown(self):
        self.box.close()
        cleanup_trial(self.temp)

    def capture(self, raw=RAW, **kwargs):
        return self.box.capture(raw, 'rt', 1, START, END, **kwargs)

    def ready(self):
        self.capture()
        return self.box.build_batch()

    def test_originals_and_message_survive_reopen_with_identical_ids_and_hashes(self):
        message_id = self.ready()
        original = dict(self.box.db.execute('SELECT * FROM messages').fetchone())
        self.box.close()
        self.box = Outbox(self.path)
        self.assertEqual(original, dict(self.box.db.execute('SELECT * FROM messages').fetchone()))
        self.assertEqual(RAW, self.box.db.execute('SELECT raw FROM responses').fetchone()[0])
        self.assertEqual(message_id, json.loads(original['body'])['batch_id'])
        self.assertEqual(digest(original['body']), original['sha256'])

    def test_identical_distinct_observations_are_not_collapsed(self):
        first, second = self.capture(), self.capture()
        self.assertNotEqual(first, second)
        self.box.build_batch()
        self.assertEqual(2, len(json.loads(self.box.db.execute('SELECT body FROM messages').fetchone()[0])['responses']))

    def test_capture_uuid_is_idempotent_and_cannot_change_bytes(self):
        key = self.capture()
        self.capture(response_id=key)
        with self.assertRaises(ValueError):
            self.capture(raw=RAW + b'changed', response_id=key)
        self.assertEqual(1, self.box.health()['responses'])

    def test_different_identity_and_unrelated_database_are_rejected(self):
        with self.assertRaises(ValueError):
            Outbox(self.path, AGENT, 'OTHER')
        other = Path(self.temp.name) / 'other.sqlite'
        with contextlib.closing(sqlite3.connect(other)) as connection:
            connection.execute('CREATE TABLE unrelated (id INTEGER)')
        with self.assertRaises(ValueError):
            Outbox(other, AGENT, SERIAL)

    def test_batch_size_and_sequences_are_persistent_and_separate_from_state(self):
        for _ in range(3):
            self.capture()
        self.box.build_batch(maximum=2)
        self.box.build_batch()
        self.box.enqueue_state(snapshot())
        rows = list(self.box.db.execute('SELECT endpoint,sequence,body FROM messages ORDER BY rowid'))
        self.assertEqual([('lotes', 0), ('lotes', 1), ('estado', 0)], [(r[0], r[1]) for r in rows])
        self.assertEqual([2, 1], [len(json.loads(r[2])['responses']) for r in rows[:2]])

    def test_large_responses_split_before_body_limit(self):
        self.capture(raw=b'x' * 500000)
        self.capture(raw=b'x' * 500000)
        self.box.build_batch()
        self.assertEqual(1, self.box.health()['unbatched'])
        self.assertLessEqual(len(self.box.db.execute('SELECT body FROM messages').fetchone()[0]), 1048576)

    def test_disk_full_and_insert_failure_never_ack_or_assign_partial_batches(self):
        with patch('outbox.shutil.disk_usage') as usage:
            usage.return_value.free = 0
            with self.assertRaises(OSError):
                self.capture()
        self.assertEqual(0, self.box.health()['responses'])
        self.capture()
        self.box.db.execute("CREATE TRIGGER deny_assignment BEFORE UPDATE ON responses BEGIN SELECT RAISE(ABORT,'disk failure'); END")
        with self.assertRaises(sqlite3.DatabaseError):
            self.box.build_batch()
        self.assertEqual({}, self.box.health()['messages'])
        self.assertEqual(1, self.box.health()['unbatched'])

    def test_lease_prevents_two_senders_and_recovers_after_restart_deadline(self):
        self.ready()
        first = self.box.claim()
        second = Outbox(self.path, clock=lambda: self.clock)
        try:
            self.assertIsNone(second.claim())
            self.clock += 61
            reclaimed = second.claim()
            self.assertEqual(first['body'], reclaimed['body'])
            self.assertFalse(self.box.finish(first, ack={'stale': True}))
        finally:
            second.close()

    def test_abrupt_process_exit_preserves_wal_batch_and_lease(self):
        script = '''
import os, sys
sys.path.insert(0, sys.argv[1])
from outbox import Outbox
box = Outbox(sys.argv[2], clock=lambda: 1000)
box.capture(b'original', 'rt', -2, '2026-10-24T02:00:00Z', '2026-10-24T02:00:01Z')
box.build_batch()
box.claim()
os._exit(37)
'''
        result = subprocess.run([sys.executable, '-B', '-', str(Path(__file__).resolve().parents[1]), str(self.path)],
                                input=script, text=True, capture_output=True, timeout=10)
        self.assertEqual(37, result.returncode)
        self.assertIsNone(self.box.claim())
        self.clock += 61
        reclaimed = self.box.claim()
        self.assertEqual(2, reclaimed['attempts'])
        self.assertEqual(b'original', self.box.db.execute('SELECT raw FROM responses').fetchone()[0])

    def test_sqlite_full_rolls_back_new_capture_and_preserves_previous_original(self):
        self.capture()
        pages = self.box.db.execute('PRAGMA page_count').fetchone()[0]
        self.box.db.execute('PRAGMA max_page_count=' + str(pages))
        with self.assertRaises(sqlite3.OperationalError):
            self.capture(raw=b'x' * 300000)
        self.assertEqual(1, self.box.health()['responses'])
        self.assertEqual(RAW, self.box.db.execute('SELECT raw FROM responses').fetchone()[0])

    def test_local_ack_write_failure_leaves_pending_for_recovery(self):
        self.ready()
        self.box.db.execute("CREATE TRIGGER deny_ack BEFORE UPDATE ON messages WHEN NEW.state='acked' BEGIN SELECT RAISE(ABORT,'write failed'); END")
        with self.assertRaises(sqlite3.DatabaseError):
            Sender(self.box, FakeTransport()).once()
        self.assertEqual({'pending': 1}, self.box.health()['messages'])
        self.assertEqual(1, self.box.health()['responses'])

    def test_network_retry_keeps_exact_body_and_respects_persistent_delay(self):
        self.ready()
        transport = FakeTransport()
        with patch.object(transport, 'send', side_effect=urllib.error.URLError('offline')):
            self.assertEqual('retry', Sender(self.box, transport, random_fraction=lambda: 0).once())
        self.assertEqual('idle', Sender(self.box, transport).once())
        self.clock += 3
        self.assertEqual('acked', Sender(self.box, transport).once())
        self.assertEqual(1, self.box.health()['messages']['acked'])
        self.assertEqual(1, self.box.health()['responses'])

    def test_retry_after_and_server_failure_preserve_ids(self):
        self.ready()
        transport = FakeTransport(status=429, retry_after='120')
        self.assertEqual('retry', Sender(self.box, transport).once())
        self.clock += 119
        self.assertIsNone(self.box.claim())
        self.clock += 2
        transport.status = 503
        self.assertEqual('retry', Sender(self.box, transport).once())
        self.assertEqual(transport.calls[0][1], transport.calls[1][1])

    def test_terminal_statuses_pause_without_discarding_or_renumbering(self):
        self.ready()
        original = self.box.db.execute('SELECT body FROM messages').fetchone()[0]
        for status in (401, 403, 409, 413, 415, 422, 302):
            self.box.resume()
            self.assertEqual('blocked', Sender(self.box, FakeTransport(status=status)).once())
            self.assertEqual('http_' + str(status), self.box.health()['paused'])
            self.assertEqual(original, self.box.db.execute('SELECT body FROM messages').fetchone()[0])
            self.assertIsNone(self.box.claim())

    def test_wrong_ack_identity_hash_counts_and_generic_success_are_not_accepted(self):
        self.ready()
        for change in ({'agent_id': 'wrong'}, {'batch_id': 'wrong'}, {'content_sha256': 'wrong'},
                       {'responses_stored': 0}, {'events_stored': 99}, {'rows_stored': True}, {'status': 'ok'}):
            self.box.resume()
            self.assertEqual('blocked', Sender(self.box, FakeTransport(mutate=change)).once())
            self.assertEqual('invalid_ack', self.box.health()['paused'])
        self.assertEqual(1, self.box.health()['responses'])

    def test_local_payload_tampering_stops_before_http(self):
        self.ready()
        self.box.db.execute("UPDATE messages SET body=?", (b'{}',))
        transport = FakeTransport()
        self.assertEqual('blocked', Sender(self.box, transport).once())
        self.assertEqual([], transport.calls)

    def test_invalid_capture_and_snapshot_are_rejected_before_persistence(self):
        with self.assertRaises(ValueError):
            self.capture(raw=b'x' * 524289)
        with self.assertRaises(ValueError):
            self.box.capture(RAW, 'rt', 1, END, START)
        with self.assertRaises(ValueError):
            self.box.enqueue_state(snapshot() | {'expiration': '2099-01-01'})
        self.assertEqual(0, self.box.health()['responses'])

    @unittest.skipUnless(os.name == 'nt', 'DPAPI requiere Windows')
    def test_real_dpapi_roundtrip_does_not_store_plaintext(self):
        path = Path(self.temp.name) / 'token.dpapi'
        store(path, TOKEN)
        self.assertNotIn(TOKEN.encode('ascii'), path.read_bytes())
        self.assertEqual(TOKEN, load(path))

    def test_transport_rejects_cleartext_remote_urls_and_embedded_credentials(self):
        for url in ('http://api.example.test', 'http://localhost:8000', 'https://user:pass@example.test',
                    'https://example.test/?token=bad'):
            with self.assertRaises(ValueError):
                HttpTransport(url, TOKEN, local_trial=True)

    def test_redirect_never_forwards_credentials(self):
        hits = []
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def do_POST(self):
                hits.append(self.path)
                self.send_response(302)
                self.send_header('Location', '/credential-trap')
                self.end_headers()
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            transport = HttpTransport(f'http://127.0.0.1:{server.server_port}', TOKEN, local_trial=True)
            self.assertEqual(302, transport.send('lotes', b'{}')[0])
            self.assertEqual(['/lotes'], hits)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


class LaravelTests(unittest.TestCase):
    def setUp(self):
        TRIAL.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=TRIAL)
        self.directory = Path(self.temp.name)
        (self.directory / 'laravel.sqlite').touch()
        self.router = Path(__file__).with_name('laravel_router.php')
        self.env = os.environ | {'CA_AGENT_TRIAL_ROOT': str(self.directory), 'APP_ENV': 'testing'}
        self.php = os.environ.get('CA_TRIAL_PHP', r'C:\xampp\php\php.exe')
        subprocess.run([self.php, str(self.router), 'init'], env=self.env, check=True, capture_output=True, timeout=20)
        with socket.socket() as available:
            available.bind(('127.0.0.1', 0))
            port = available.getsockname()[1]
        self.server = subprocess.Popen([self.php, '-S', f'127.0.0.1:{port}', str(self.router)],
                                       env=self.env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.addCleanup(self.server.terminate)
        deadline = time.monotonic() + 10
        while True:
            try:
                with socket.create_connection(('127.0.0.1', port), timeout=.2):
                    break
            except OSError:
                if time.monotonic() > deadline:
                    self.fail('Servidor PHP de ensayo no inicio.')
                time.sleep(.05)
        self.clock = 1000.0
        self.box = Outbox(self.directory / 'outbox.sqlite', AGENT, SERIAL, clock=lambda: self.clock)
        self.transport = HttpTransport(f'http://127.0.0.1:{port}/api/control-acceso/agente', TOKEN, local_trial=True)

    def tearDown(self):
        self.server.terminate()
        self.server.wait(timeout=10)
        self.box.close()
        cleanup_trial(self.temp)

    def server_count(self, table):
        with contextlib.closing(sqlite3.connect(self.directory / 'laravel.sqlite')) as connection:
            return connection.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0]

    def test_lost_ack_after_laravel_commit_replays_same_batch_after_restart(self):
        self.box.capture(RAW, 'rt', 1, START, END)
        self.box.build_batch()
        original = self.box.db.execute('SELECT body FROM messages').fetchone()[0]
        real_send = self.transport.send
        def lose_ack(endpoint, body):
            status, ack, _ = real_send(endpoint, body)
            self.assertEqual(201, status)
            raise urllib.error.URLError('ACK perdido tras commit real')
        with patch.object(self.transport, 'send', side_effect=lose_ack):
            self.assertEqual('retry', Sender(self.box, self.transport).once())
        self.assertEqual(1, self.server_count('control_acceso_lotes'))
        self.box.close()
        self.clock += 400
        self.box = Outbox(self.directory / 'outbox.sqlite', clock=lambda: self.clock)
        self.assertEqual('acked', Sender(self.box, self.transport).once())
        self.assertEqual(original, self.box.db.execute('SELECT body FROM messages').fetchone()[0])
        self.assertEqual(1, self.server_count('control_acceso_lotes'))
        self.assertEqual(1, self.server_count('control_acceso_filas'))

    def test_state_unicode_digest_and_raw_status_binary_error_responses_match_laravel(self):
        self.box.enqueue_state(snapshot() | {'agent_version': 'ensayo-México\u2028v1'})
        self.box.capture(RAW, 'rt', 1, START, END)
        self.box.capture(b'2026-10-23 20:26:21,0,0,0,255,0,0\r\n', 'rt', 1, START, END)
        self.box.capture(b'\xff\x00original-error', 'rt', -2, START, END)
        self.box.build_batch()
        self.assertEqual(['acked', 'acked', 'idle'], Sender(self.box, self.transport).run())
        self.assertEqual(1, self.server_count('control_acceso_estados'))
        self.assertEqual(3, self.server_count('control_acceso_respuestas'))
        self.assertEqual(2, self.server_count('control_acceso_filas'))
        self.assertEqual(3, self.box.health()['responses'])

    def test_real_conflict_pauses_original_without_deleting_evidence(self):
        self.box.capture(RAW, 'rt', 1, START, END)
        self.box.build_batch()
        original = self.box.db.execute('SELECT body FROM messages').fetchone()[0]
        changed = json.loads(original)
        changed['responses'][0]['pc_local_time'] = 'different'
        self.assertEqual(201, self.transport.send('lotes', json_bytes(changed))[0])
        self.assertEqual('blocked', Sender(self.box, self.transport).once())
        self.assertEqual('http_409', self.box.health()['paused'])
        self.assertEqual(original, self.box.db.execute('SELECT body FROM messages').fetchone()[0])
        self.assertEqual(1, self.box.health()['responses'])


if __name__ == '__main__':
    unittest.main()
