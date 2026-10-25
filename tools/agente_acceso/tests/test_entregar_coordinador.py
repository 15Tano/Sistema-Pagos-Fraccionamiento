import contextlib
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

import test_agente as existing
import entregar_coordinador as delivery

TOKEN = 'sica_' + 'a' * 64
ROOT = Path(delivery.__file__).parent


def prepare_base(base):
    for name in delivery.EXPECTED:
        (base / name).write_bytes((ROOT / name).read_bytes())
    box = existing.Outbox(base / 'datos/lectura_mantenimiento/outbox.sqlite', delivery.AGENT, delivery.SERIAL)
    try:
        box.enqueue_state(existing.snapshot())
        box.capture(existing.RAW, 'rt', 1, existing.START, existing.END)
        box.build_batch()
        box.capture(b'2026-10-23 20:26:21,0,0,0,255,0,0\r\n', 'rt', 1, existing.START, existing.END)
        box.capture(b'\xff\0original-error', 'rt', -2, existing.START, existing.END)
    finally:
        box.close()


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        existing.TRIAL.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=existing.TRIAL)
        self.base = Path(self.temp.name)
        prepare_base(self.base)
        self.runtime = delivery.Delivery(self.base)

    def tearDown(self):
        self.runtime.close()
        existing.cleanup_trial(self.temp)

    def test_import_requires_exact_agent_one_secret_and_bounded_input(self):
        good = ('agent_id: ' + delivery.AGENT + '\r\nAviso\r\ntoken: ' + TOKEN + '\r\n').encode()
        self.assertEqual(TOKEN, delivery.read_secret(io.BytesIO(good)))
        for data in (b'', good + good, good + b'token: wrong\n', b'x' * 4097, good.replace(delivery.AGENT.encode(), existing.AGENT.encode()),
                     good.replace(TOKEN.encode(), b'wrong')):
            with self.assertRaises(ValueError):
                delivery.read_secret(io.BytesIO(data))

    def test_real_dpapi_import_never_writes_plain_secret(self):
        text = ('agent_id: ' + delivery.AGENT + '\ntoken: ' + TOKEN + '\n').encode()
        self.runtime.configure(io.BytesIO(text))
        self.assertNotIn(TOKEN.encode(), self.runtime.secret_file.read_bytes())
        self.assertEqual(TOKEN, self.runtime.lib.secret.load(self.runtime.secret_file))
        self.assertFalse(list(self.runtime.data.glob('*.txt')))

    def test_library_tampering_refused_before_opening_store(self):
        (self.base / 'emisor.py').write_text('modified', encoding='utf-8')
        with self.assertRaises(ValueError):
            delivery.Delivery(self.base)

    def test_offline_keeps_existing_messages_and_originals(self):
        transport = existing.FakeTransport()
        old = self.runtime.message_hashes()
        originals = self.runtime.originals()
        with patch.object(transport, 'send', side_effect=urllib.error.URLError('offline')):
            result = self.runtime.send(transport=transport)
        self.assertEqual({'retry': 1}, result['delivery'])
        self.assertEqual(originals, self.runtime.originals())
        self.assertTrue(result['existing_messages_unchanged'])
        self.assertTrue(all(self.runtime.message_hashes()[key] == digest for key, digest in old.items()))
        self.assertEqual(3, result['health']['pending_count'])
        self.assertNotIn(TOKEN, (self.runtime.data / 'entrega_resumen.json').read_text())

    def test_wrong_identity_does_not_initialize_or_relabel_existing_data(self):
        self.runtime.box.db.execute("UPDATE meta SET value='TEST-C3-001' WHERE key='device_serial'")
        with self.assertRaises(ValueError):
            delivery.Delivery(self.base)
        self.assertEqual(3, self.runtime.box.health()['responses'])

    def test_altered_original_stops_before_http(self):
        self.runtime.box.db.execute("UPDATE responses SET raw=? WHERE rowid=1", (b'altered',))
        transport = existing.FakeTransport()
        with self.assertRaises(ValueError):
            self.runtime.send(transport=transport)
        self.assertEqual([], transport.calls)


class DeliveryLaravelTests(existing.LaravelTests):
    test_lost_ack_after_laravel_commit_replays_same_batch_after_restart = None
    test_state_unicode_digest_and_raw_status_binary_error_responses_match_laravel = None
    test_real_conflict_pauses_original_without_deleting_evidence = None

    def test_real_agent_delivery_reuses_ids_keeps_originals_and_second_call_is_idle(self):
        with contextlib.closing(sqlite3.connect(self.directory / 'laravel.sqlite')) as connection:
            connection.execute('''INSERT INTO control_acceso_agentes
                (id,nombre,device_serial,token_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)''',
                (delivery.AGENT, 'Ensayo real ficticio', delivery.SERIAL, hashlib.sha256(TOKEN.encode()).hexdigest(),
                 '2026-10-25 00:00:00', '2026-10-25 00:00:00'))
            connection.commit()
        base = self.directory / 'cliente'
        base.mkdir()
        prepare_base(base)
        runtime = delivery.Delivery(base)
        try:
            runtime.configure(io.BytesIO(('agent_id: ' + delivery.AGENT + '\ntoken: ' + TOKEN + '\n').encode()))
            before = runtime.message_hashes()
            with patch.object(delivery, 'URL', self.transport.url):
                first = runtime.send()
                second = runtime.send()
            self.assertEqual({'acked': 3, 'idle': 1}, first['delivery'])
            self.assertEqual({'idle': 1}, second['delivery'])
            self.assertEqual(0, second['health']['pending_count'])
            self.assertEqual(3, second['originals']['count'])
            self.assertEqual(first['originals'], second['originals'])
            self.assertTrue(all(runtime.message_hashes()[key] == digest for key, digest in before.items()))
            self.assertEqual({'state_messages': 1, 'batches': 2, 'responses_stored': 3,
                'rows_stored': 2, 'events_stored': 1, 'statuses_stored': 1,
                'responses_pending_interpretation': 1}, second['ack_totals'])
            self.assertEqual(3, self.server_count('control_acceso_respuestas'))
            self.assertNotIn(TOKEN, json.dumps(second))
        finally:
            runtime.close()


if __name__ == '__main__':
    unittest.main()
