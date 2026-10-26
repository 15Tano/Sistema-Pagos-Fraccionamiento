"""Bindings nuevos con procesos/DPAPI/locks reales y un SDK totalmente ficticio."""
import contextlib
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
import uuid

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import sdk_operativo as sdk
import runner_operativo as runtime
import test_aplicador_integrado as base
import test_aplicacion_vigencias as fixture
import test_agente as events


class SDKTests(unittest.TestCase):
    def setUp(self):
        basepath=ROOT/'datos'/'pruebas_sdk_operativo';basepath.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=basepath);self.root=Path(self.temp.name)
        (self.root/'sync.lock').write_bytes(b'0');(self.root/'sincronizar_vigencias.py').write_text('# fixture')
        self.settings={'protocol':1,'enabled':False,'agent_id':str(uuid.uuid4()),'serial':sdk.config.SERIAL,
            'url':sdk.config.URL,'archive_acknowledged':False,'release_sha256':'a'*64}
        (self.root/'servicio-config.json').write_text(json.dumps(self.settings))
        self.owner=sdk.session.Owner(self.root,startup_guard=lambda:None).__enter__()
        self.addCleanup(self.owner.__exit__,None,None,None)
        self.data=self.owner.data;self.state=self.data/'fixture_sdk.json'
        self.state.write_text(json.dumps({'user':fixture.USER,'permits':base.p.PERMITS,'rt':events.RAW.decode()}))
        self.raw=sdk.Originals(self.data/'originals.sqlite',self.settings['agent_id'],sdk.config.SERIAL)
        self.addCleanup(self.raw.close)
        self.python=os.environ.get('SI_TEST_CHILD_PYTHON',sys.executable)
        self.gate=sdk.closures.SDKGate()
        self.transport=sdk.Transport(self.owner,self.python,self.gate,command_factory=self.command)
    def tearDown(self):
        self.doCleanups();self.temp.cleanup()
    def command(self,folder,digest):
        return [self.python,'-B',str(ROOT/'tests'/'sdk_operativo_ficticio.py'),'--worker',str(folder),'--sha256',digest,'--root',str(self.root)]

    def test_profile_child_has_native_owner_and_exits_before_next_turn(self):
        with patch.dict(os.environ,{'SANISIDRO_ACCESS_PASSWORD':'fixture-secret'}):
            value=self.transport.capture_profile(fixture.plan(),self.owner.run_id)
        self.assertEqual(fixture.USER,value['snapshot']['user']);self.assertTrue((value['folder']/'parent_ack.json').exists())
        self.assertIsNone(self.gate.active);self.assertFalse(self.gate.fault)
        child=json.loads(self.state.read_bytes())['children'][0]
        self.assertNotEqual(os.getpid(),child['pid']);self.assertFalse(child['inherited_secret'])
        self.assertEqual(int(os.environ.get('SI_TEST_CHILD_BITS',str(__import__('struct').calcsize('P')*8))),child['bits'])

    def test_rt_preserves_full_buffer_before_parent_receives_it_and_ack_confirms_exit(self):
        client=sdk.RT(self.owner,self.python,self.gate,command_factory=self.command)
        client.connect()
        try:
            value=client.read();self.assertEqual(65536,len(value['buffer']))
            self.assertEqual(value['buffer'],self.raw.receipt(value['response_id'])['buffer'])
            self.assertEqual(events.RAW,value['raw']);folder=client.folder
        finally:client.close()
        self.assertTrue((folder/'parent_ack.json').exists());self.assertIsNone(self.gate.active)
        import guardia_gestor_operativo
        guardia_gestor_operativo.require_closed(self.root,allow_partial_review=False)
        self.assertEqual(1,json.loads(self.state.read_bytes())['disconnects'])

    def test_wrong_serial_does_not_read_events_or_set_dates(self):
        state=json.loads(self.state.read_bytes());state['fault']='serial';self.state.write_text(json.dumps(state))
        client=sdk.RT(self.owner,self.python,self.gate,command_factory=self.command)
        with self.assertRaises(Exception):client.connect()
        state=json.loads(self.state.read_bytes());self.assertEqual(0,state.get('reads',0));self.assertEqual(0,state.get('sets',0))
        self.assertTrue((self.data/'revision_vigencias.json').exists())

    def test_failed_disconnect_latches_sdk_fault_and_blocks_another_turn(self):
        state=json.loads(self.state.read_bytes());state['fault']='disconnect';self.state.write_text(json.dumps(state))
        client=sdk.RT(self.owner,self.python,self.gate,command_factory=self.command);client.connect();client.read()
        with self.assertRaises(Exception):client.close()
        self.assertTrue(self.gate.fault)
        with self.assertRaises(Exception):self.transport.read_child(fixture.CARD,self.owner.run_id)

    def test_quarantine_keeps_lock_even_if_review_state_cannot_be_saved(self):
        service=types.SimpleNamespace(official={'consecutive_errors':0,'last_ok_utc':'before'})
        def limited(_):
            sdk.session.require_locked(self.root/'sync.lock')
            self.assertEqual('before',service.official['last_ok_utc'])
            raise InterruptedError('end bounded fixture quarantine')
        with self.assertLogs(level='ERROR'),patch.object(runtime,'review',side_effect=OSError('fixture disk')),patch.object(runtime,'save',side_effect=OSError('fixture disk')):
            with self.assertRaises(InterruptedError):runtime.quarantine(self.owner,service,sleep=limited)
        sdk.session.require_locked(self.root/'sync.lock')

    def test_new_binding_applies_only_api_date_and_archives_all_closed_workers(self):
        state=json.loads(self.state.read_bytes());state['stop_on_set']=True;self.state.write_text(json.dumps(state))
        harness=base.IntegratedTests('runTest');harness.setUp();self.addCleanup(harness.tearDown)
        plans=[fixture.plan()]
        bundles=sdk.checkpoint.prepare(plans,harness.source,self.data/'mdb_respaldos','fixture',self.transport,
            self.owner.run_id,self.data/'bundles',guard=self.owner.guard,copy=harness.copy_mdb,
            validate=lambda path,password,plan:{'access_before_sha256':fixture.app.digest(plan['access_before'])})
        scope=fixture.approval(plans[0]);evidence=self.data/'transacciones'
        result=sdk.checkpoint.integrated.execute(scope,lambda:fixture.API,harness.access,
            self.transport.read_child,self.transport.apply_child,evidence,self.transport.ledger,bundles[fixture.CARD],
            gate=self.gate,guard=self.owner.guard)
        state=json.loads(self.state.read_bytes())
        self.assertEqual('verified',result['status']);self.assertEqual(1,state['sets'])
        self.assertEqual('20261105',state['user']['EndTime']);self.assertEqual(fixture.USER['Password'],state['user']['Password'])
        self.assertEqual('2026-11-05 23:59:59',harness.access_before['end'])
        birth=(int(self.owner.record['native']['birth_ticks'])-116444736000000000)/10000000
        self.assertTrue(runtime.native.stop_requested(self.root,os.getpid(),birth,self.owner.run_id))
        from archivo_cierres import LedgerArchive
        archive=LedgerArchive(self.data)
        try:
            self.assertTrue(archive.archive(self.gate,evidence,guard=self.owner.guard))
            self.assertEqual([],list(self.transport.ledger.iterdir()));archive.recover()
        finally:archive.close()


if __name__=='__main__':unittest.main()
