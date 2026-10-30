"""Motor r2 real sobre Panel ficticio. Sin C3, red, MDB instalada ni tareas."""
import copy
from datetime import datetime,timezone,timedelta
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock,patch
import uuid

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import adaptadores_cierre as closed
import produccion_config as config
import produccion_r2 as production
import referencia_vigencias as reference


def panel_fixture(rows,*,fail_write=False,fail_close=False,alter_permissions=False):
    data=copy.deepcopy(rows);events=[];permissions=[{'Pin':'693','AuthorizeDoorId':'3','AuthorizeTimezoneId':'2'}]
    class Panel:
        def __enter__(self): events.append('connect');return self
        def __exit__(self,*args):
            events.append('disconnect')
            if fail_close: raise OSError('fake_disconnect_failure')
        def inventory(self): return self.read('user','')
        def read(self,table,condition):
            events.append('read')
            if table=='userauthorize': return copy.deepcopy(permissions)
            return copy.deepcopy(data)
        def user(self,card): return next(copy.deepcopy(row) for row in data if row['CardNo']==card)
        def write(self,row):
            events.append('set')
            if fail_write: raise RuntimeError('fake_set_failure')
            data[:]=[copy.deepcopy(row) if item['CardNo']==row['CardNo'] else item for item in data]
            if alter_permissions: permissions.append({'fixture_changed':'1'})
    return Panel,data,events


class OriginalEngineTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_produccion';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base);self.root=Path(self.temp.name)
        self.sources=reference._verified_sources()
        self.rows=[{'CardNo':'12230693','Pin':'693','Password':'fixture_only','Group':'0',
                    'StartTime':'20200101','EndTime':'20261105','SuperAuthorize':'0'}]

    def tearDown(self): self.temp.cleanup()

    def payload(self):
        return {'mode':'apply','changes':[{'card':'12230693','before':{k:self.rows[0][k] for k in ('CardNo','Pin','StartTime','EndTime')},'end':'20261205'}]}

    def wrapped(self,payload,**options):
        folder=closed.new_session(self.root/'cierres',str(uuid.uuid4()),'vigencias')
        raw=json.dumps(payload).encode();(folder/'r2_operation.json').write_bytes(raw)
        panel,data,events=panel_fixture(self.rows,**options)
        guard=Mock()
        code=production.execute_worker(folder,hashlib.sha256(raw).hexdigest(),guard=guard,panel_factory=panel,sources=self.sources)
        return folder,code,data,events,guard

    def original(self,payload,**options):
        folder=self.root/str(uuid.uuid4());folder.mkdir()
        (folder/'input.json').write_text(json.dumps(payload))
        panel,data,events=panel_fixture(self.rows,**options)
        previous=sys.modules.get('c3_panel');argv=sys.argv
        sys.modules['c3_panel']=types.SimpleNamespace(Panel=panel)
        try:
            module=reference.load_module('_baseline_worker',reference.ROOT/'c3_worker.py',self.sources['c3_worker.py'])
            sys.argv=['worker',str(folder/'input.json'),str(folder/'output.json')]
            module.main()
        finally:
            sys.argv=argv
            if previous is None: sys.modules.pop('c3_panel',None)
            else: sys.modules['c3_panel']=previous
        return json.loads((folder/'output.json').read_bytes()),data,events

    def test_inventory_matches_original_bytes_and_does_not_include_password_in_response(self):
        expected,data,events=self.original({'mode':'read'})
        folder,code,actual,trace,guard=self.wrapped({'mode':'read'})
        self.assertEqual(0,code);self.assertEqual(expected,json.loads((folder/'response.json').read_bytes()))
        self.assertEqual(data,actual);self.assertEqual(events,trace)
        self.assertNotIn(b'Password',(folder/'response.json').read_bytes());self.assertGreater(guard.call_count,1)

    def test_apply_matches_original_and_preserves_every_other_user_field(self):
        expected,data,events=self.original(self.payload())
        folder,code,actual,trace,_=self.wrapped(self.payload())
        self.assertEqual(0,code);self.assertEqual(expected,json.loads((folder/'response.json').read_bytes()))
        self.assertEqual(data,actual);self.assertEqual(events,trace)
        self.assertEqual('20261205',actual[0]['EndTime']);self.assertEqual('fixture_only',actual[0]['Password'])
        self.assertTrue(closed.bounded_json(folder/'closed.json')['closed'])

    def test_set_failure_remains_a_failed_tag_with_clean_closure(self):
        expected,data,events=self.original(self.payload(),fail_write=True)
        folder,code,actual,trace,_=self.wrapped(self.payload(),fail_write=True)
        self.assertEqual(0,code);self.assertEqual(expected,json.loads((folder/'response.json').read_bytes()))
        self.assertFalse(expected['12230693']['ok']);self.assertEqual(data,actual);self.assertEqual(events,trace)

    def test_concurrent_change_is_rejected_before_set_like_original(self):
        payload=self.payload();payload['changes'][0]['before']['Pin']='old_fixture_pin'
        expected,_,_=self.original(payload)
        folder,_,_,events,_=self.wrapped(payload)
        self.assertEqual(expected,json.loads((folder/'response.json').read_bytes()));self.assertNotIn('set',events)

    def test_permission_change_is_rejected_like_original(self):
        expected,_,_=self.original(self.payload(),alter_permissions=True)
        folder,_,_,_,_=self.wrapped(self.payload(),alter_permissions=True)
        self.assertEqual(expected,json.loads((folder/'response.json').read_bytes()))
        self.assertFalse(expected['12230693']['ok'])

    def test_disconnect_failure_never_becomes_a_clean_receipt(self):
        folder,code,_,_,_=self.wrapped({'mode':'read'},fail_close=True)
        self.assertEqual(1,code)
        self.assertFalse(closed.bounded_json(folder/'closed.json')['closed'])
        with self.assertRaises(ValueError): closed.verified_closure(folder,__import__('os').getpid())

    def test_modified_payload_digest_is_rejected_without_loading_panel(self):
        folder=closed.new_session(self.root/'cierres',str(uuid.uuid4()),'vigencias')
        (folder/'r2_operation.json').write_text('{"mode":"read"}')
        panel,_,events=panel_fixture(self.rows)
        with self.assertRaises(ValueError): production.execute_worker(folder,'0'*64,guard=Mock(),panel_factory=panel,sources=self.sources)
        self.assertEqual([],events)

    def test_cycle_calls_original_apply_and_only_reports_success_after_return(self):
        module=types.SimpleNamespace()
        calls=[]
        def cycle(password,apply,only):
            calls.append((password,apply,only))
            module.logging.info('API=%s; cambios Access=%s; cambios C3=%s; no encontrados=%s; ausentes API sin cambios=%s',841,0,0,4,114)
        module.cycle=cycle
        runner=production.LegacyCycle('fixture_password',self.root,Mock(),module=module)
        result=runner()
        self.assertEqual([('fixture_password',True,None)],calls)
        self.assertEqual(841,result['api_rows']);self.assertEqual('verified',result['status'])
        module.cycle=Mock(side_effect=RuntimeError('fake_cycle_failure'))
        with self.assertRaises(RuntimeError): runner()


class ProductionConfigTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_produccion';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base);self.root=Path(self.temp.name)
        self.value={'protocol':1,'enabled':True,'agent_id':config.AGENT,'serial':config.SERIAL,'url':config.URL,
            'archive_acknowledged':True,'release_sha256':'a'*64,'dates_engine':config.ENGINE}
        self.write()

    def tearDown(self): self.temp.cleanup()

    def write(self):
        (self.root/'servicio-config.json').write_text(json.dumps(self.value))
        value={'protocol':1,'purpose':'production_r2_reference','agent_id':config.AGENT,'serial':config.SERIAL,
            'release_sha256':'a'*64,'config_sha256':hashlib.sha256((self.root/'servicio-config.json').read_bytes()).hexdigest(),
            'dates_engine':config.ENGINE,'reference_sources':reference.EXPECTED,
            'authorized_utc':(datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat()}
        (self.root/'activacion-integrada.json').write_text(json.dumps(value))

    def test_explicit_production_identity_and_truthful_engine_contract(self):
        settings=config.load(self.root);receipt=config.activation(self.root,settings)
        self.assertEqual(config.AGENT,settings.agent_id)
        self.assertNotIn('accepted_checks',receipt)
        self.assertEqual('r2_reference_unchanged',receipt['dates_engine'])

    def test_trial_identity_loopback_and_candidate_engine_are_rejected(self):
        for field,value in [('agent_id','c8d7ccdc-991f-497c-8383-92fb52921f8a'),('url','http://127.0.0.1:18881'),('dates_engine','protected_candidate')]:
            with self.subTest(field=field):
                saved=self.value[field];self.value[field]=value;self.write()
                with self.assertRaises(ValueError): config.load(self.root)
                self.value[field]=saved

    def test_activation_does_not_survive_configuration_change(self):
        settings=config.load(self.root)
        self.value['archive_acknowledged']=False
        (self.root/'servicio-config.json').write_text(json.dumps(self.value))
        with self.assertRaises(PermissionError): config.activation(self.root,settings)

    def test_mismatched_reference_sources_are_rejected(self):
        p=self.root/'activacion-integrada.json';value=json.loads(p.read_bytes())
        value['reference_sources']={};p.write_text(json.dumps(value))
        with self.assertRaises(PermissionError): config.activation(self.root,config.load(self.root))


class NativeBridgeTests(unittest.TestCase):
    def test_native_owner_child_dpapi_ack_archive_and_reopen_without_sdk(self):
        from archivo_cierres import LedgerArchive
        from trabajador_controlado import SDKGate
        import sesion_operativa as ownership
        base=ROOT/'datos'/'pruebas_produccion';base.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=base) as temporary:
            root=Path(temporary)/'ZKSync';root.mkdir()
            (root/'sincronizar_vigencias.py').write_text('# fixture entry, no SDK')
            (root/'sync.lock').write_bytes(b'0')
            (root/'servicio-config.json').write_text('{"fixture":true}')
            data=root/'acceso-datos';data.mkdir()
            ledger=LedgerArchive(data);gate=SDKGate()
            try:
                with ownership.Owner(root,startup_guard=lambda:None) as owner:
                    def command(folder,digest):
                        return [sys.executable,'-B',str(Path(__file__).with_name('produccion_worker_ficticio.py')),
                            '--root',str(root),'--worker',str(folder),'--sha256',digest]
                    bridge=production.Bridge(owner,sys.executable,gate,command=command)
                    result=bridge({'mode':'read'})
                    self.assertEqual('99000177',result['99000177']['CardNo'])
                    self.assertIsNone(gate.active);self.assertFalse(gate.fault)
                    production.check_ledger(data/'cierres')
                    self.assertTrue(ledger.archive(gate,data/'transacciones',guard=owner.guard))
                    self.assertEqual([],list((data/'cierres').iterdir()))
                ledger.recover()
                with ownership.Owner(root,startup_guard=lambda:None,recover_closed=ledger.recover): pass
            finally: ledger.close()


class FullCycleTests(unittest.TestCase):
    def test_verified_cycle_executes_original_api_access_and_c3_order_with_fixtures(self):
        base=ROOT/'datos'/'pruebas_produccion';base.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=base) as temporary:
            root=Path(temporary)
            for name in ('registros','respaldos'): (root/name).mkdir()
            before=datetime(2026,11,5,23,59,59);after=datetime(2026,12,5,23,59,59)
            row=[1108,'12230693',datetime(2020,1,1),before,True]
            events=[]
            class Cursor:
                def execute(self,sql,*args):
                    events.append('access_update' if sql.startswith('UPDATE') else 'access_read')
                    if sql.startswith('UPDATE'): row[2:]=list(args[:3])
                    return self
                def fetchall(self): return [tuple(row)]
                def fetchone(self): return tuple(row[2:])
            class Connection:
                def cursor(self): return Cursor()
                def commit(self): events.append('access_commit')
                def rollback(self): pass
                def close(self): events.append('access_closed')
            module=reference.load_reference()
            def sdk(payload):
                if payload['mode']=='read': return {'12230693':{'CardNo':'12230693','Pin':'693','StartTime':'20200101','EndTime':'20261105'}}
                events.append('c3_apply')
                self.assertEqual('20261205',payload['changes'][0]['end'])
                return {'12230693':{'ok':True}}
            api=Mock();api.__enter__=Mock(return_value=api);api.__exit__=Mock(return_value=False)
            api.read.return_value=json.dumps([{'card_no':'12230693','expiration':'2026-12-05 23:59:59'}]).encode()
            with patch.dict(sys.modules,{'pyodbc':types.SimpleNamespace(connect=lambda *a,**k:Connection())}),patch('urllib.request.urlopen',return_value=api):
                result=production.LegacyCycle('fixture',root,sdk,module=module)()
            self.assertEqual(after,row[3]);self.assertEqual(1,result['verified'])
            self.assertLess(events.index('c3_apply'),events.index('access_update'))
            self.assertLess(events.index('access_update'),events.index('access_commit'))
            self.assertEqual(1,len(list((root/'respaldos').glob('fechas_*.json'))))


if __name__=='__main__': unittest.main(verbosity=2)
