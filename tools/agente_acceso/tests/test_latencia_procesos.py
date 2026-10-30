"""Candidato con SQLite, procesos, exclusiones y DPAPI de prueba reales."""
import contextlib
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import types
import unittest
from unittest.mock import Mock,patch
import uuid

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import latencia_dell as trial
import emisor_latencia as emitter
import sdk_latencia as candidate
import sdk_operativo as sdk
from outbox import Outbox
from emisor_servicio import read,save
import test_aplicacion_vigencias as fixture
import test_agente as f


class NativeTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_latencia_procesos';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base);self.root=Path(self.temp.name)/'Owner'
        self.root.mkdir();(self.root/'sync.lock').write_bytes(b'0')
        (self.root/'sincronizar_vigencias.py').write_text('# fixture')
        (self.root/'servicio-config.json').write_text('{}')
        self.sync=self.root.parent/'InstalledSync';(self.sync/'registros').mkdir(parents=True)
        self.manager=self.sync.parent/'GestionTags';self.manager.mkdir()
        (self.sync/'sync.lock').write_bytes(b'0')
        save(self.sync/'registros'/'estado.json',{'protocol':2,'phase':'stopped'})
        save(self.manager/'mantenimiento.json',{'active':True})
        self.lock=candidate.session.sync_lock(self.sync/'sync.lock');self.lock.__enter__()
        self.owner=candidate.session.Owner(self.root,startup_guard=lambda:None).__enter__()
        self.marker=trial.marker_for(os.getpid(),self.owner.run_id)
        trial.mark(self.marker,self.manager/'revision_pendiente.json')
        self.originals=sdk.Originals(self.owner.data/'originals.sqlite',emitter.AGENT,emitter.SERIAL)
        self.state=self.owner.data/'fixture_sdk.json'
        self.state.write_text(json.dumps({'user':fixture.USER,'rt':f.RAW.decode()}))
        self.gate=sdk.closures.SDKGate()
        self.python=os.environ.get('SI_TEST_CHILD_PYTHON',sys.executable)
        self.clients=[]
    def tearDown(self):
        for client in self.clients:
            try:client.close()
            except Exception:pass
        self.originals.close();self.owner.__exit__(None,None,None)
        self.lock.__exit__(None,None,None);self.temp.cleanup()
    def command(self,folder,digest):
        return [self.python,'-B',str(ROOT/'tests'/'latencia_proceso_ficticio.py'),
            '--worker',str(folder),'--sha256',digest,'--root',str(self.root)]
    def rt(self):
        client=sdk.RT(self.owner,self.python,self.gate,command_factory=self.command)
        self.clients.append(client);return client
    def test_native_rt_then_inventory_never_overlap_and_keep_full_original(self):
        client=self.rt()
        with patch.dict(os.environ,{'SANISIDRO_ACCESS_PASSWORD':'private_fixture'}):client.connect()
        value=client.read()
        self.assertEqual(65536,len(self.originals.receipt(value['response_id'])['buffer']))
        transport=sdk.Transport(self.owner,self.python,self.gate,command_factory=self.command)
        with self.assertRaises(RuntimeError):transport.read_child(fixture.CARD,self.owner.run_id)
        self.assertEqual('rt',self.gate.active)
        client.close()
        child,folder=transport.read_child(fixture.CARD,self.owner.run_id)
        self.assertIsNone(self.gate.active);self.assertFalse(self.gate.fault)
        self.assertTrue((folder/'parent_ack.json').exists())
        state=json.loads(self.state.read_bytes())
        self.assertEqual(2,state['disconnects']);self.assertNotIn('sets',state)
        self.assertFalse(any(c['secret_inherited'] for c in state['children']))
        self.assertTrue(all(c['bits']==int(os.environ.get('SI_TEST_CHILD_BITS',str(struct_bits()))) for c in state['children']))
    def test_dates_and_profile_requests_rejected_before_loading_sdk(self):
        loader=Mock(side_effect=AssertionError('No debe cargar DLL'))
        diag=types.SimpleNamespace(load_sdk=loader)
        operations=[('operation.json',{'mode':'apply','changes':[{'card':fixture.CARD,
            'before':fixture.C3,'end':'20261105'}]}),('profile_operation.json',{'mode':'profile','plan':fixture.plan()})]
        for name,value in operations:
            folder=sdk.closures.new_session(self.owner.data/'cierres',self.owner.run_id,'vigencias')
            operation=folder/name;operation.write_text(json.dumps(value))
            sha=hashlib.sha256(operation.read_bytes()).hexdigest()
            with self.assertRaises(PermissionError):
                candidate.dispatch(folder,sha,root=self.root,diagnostic=diag,guard=lambda:None)
        loader.assert_not_called()
    def test_guard_rejects_foreign_marker_and_resumed_polling(self):
        candidate.maintenance_files(self.sync,self.marker)
        save(self.manager/'revision_pendiente.json',dict(self.marker,pid=self.marker['pid']+1))
        with self.assertRaises(PermissionError):candidate.maintenance_files(self.sync,self.marker)
        save(self.manager/'revision_pendiente.json',self.marker)
        save(self.sync/'registros'/'estado.json',{'protocol':2,'phase':'idle'})
        with self.assertRaises(PermissionError):candidate.maintenance_files(self.sync,self.marker)
    def test_review_creation_never_overwrites_another_review(self):
        with self.assertRaises(FileExistsError):trial.mark({'foreign':True},self.manager/'revision_pendiente.json')
        self.assertEqual(self.marker,read(self.manager/'revision_pendiente.json'))
    def test_uncertain_disconnect_latches_exclusion_and_keeps_review(self):
        state=json.loads(self.state.read_bytes());state['fault']='disconnect';self.state.write_text(json.dumps(state))
        client=self.rt();client.connect();client.read()
        with self.assertRaises(Exception):client.close()
        self.assertTrue(self.gate.fault)
        self.assertEqual(self.marker,read(self.manager/'revision_pendiente.json'))
        candidate.session.require_locked(self.sync/'sync.lock')
        with self.assertRaises(Exception):self.rt().connect()
    def test_missing_live_owner_blocks_child_before_any_capture(self):
        save(self.owner.folder/'owner.json',{'phase':'closed'})
        client=self.rt()
        with self.assertRaises(Exception):client.connect()
        self.assertEqual(0,self.originals.db.execute('SELECT COUNT(*) FROM originals').fetchone()[0])


def struct_bits():return __import__('struct').calcsize('P')*8


class SenderTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_latencia_emisor';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base);self.root=Path(self.temp.name)
        self.box=Outbox(self.root/'acceso-datos'/'outbox.sqlite',emitter.AGENT,emitter.SERIAL)
        self.box.capture(f.RAW,'rt',1,f.START,f.END)
        self.processes=[]
    def tearDown(self):
        for proc in self.processes:proc.close()
        self.box.close();self.temp.cleanup()
    def start(self,offline=False):
        folder=self.root/str(uuid.uuid4())
        command=[sys.executable,'-B',str(ROOT/'tests'/'latencia_proceso_ficticio.py'),
            '--sender',str(folder),'--root',str(self.root)]
        if offline:command.append('--offline')
        proc=emitter.Process(folder,self.root,command=command)
        self.processes.append(proc)
        with patch.dict(os.environ,{'SANISIDRO_API_TOKEN':'private_fixture'}):proc.start()
        return proc
    def wait(self,condition):
        until=time.monotonic()+10
        while time.monotonic()<until:
            if condition():return
            time.sleep(.05)
        self.fail('Proceso ficticio no produjo evidencia en10s.')
    def test_sender_groups_unbatched_while_parent_does_other_work_then_eof_closes(self):
        proc=self.start()
        self.wait(lambda:self.box.db.execute("SELECT COUNT(*) FROM messages WHERE state='acked'").fetchone()[0]==1)
        self.assertTrue(proc.close())
        self.assertEqual(f.RAW,self.box.db.execute('SELECT raw FROM responses').fetchone()[0])
        self.assertFalse(read(proc.folder/'inheritance.json')['secret_inherited'])
        trace=[json.loads(v) for v in (proc.folder/'http.jsonl').read_text().splitlines()]
        self.assertTrue(trace[-1]['ack_valid'])
        self.assertNotIn('12345678',json.dumps(trace))
    def test_network_failure_survives_reopen_without_changing_body(self):
        proc=self.start(True)
        self.wait(lambda:self.box.db.execute('SELECT COALESCE(MAX(attempts),0) FROM messages').fetchone()[0]>=1)
        body=self.box.db.execute('SELECT body FROM messages').fetchone()[0]
        self.assertTrue(proc.close());self.box.close()
        self.box=Outbox(self.root/'acceso-datos'/'outbox.sqlite')
        self.assertEqual(body,self.box.db.execute('SELECT body FROM messages').fetchone()[0])
        self.assertEqual(1,self.box.health()['pending_count'])
        self.assertEqual('stopped',read(proc.folder/'closed.json')['report']['phase'])
        self.assertIsNone(read(proc.folder/'closed.json')['report']['last_ack_utc'])


if __name__=='__main__':unittest.main()
