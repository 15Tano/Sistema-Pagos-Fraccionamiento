"""Procesos reales propios, sin SDK ni conexiones HTTP de verdad."""
import copy
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import types
import unittest
import uuid
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import emisor_servicio as emitter
import respaldo_ciclo as checkpoint
import test_agente as f
import test_aplicacion_vigencias as app_fixture
import test_ciclo_operativo as fixture


class SenderProcessTests(unittest.TestCase):
    def setUp(self):
        root = ROOT/'datos'/'pruebas_servicio_procesos'
        root.mkdir(parents=True,exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=root)
        self.folder = Path(self.temp.name)
        self.processes = []
        self.box = f.Outbox(self.folder/'outbox.sqlite',f.AGENT,f.SERIAL)
        self.box.capture(f.RAW,'rt',1,f.START,f.END)
        self.box.build_batch()
        self.original = dict(self.box.db.execute('SELECT * FROM messages').fetchone())

    def tearDown(self):
        for proc in self.processes:
            proc.close()
        self.box.close()
        self.temp.cleanup()

    def process(self,fault=None):
        folder = self.folder/str(uuid.uuid4())
        command = [sys.executable,'-B',str(ROOT/'tests'/'servicio_proceso_ficticio.py'),'--sender',str(folder)]
        if fault:
            command += ['--fault',fault]
        proc = emitter.ProcessSender(folder,self.folder,command=command,timeout=.8 if fault=='hang' else 10)
        self.processes.append(proc)
        return proc

    def wait_attempt(self,proc):
        deadline = time.monotonic()+8
        while time.monotonic()<deadline:
            state=proc.snapshot()
            if state.get('outcomes'):
                return state
            time.sleep(.05)
        self.fail('Hijo ficticio no entrego estado.')

    def test_real_child_ack_is_durable_original_and_body_unchanged_and_secrets_not_inherited(self):
        proc=self.process()
        with patch.dict(os.environ,{'SANISIDRO_ACCESS_PASSWORD':'private_fixture'}):
            proc.start()
        try:
            state=self.wait_attempt(proc)
            self.assertIn('acked',state['outcomes'])
        finally:
            self.assertTrue(proc.close())
        state=emitter.read(proc.folder/'sender.json')
        self.assertFalse(state['inherited_secret'])
        current=dict(self.box.db.execute('SELECT * FROM messages').fetchone())
        self.assertEqual('acked',current['state'])
        self.assertEqual(self.original['body'],current['body'])
        self.assertEqual(self.original['sha256'],current['sha256'])
        self.assertEqual(f.RAW,self.box.db.execute('SELECT raw FROM responses').fetchone()[0])

    def test_network_failure_keeps_pending_with_same_body(self):
        proc=self.process('network');proc.start()
        try:
            state=self.wait_attempt(proc)
            self.assertIsNone(state['last_ack_utc'])
        finally:
            self.assertTrue(proc.close())
        current=dict(self.box.db.execute('SELECT * FROM messages').fetchone())
        self.assertEqual('pending',current['state'])
        self.assertEqual(self.original['body'],current['body'])

    def test_missing_or_foreign_closure_is_not_confirmed_by_process_exit_alone(self):
        for fault in ('missing','foreign'):
            proc=self.process(fault);proc.start()
            self.wait_attempt(proc)
            self.assertFalse(proc.close())

    def test_hung_own_child_is_collected_but_not_declared_clean(self):
        proc=self.process('hang');proc.start()
        self.wait_attempt(proc)
        self.assertFalse(proc.close())
        self.assertIsNotNone(proc.child.poll())

    def test_snapshot_replacement_waits_for_windows_reader_without_repeating_delivery(self):
        import threading
        path = self.folder/'snapshot.json'
        emitter.save(path,{'old':True})
        handle = path.open('rb')
        closer = threading.Thread(target=lambda: (time.sleep(.12),handle.close()))
        closer.start()
        try:
            emitter.save(path,{'new':True})
        finally:
            closer.join();handle.close()
        self.assertEqual({'new':True},emitter.read(path))

    def test_permanent_replace_failure_is_bounded_and_keeps_previous_snapshot(self):
        path = self.folder/'snapshot.json'
        emitter.save(path,{'old':True})
        with patch.object(emitter.os,'replace',side_effect=PermissionError('fixture')) as replace, \
                patch.object(emitter.time,'sleep'):
            with self.assertRaises(PermissionError):
                emitter.save(path,{'new':True})
        self.assertEqual(21,replace.call_count)
        self.assertEqual({'old':True},emitter.read(path))
        self.assertFalse(list(self.folder.glob('*.tmp')))


class CycleProcessTests(unittest.TestCase):
    def test_complete_cycle_uses_real_child_for_read_profile_and_shared_bundle_application(self):
        harness=fixture.CycleTests('runTest');harness.setUp()
        self.addCleanup(harness.doCleanups)
        h=harness.h
        state=h.folder/'child_data';state.mkdir()
        (state/'fixture_sdk.json').write_text(json.dumps({'user':app_fixture.USER,'permits':fixture.base.p.PERMITS}))
        python=os.environ.get('SI_TEST_CHILD_PYTHON',sys.executable)
        def command(folder,digest):
            return [python,'-B',str(ROOT/'tests'/'servicio_proceso_ficticio.py'),'--sdk',
                    '--worker',str(folder),'--sha256',digest]
        sdk=checkpoint.CycleTransport(state,python,gate=h.gate,guard=h.guard,command_factory=command,timeout=20)
        harness.sdk=sdk
        # Usar DPAPI nativa del usuario de prueba, no FakeCrypto, en padre e hijo.
        h.store=sdk.store
        run=harness.make(applying=True)
        result=run()
        self.assertEqual('verified',result['status'])
        persisted=json.loads((state/'fixture_sdk.json').read_bytes())
        self.assertEqual(1,persisted['sets'])
        self.assertEqual(4,persisted['disconnects'])
        self.assertEqual('20261105',persisted['user']['EndTime'])
        self.assertEqual(app_fixture.USER['Password'],persisted['user']['Password'])
        self.assertEqual('2026-11-05 23:59:59',h.access_before['end'])
        self.assertFalse(any(row['inherited_secret'] for row in persisted['events']))
        self.assertEqual(4,fixture.base.integrated.core.check_operations(sdk.ledger))


if __name__=='__main__':
    unittest.main()
