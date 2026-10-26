"""SDK ficticio en hijo real con padre/DPAPI/lock; ACE de prueba por separado."""
import contextlib
import copy
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock,patch
import uuid

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import piloto_vigencias as pilot
import piloto_vigencias_dell as entry
import respaldo_ciclo as checkpoint
import respaldo_protegido as protected
import sesion_operativa as session
from emisor_servicio import save
import test_aplicador_integrado as base
import test_aplicacion_vigencias as f


class ProcessTests(unittest.TestCase):
    def setUp(self):
        basepath=ROOT/'datos'/'pruebas_piloto_procesos';basepath.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=basepath);self.folder=Path(self.temp.name)
        self.root=self.folder/'package';self.sync=self.folder/'ZKSync';self.sync.mkdir()
        (self.sync/'sync.lock').write_bytes(b'0');(self.sync/'registros').mkdir()
        save(self.sync/'registros'/'estado.json',{'protocol':2,'pid':999999,'phase':'stopped'})
        manager=self.folder/'GestionTags';manager.mkdir();save(manager/'mantenimiento.json',{'active':True})
        self.key=str(uuid.uuid4());self.launch=self.root/'datos'/'sesiones'/self.key;self.data=self.launch/'sdk';self.data.mkdir(parents=True)
        self.marker={'protocol':1,'purpose':'pilot_vigencias','run_id':self.key,'pid':os.getpid()}
        save(manager/'revision_pendiente.json',self.marker)
        self.parent={'protocol':1,'purpose':'pilot_parent','run_id':self.key,'root':str(self.root.resolve()),
            'native':session.native_identity(os.getpid()),'review_marker':self.marker}
        (self.launch/'parent.dpapi').write_bytes(protected.dpapi(f.app.core.encoded(self.parent)))
        save(self.root/'estado_piloto.json',{'pid':os.getpid(),'run_id':self.key,'phase':'running'})
        self.state=self.data/'fixture_sdk.json';self.state.write_text(json.dumps({'user':f.USER,'permits':base.p.PERMITS}))
        self.python=os.environ.get('SI_TEST_CHILD_PYTHON',sys.executable)
        self.gate=entry.SDKGate();self.transport=checkpoint.CycleTransport(self.data,self.python,gate=self.gate,guard=Mock(),command_factory=self.command,timeout=20)
    def tearDown(self):self.temp.cleanup()
    def command(self,folder,digest):
        request=entry.closures.request_at(folder/'request.json')
        grant={'protocol':1,'purpose':'pilot_child','run_id':self.key,'worker_id':folder.name,
            'worker_run_id':request['run_id'],'operation_sha256':digest,
            'parent_sha256':hashlib.sha256((self.launch/'parent.dpapi').read_bytes()).hexdigest()}
        (folder/'pilot_grant.dpapi').write_bytes(protected.dpapi(f.app.core.encoded(grant)))
        return [self.python,'-B',str(ROOT/'tests'/'piloto_sdk_ficticio.py'),'--worker',str(folder),'--sha256',digest]

    def test_profile_child_validates_native_owner_and_has_no_secret_environment(self):
        with session.sync_lock(self.sync/'sync.lock'),patch.dict(os.environ,{'SANISIDRO_ACCESS_PASSWORD':'private_fixture'}):
            value=self.transport.capture_profile(f.plan(),self.key)
        self.assertEqual(f.USER,value['snapshot']['user']);self.assertTrue((value['folder']/'parent_ack.json').exists())
        child=json.loads(self.state.read_bytes())['events'][0]
        self.assertNotEqual(os.getpid(),child['pid']);self.assertFalse(child['inherited_secret'])
        self.assertEqual(int(os.environ.get('SI_TEST_CHILD_BITS',str(__import__('struct').calcsize('P')*8))),child['bits'])

    def test_complete_process_pilot_applies_once_and_preserves_other_fields(self):
        harness=base.IntegratedTests('runTest');harness.setUp();self.addCleanup(harness.tearDown)
        def prepare(plans,key):return checkpoint.prepare(plans,harness.source,self.launch/'mdb','fixture',self.transport,key,
            self.launch/'bundles',guard=Mock(),copy=harness.copy_mdb,
            validate=lambda path,password,plan:{'access_before_sha256':f.app.digest(plan['access_before'])})
        @contextlib.contextmanager
        def access():yield harness.access
        with session.sync_lock(self.sync/'sync.lock'):
            result=pilot.run(f.CARD,lambda:copy.deepcopy(f.API),lambda card:copy.deepcopy(harness.access_before),
                self.transport,prepare,access,self.launch/'transacciones',guard=Mock(),confirm=lambda *_:True,
                publish=Mock(),before_write=Mock())
        self.assertEqual('verified',result['status']);state=json.loads(self.state.read_bytes())
        self.assertEqual(1,state['sets']);self.assertEqual('20261105',state['user']['EndTime'])
        self.assertEqual(f.USER['Password'],state['user']['Password']);self.assertEqual(f.API[0]['expiration'],harness.access_before['end'])
        self.assertIsNone(self.gate.active);self.assertFalse(self.gate.fault)

    def test_resealed_different_birth_is_rejected_before_connecting(self):
        self.parent['native']['birth_ticks']='1';(self.launch/'parent.dpapi').write_bytes(protected.dpapi(f.app.core.encoded(self.parent)))
        with session.sync_lock(self.sync/'sync.lock'):
            with self.assertRaises(Exception):self.transport.capture_profile(f.plan(),self.key)
        self.assertEqual(0,json.loads(self.state.read_bytes()).get('disconnects',0))

    def test_child_cannot_connect_after_parent_state_is_closed(self):
        save(self.root/'estado_piloto.json',{'pid':os.getpid(),'run_id':self.key,'phase':'stopped'})
        with session.sync_lock(self.sync/'sync.lock'):
            with self.assertRaises(Exception):self.transport.capture_profile(f.plan(),self.key)
        self.assertEqual(0,json.loads(self.state.read_bytes()).get('sets',0))

    def test_missing_lock_is_rejected_even_though_parent_is_alive(self):
        with self.assertRaises(Exception):self.transport.capture_profile(f.plan(),self.key)
        self.assertEqual(0,json.loads(self.state.read_bytes()).get('disconnects',0))


class NativeMDBPilotTests(unittest.TestCase):
    def test_real_access_factory_commits_only_api_dates_in_fictitious_mdb(self):
        import test_respaldo_mdb_ace as native
        import test_ciclo_operativo as fixture
        db=native.NativeMDBTests('runTest');db.setUp();self.addCleanup(db.tearDown)
        h=fixture.CycleTests('runTest');h.setUp();self.addCleanup(h.doCleanups)
        h.sdk.store=protected.Store(db.folder/'profiles')
        def prepare(plans,key):return checkpoint.prepare(plans,db.source,db.folder/'backups',native.PASSWORD,
            h.sdk,key,db.folder/'bundles',guard=Mock())
        def access():return entry.access_dates(db.source,native.PASSWORD)
        def read_access(card):
            with entry.access_dates(db.source,native.PASSWORD,readonly=True) as value:return value.read(card)
        result=pilot.run(f.CARD,lambda:f.API,read_access,h.sdk,prepare,access,db.folder/'transactions',
            guard=Mock(),confirm=lambda *_:True,publish=Mock(),before_write=Mock())
        self.assertEqual('verified',result['status']);self.assertEqual(f.API[0]['expiration'],read_access(f.CARD)['end'])
        conn=checkpoint.mdb.connect_copy(db.source,native.PASSWORD)
        try:
            cur=conn.cursor()
            try:self.assertEqual('private_fixture_name',cur.execute('SELECT name FROM USERINFO WHERE USERID=99').fetchone()[0])
            finally:cur.close()
        finally:conn.close()


if __name__=='__main__':unittest.main()
