"""Reducción en origen y retiro automático con SQLite real, sin hardware ni red."""
import datetime as dt
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import ingesta_resumida as policy
import almacen_operativo as storage
import test_agente as fixture
import test_almacen_operativo as base

STATUS = b'2026-10-31 12:00:00,0,0,0,255,0,0\r\n'


class SourceTests(unittest.TestCase):
    def setUp(self):
        folder = ROOT/'datos'/'pruebas_ingesta_resumida'
        folder.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=folder)
        self.root = Path(self.temp.name)
        self.originals = storage.Originals(self.root/'originals.sqlite', fixture.AGENT, fixture.SERIAL)
        self.box = policy.SummaryOutbox(self.root/'outbox.sqlite', fixture.AGENT, fixture.SERIAL)

    def tearDown(self):
        self.box.close()
        self.originals.close()
        self.temp.cleanup()

    def test_thousand_status_reads_use_one_durable_snapshot_and_no_originals_or_queue(self):
        buffer = (STATUS+b'\0').ljust(65536, b'\0')
        for _ in range(1000):
            receipt = policy.store_status(self.originals, buffer, 1, fixture.START, fixture.END)
        self.assertEqual(1000, receipt)
        self.assertEqual(0, self.originals.db.execute('SELECT COUNT(*) FROM originals').fetchone()[0])
        self.assertEqual(1, self.originals.db.execute('SELECT COUNT(*) FROM rt_status_summary').fetchone()[0])
        self.assertEqual(0, self.box.health()['pending_count'])
        value = policy.status_receipt(self.originals, receipt)
        self.assertEqual(buffer, value['buffer'])
        self.assertEqual(1000, value['status_statistics']['statuses_observed_total'])
        epoch = value['status_statistics']['status_observations_epoch']
        self.originals.close()
        self.originals = storage.Originals(self.root/'originals.sqlite')
        self.assertEqual(epoch, policy.status_receipt(self.originals, receipt)['status_statistics']['status_observations_epoch'])

    def test_unknown_mixed_binary_error_and_unterminated_buffers_are_not_summarized(self):
        for raw, code in ((STATUS+fixture.RAW, 2), (b'bad,255', 1), (b'\xff', 0), (STATUS, -2)):
            self.assertIsNone(policy.store_status(self.originals, raw+b'\0', code, fixture.START, fixture.END))
        self.assertIsNone(policy.store_status(self.originals, STATUS, 1, fixture.START, fixture.END))

    def test_health_backlog_is_replaced_without_touching_active_lease_or_event_batches(self):
        snapshot = fixture.snapshot()
        # Fixture helper may include envelope; only pass the snapshot fields.
        snapshot = {k: v for k, v in snapshot.items() if k not in ('protocol_version', 'agent_id', 'device_serial', 'session_id', 'sequence')}
        first = self.box.enqueue_state(snapshot)
        lease = self.box.claim()
        self.assertEqual(first, lease['id'])
        for _ in range(50):
            self.box.enqueue_state(snapshot)
        self.assertEqual(2, self.box.db.execute("SELECT COUNT(*) FROM messages WHERE endpoint='estado'").fetchone()[0])
        self.assertEqual(50, self.box.db.execute("SELECT MAX(sequence) FROM messages WHERE endpoint='estado'").fetchone()[0])
        self.assertEqual(lease['body'], self.box.db.execute('SELECT body FROM messages WHERE id=?', (first,)).fetchone()[0])
        self.box.capture(fixture.RAW, 'rt', 1, fixture.START, fixture.END)
        self.box.build_batch()
        self.box.enqueue_state(snapshot)
        self.assertEqual(1, self.box.db.execute("SELECT COUNT(*) FROM messages WHERE endpoint='lotes'").fetchone()[0])

    def test_integrated_service_queues_real_events_but_not_status_and_health_is_not_every_two_seconds(self):
        from unittest.mock import Mock
        from types import SimpleNamespace
        from test_latencia_candidata import Clock
        from test_coordinador import OBSERVED
        from servicio_integrado import SDKGate
        clock = Clock()
        gate = SDKGate()
        owner = self
        captures = [0]
        class RT:
            def connect(self): gate.acquire('rt')
            def close(self): gate.release('rt', clean=True)
            def read(self):
                captures[0] += 1
                raw = fixture.RAW if captures[0] == 30 else STATUS
                buffer = (raw+b'\0').ljust(65536, b'\0')
                key = policy.store_status(owner.originals, buffer, 1, clock.utc(), clock.utc())
                if key is not None:
                    return policy.status_receipt(owner.originals, key)
                key = owner.originals.put(buffer, 1, clock.utc(), clock.utc())
                return owner.originals.receipt(key)
        reports = []
        enqueue = self.box.enqueue_state
        def record(snapshot):
            reports.append(snapshot)
            return enqueue(snapshot)
        self.box.enqueue_state = record
        sender = SimpleNamespace(start=Mock(), close=Mock(return_value=True), snapshot=lambda: {'phase': 'idle'})
        def cycle():
            self.assertIsNone(gate.active)
            return {'mode': 'readonly', 'status': 'compared'}
        service = policy.MaintenanceService(cycle, self.box, RT, sender, gate,
            applying=False, observed=lambda: dict(OBSERVED), clock=clock, sleep=clock.advance, utc=clock.utc)
        result = service.run(70)
        self.assertTrue(result['closures_confirmed'])
        self.assertGreater(captures[0], 100)
        self.assertLessEqual(len(reports), 12)
        self.assertTrue(any('statuses_observed_total' in p['sdk'] for p in reports))
        self.assertEqual(1, self.box.health()['responses'])
        self.assertEqual(1, self.originals.db.execute('SELECT COUNT(*) FROM originals').fetchone()[0])

    def test_expired_health_does_not_block_queue_but_expired_vehicle_batch_is_preserved(self):
        self.box.enqueue_state(fixture.snapshot())
        transport = type('Expired', (), {'send': lambda *args: (410, None, None)})()
        sender = policy.ResilientSender(self.box, transport)
        self.assertEqual('expired_health', sender.once())
        self.assertFalse(self.box.health()['paused'])
        self.box.capture(fixture.RAW, 'rt', 1, fixture.START, fixture.END)
        self.box.build_batch()
        self.assertEqual('blocked', sender.once())
        self.assertTrue(self.box.health()['paused'])
        self.assertEqual(1, self.box.health()['responses'])

    def test_installer_requires_compatible_active_backend_before_installation(self):
        from unittest.mock import Mock
        from types import SimpleNamespace
        import credencial
        import emisor
        expected = {'storage_policy': 'summary-v1', 'retention_enabled': True,
                    'retry_window_days': 7, 'technical_days': 1, 'event_days': 90}
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.code = 200
        response.read.return_value = json.dumps(expected).encode()
        transport = SimpleNamespace(token='sica_'+'a'*64, opener=Mock())
        transport.opener.open.return_value = response
        with patch.object(credencial, 'load', return_value=transport.token), patch.object(emisor, 'HttpTransport', return_value=transport):
            self.assertEqual(expected, policy.backend_ready(self.root))
            request = transport.opener.open.call_args.args[0]
            self.assertEqual('application/json', request.get_header('Content-type'))
            response.read.return_value = json.dumps(dict(expected, retention_enabled=False)).encode()
            with self.assertRaises(PermissionError): policy.backend_ready(self.root)


class RetirementTests(base.StorageTests):
    def test_confirmed_archive_expires_and_catalog_recovery_does_not_requeue(self):
        self.capture()
        self.assertEqual('acked', self.ack())
        self.archives.archive_one(self.box)
        ack = json.loads(self.raw.db.execute('SELECT ack FROM archives').fetchone()[0])
        clock = policy.protocol.utc(ack['server_received_at_utc']).timestamp() + 8*86400
        retire = policy.ArchiveRetention(self.archives, self.box, clock=lambda: clock)
        self.assertEqual(1, retire.tick(force=True))
        self.assertEqual(0, self.raw.db.execute('SELECT COUNT(*) FROM originals').fetchone()[0])
        self.assertEqual(0, self.raw.recover(self.box, self.archives))
        self.assertEqual([], list(self.archives.root.glob('*.json.gz')))

    def test_interruption_after_catalog_commit_recovers_file_removal_without_requeue(self):
        self.capture()
        self.ack()
        self.archives.archive_one(self.box)
        ack = json.loads(self.raw.db.execute('SELECT ack FROM archives').fetchone()[0])
        clock = policy.protocol.utc(ack['server_received_at_utc']).timestamp() + 8*86400
        retire = policy.ArchiveRetention(self.archives, self.box, clock=lambda: clock)
        with self.assertRaises(OSError):
            retire.tick(force=True, after_mark=lambda: (_ for _ in ()).throw(OSError('power cut fixture')))
        self.archives.verify_catalog()
        self.assertEqual(1, len(list(self.archives.root.glob('*.json.gz'))))
        self.assertEqual(1, retire.tick(force=True))
        self.assertEqual(0, self.raw.recover(self.box, self.archives))

    def test_hot_copy_after_archival_cut_is_never_retired(self):
        self.capture()
        self.ack()
        with self.assertRaises(OSError):
            self.archives.archive_one(self.box, after_mark=lambda: (_ for _ in ()).throw(OSError('cut')))
        retire = policy.ArchiveRetention(self.archives, self.box, clock=lambda: 4102444800)
        self.assertEqual(0, retire.tick(force=True))
        self.assertEqual(1, self.box.health()['responses'])
        self.assertEqual(1, self.raw.db.execute('SELECT COUNT(*) FROM originals').fetchone()[0])


import test_sdk_operativo as sdk_fixture


class SDKSummaryTests(sdk_fixture.SDKTests):
    def test_status_summary_crosses_ipc_without_individual_originals(self):
        import sdk_operativo as sdk
        state = json.loads(self.state.read_bytes())
        state.update(rt=STATUS.decode(), summarize_status=True)
        self.state.write_text(json.dumps(state))
        client = sdk.RT(self.owner, self.python, self.gate, command_factory=self.command)
        client.connect()
        try:
            one = client.read()
            two = client.read()
            self.assertTrue(one['status_summary'])
            self.assertEqual(STATUS, two['raw'])
            self.assertEqual(2, two['status_statistics']['statuses_observed_total'])
            self.assertEqual(0, self.raw.db.execute('SELECT COUNT(*) FROM originals').fetchone()[0])
        finally:
            client.close()
        self.assertIsNone(self.gate.active)
        self.assertFalse(self.gate.fault)


if __name__ == '__main__':
    unittest.main()
