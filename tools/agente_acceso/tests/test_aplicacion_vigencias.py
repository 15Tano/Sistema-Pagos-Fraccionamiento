"""Aplicador acotado con API, Access y SDK sustituidos. Sin autorizaciones reales."""
import copy
import csv
import datetime as dt
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import aplicacion_vigencias as app
import puente_sdk_fechas as binding
import vigencias_candidato as core
import adaptadores_cierre as closures

CARD='12345678'
END=dt.datetime(2026,11,5,23,59,59)
API=[{'card_no':CARD,'expiration':'2026-11-05 23:59:59'}]
ACCESS={'userid':42,'card':CARD,'start':'2020-01-01 00:00:00','end':'2026-10-01 23:59:59','valid_raw':True}
USER={'CardNo':CARD,'Pin':'42','StartTime':'20200101','EndTime':'20261001','Password':'private_fixture','Group':'9','SuperAuthorize':'0'}
C3={k:USER[k] for k in core.FIELDS}


def plan(): return app.make_plan(CARD,API,ACCESS,C3)
def approval(value=None,clock=None):
    value=value or plan()
    return app.Approval(value,confirmed=True,approved_sha256=app.digest(value),**({'clock':clock} if clock else {}))


class ScratchCase(unittest.TestCase):
    def setUp(self):
        self.root=ROOT/'datos'/'pruebas_aplicacion_vigencias';self.root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=self.root);self.folder=Path(self.temp.name)
    def tearDown(self):
        if not self.folder.resolve().is_relative_to(self.root.resolve()): raise RuntimeError('Temporal ajeno')
        self.temp.cleanup()


class ScopeTests(ScratchCase):
    def test_requires_exact_explicit_confirmation_not_just_any_hash(self):
        value=plan()
        for kwargs in ({},{'confirmed':True},{'confirmed':'true','approved_sha256':app.digest(value)},
                       {'confirmed':True,'approved_sha256':'0'*64}):
            with self.assertRaises(app.ScopeRejected): app.Approval(value,**kwargs)

    def test_rejects_api_absent_and_missing_access_or_c3_without_creating_tag(self):
        for api,access,c3 in (([{'card_no':'22345678','expiration':API[0]['expiration']}],ACCESS,C3),(API,None,C3),(API,ACCESS,None)):
            with self.assertRaises(app.ScopeRejected): app.make_plan(CARD,api,access,c3)

    def test_plan_inconsistency_or_extra_fields_rejected(self):
        value=plan()
        for change in ({'serial':'OTHER'},{'card':'22345678'},{'api_end':'2026-11-05 00:00:00'},
                       {'access_change':False},{'c3_change':False},{'protocol':True},{'Password':'no'}):
            with self.assertRaises((ValueError,app.ScopeRejected)): app.validate_plan(value|change)

    def test_scope_and_expiry_future_clock_and_replay_are_rejected(self):
        now=[dt.datetime(2026,10,25,tzinfo=dt.timezone.utc)]
        scope=approval(clock=lambda:now[0])
        with self.assertRaises(app.ScopeRejected): scope.check('22345678')
        with self.assertRaises(app.ScopeRejected): scope.check(CARD,dt.datetime(2026,12,5,23,59,59))
        scope.consume('c3')
        with self.assertRaises(app.ScopeRejected): scope.consume('c3')
        now[0]+=dt.timedelta(seconds=61)
        with self.assertRaises(app.ScopeRejected): scope.check()
        now[0]-=dt.timedelta(seconds=62)
        with self.assertRaises(app.ScopeRejected): scope.check()

    def test_approval_owns_snapshot_not_mutable_plan_reference(self):
        value=plan();scope=approval(value);value['api_end']='2099-01-01 23:59:59'
        returned=scope.plan;returned['card']='22345678'
        self.assertEqual(CARD,scope.check()['card']);self.assertEqual(API[0]['expiration'],scope.plan['api_end'])

    def test_no_change_plan_does_not_force_a_demonstration_write(self):
        access=dict(ACCESS,end=API[0]['expiration']);c3=dict(C3,EndTime='20261105')
        value=app.make_plan(CARD,API,access,c3)
        self.assertFalse(value['access_change']);self.assertFalse(value['c3_change'])

    def test_backup_is_durable_before_success_and_refuses_overwrite(self):
        target=self.folder/'backup';value=plan();app.backup(target,value)
        self.assertEqual(value,json.loads((target/'plan.json').read_bytes()))
        self.assertEqual(app.digest(value),json.loads((target/'backup.json').read_bytes())['plan_sha256'])
        with self.assertRaises(FileExistsError): app.backup(target,value)
        self.assertNotIn(b'private_fixture',(target/'backup.json').read_bytes())

    def test_access_cannot_be_updated_before_pending_c3_is_verified(self):
        connection=Mock();connection.autocommit=False;access=app.AccessDates(connection)
        with self.assertRaises(app.ScopeRejected): access.update(ACCESS,END,approval())
        connection.cursor.assert_not_called()

    def test_autocommit_connection_is_rejected_before_sql(self):
        connection=Mock();connection.autocommit=True
        with self.assertRaises(app.ScopeRejected): app.AccessDates(connection)
        connection.cursor.assert_not_called()


class ExecutionTests(ScratchCase):
    def execute(self,*,api=None,access_error=None,c3_result=None,access_before=None,c3_before=None,value=None):
        value=value or plan();scope=approval(value)
        access=types.SimpleNamespace(read=Mock(return_value=access_before or value['access_before']),
            update=Mock(side_effect=access_error))
        fetch=Mock(side_effect=api) if api else Mock(return_value=copy.deepcopy(API))
        read=Mock(return_value=c3_before or value['c3_before'])
        def write(payload,permit,session):
            self.assertTrue((session/'backup.json').is_file());self.assertTrue((session/'intent_c3.json').is_file())
            self.assertEqual(scope,permit)
            return c3_result or {CARD:{'ok':True}}
        apply=Mock(side_effect=write)
        error=result=None
        try: result=app.execute(scope,fetch,access,read,apply,self.folder/'evidencia')
        except BaseException as exc: error=exc
        return result,error,access,read,apply,fetch

    def test_success_saves_intents_and_verified_result_and_requeries_api(self):
        result,error,access,read,apply,fetch=self.execute()
        self.assertIsNone(error);self.assertEqual('verified',result['status'])
        self.assertEqual(3,fetch.call_count);apply.assert_called_once();access.update.assert_called_once()
        session=next((self.folder/'evidencia').iterdir())
        self.assertEqual(result,json.loads((session/'result.json').read_bytes()))
        self.assertTrue((session/'intent_access.json').exists());app.check_evidence(self.folder/'evidencia')

    def test_api_changed_before_first_write_blocks_every_component(self):
        changed=[{'card_no':CARD,'expiration':'2026-12-05 23:59:59'}]
        result,error,access,read,apply,fetch=self.execute(api=[changed])
        self.assertIsInstance(error,app.ScopeRejected);apply.assert_not_called();access.update.assert_not_called()
        self.assertFalse((self.folder/'evidencia').exists())

    def test_api_change_after_c3_prevents_access_and_requires_review(self):
        changed=[{'card_no':CARD,'expiration':'2026-12-05 23:59:59'}]
        result,error,access,read,apply,fetch=self.execute(api=[API,API,changed])
        self.assertIsInstance(error,core.ReviewRequired);apply.assert_called_once();access.update.assert_not_called()
        session=next((self.folder/'evidencia').iterdir());result=json.loads((session/'result.json').read_bytes())
        self.assertEqual('verified',result['c3']);self.assertEqual('requires_review',result['status'])

    def test_optimistic_snapshot_mismatch_does_not_write_anywhere(self):
        for kwargs in ({'access_before':dict(ACCESS,userid=99)},{'c3_before':dict(C3,Pin='99')}):
            result,error,access,read,apply,fetch=self.execute(**kwargs)
            self.assertIsInstance(error,app.ScopeRejected);apply.assert_not_called();access.update.assert_not_called()

    def test_access_failure_preserves_c3_verified_and_evidence_not_fake_rollback(self):
        result,error,access,read,apply,fetch=self.execute(access_error=RuntimeError('private_fixture'))
        self.assertIsInstance(error,core.ReviewRequired)
        session=next((self.folder/'evidencia').iterdir());raw=(session/'result.json').read_bytes()
        self.assertNotIn(b'private_fixture',raw);self.assertEqual('verified',json.loads(raw)['c3'])
        self.assertEqual('unconfirmed',json.loads(raw)['access'])
        with self.assertRaises(core.ReviewRequired): app.check_evidence(self.folder/'evidencia')

    def test_c3_failure_never_calls_access_update(self):
        result,error,access,read,apply,fetch=self.execute(c3_result={CARD:{'ok':False,'requires_review':True}})
        self.assertIsInstance(error,core.ReviewRequired);access.update.assert_not_called()

    def test_backup_write_failure_prevents_every_write(self):
        original=core.durable
        def fail(path,raw):
            if Path(path).name=='backup.json': raise OSError('disk full')
            return original(path,raw)
        with patch.object(core,'durable',side_effect=fail):
            result,error,access,read,apply,fetch=self.execute()
        self.assertIsInstance(error,OSError);apply.assert_not_called();access.update.assert_not_called()

    def test_no_changes_still_checks_sources_but_never_writes(self):
        value=app.make_plan(CARD,API,dict(ACCESS,end=API[0]['expiration']),dict(C3,EndTime='20261105'))
        result,error,access,read,apply,fetch=self.execute(value=value)
        self.assertIsNone(error);self.assertEqual('no_changes',result['status'])
        apply.assert_not_called();access.update.assert_not_called()

    def test_crash_intent_without_result_blocks_new_attempt_after_restart(self):
        folder=self.folder/'evidencia'/'70000000-0000-4000-8000-000000000001';app.backup(folder,plan())
        core.durable(folder/'intent_access.json',b'{}')
        result,error,access,read,apply,fetch=self.execute()
        self.assertIsInstance(error,core.ReviewRequired);fetch.assert_not_called();apply.assert_not_called();access.update.assert_not_called()

    def test_result_persistence_failure_after_writes_requires_review_and_blocks_restart(self):
        original=core.durable
        def fail(path,raw):
            if Path(path).name=='result.json': raise OSError('disk full')
            return original(path,raw)
        with patch.object(core,'durable',side_effect=fail):
            result,error,access,read,apply,fetch=self.execute()
        self.assertIsInstance(error,core.ReviewRequired);apply.assert_called_once();access.update.assert_called_once()
        with self.assertRaises(core.ReviewRequired): app.check_evidence(self.folder/'evidencia')

    def test_partial_result_file_also_blocks_restart(self):
        original=core.durable
        def fail(path,raw):
            if Path(path).name=='result.json':
                Path(path).write_bytes(b'{')
                raise OSError('partial write')
            return original(path,raw)
        with patch.object(core,'durable',side_effect=fail):
            result,error,access,read,apply,fetch=self.execute()
        self.assertIsInstance(error,core.ReviewRequired)
        with self.assertRaises(core.ReviewRequired): app.check_evidence(self.folder/'evidencia')

    def test_tampered_backup_or_intent_cannot_be_hidden_by_verified_result(self):
        result,error,access,read,apply,fetch=self.execute();self.assertIsNone(error)
        session=next((self.folder/'evidencia').iterdir())
        path=session/'backup.json';old=path.read_bytes();path.write_text('{}')
        with self.assertRaises(core.ReviewRequired): app.check_evidence(self.folder/'evidencia')
        path.write_bytes(old)
        (session/'intent_access.json').write_text('{}')
        with self.assertRaises(core.ReviewRequired): app.check_evidence(self.folder/'evidencia')


class BindingTests(ScratchCase):
    def fake(self,*,fault=None,scope=None,evidence=None):
        scope=scope or approval();rows={CARD:copy.deepcopy(USER)};events=[];writes=[]
        evidence=Path(evidence or self.folder)
        permits=[{'Pin':'42','AuthorizeTimezoneId':'1','AuthorizeDoorId':'1'},
                 {'Pin':'42','AuthorizeTimezoneId':'1','AuthorizeDoorId':'2'}]
        def connect(connection): events.append('connect');return 1
        def serial(handle,buffer,size,field):
            buffer.value=b'~SerialNumber=WRONG' if fault=='serial' else b'~SerialNumber=CO2K225060027';return 0
        def data(handle,buffer,size,table,fields,condition,options):
            if table==b'user': records=list(rows.values())
            elif table==b'userauthorize':
                records=copy.deepcopy(permits)
                if fault=='permission' and writes: records[0]['AuthorizeDoorId']='9'
            else: raise AssertionError('Tabla ajena')
            out=io.StringIO();writer=csv.DictWriter(out,fieldnames=list(records[0]))
            writer.writeheader();writer.writerows(records);buffer.value=out.getvalue().encode()
            return len(records)
        def set_data(handle,table,payload,options):
            self.assertEqual((b'user',b''),(table,options))
            change=dict(pair.split('=',1) for pair in payload.decode().split('\t'))
            self.assertEqual(core.FIELDS,set(change));self.assertTrue((evidence/'write_attempt.json').exists())
            writes.append(change);rows[change['CardNo']].update(change)
            if fault=='group': rows[CARD]['Group']='CHANGED'
            return -2 if fault=='sdk_code' else 0
        sdk=types.SimpleNamespace(Connect=Mock(side_effect=connect),Disconnect=Mock(side_effect=lambda h:events.append('disconnect')),
            GetDeviceParam=Mock(side_effect=serial),GetDeviceData=Mock(side_effect=data),SetDeviceData=Mock(side_effect=set_data))
        diag=types.SimpleNamespace(CONNECTION=b'fixture',maintenance_guard=Mock(),
            load_sdk=Mock(return_value=(sdk,types.SimpleNamespace(close=lambda:events.append('library_close')),{'sha256':closures.SDK_HASH})))
        panel=binding.DatesPanel(scope,evidence,diag)
        return panel,sdk,diag,rows,writes,events

    def test_missing_approval_never_loads_dll(self):
        diag=Mock()
        with self.assertRaises(app.ScopeRejected): binding.DatesPanel(None,self.folder,diag)
        diag.load_sdk.assert_not_called()

    def test_abi_is_set_before_connect_and_only_four_fields_are_written(self):
        panel,sdk,diag,rows,writes,events=self.fake()
        connect=sdk.Connect.side_effect
        def checked(connection):
            self.assertEqual(4,len(sdk.SetDeviceData.argtypes));self.assertEqual(binding.ctypes.c_int,sdk.SetDeviceData.restype)
            return connect(connection)
        sdk.Connect.side_effect=checked
        panel.open();self.assertEqual(core.SERIAL,panel.serial())
        result=core.apply_dates(panel,[{'card':CARD,'before':C3,'end':'20261105'}])
        panel.disconnect();panel.close_library()
        self.assertEqual({CARD:{'ok':True}},result)
        self.assertEqual(dict(USER,EndTime='20261105'),rows[CARD]);self.assertEqual(1,len(writes))
        self.assertEqual(['connect','disconnect','library_close'],events)
        self.assertNotIn('private_fixture',(self.folder/'write_attempt.json').read_text())

    def test_wrong_card_pin_start_or_end_cannot_reach_sdk_write(self):
        panel,sdk,diag,rows,writes,events=self.fake();panel.open();panel.serial()
        expected={'CardNo':CARD,'Pin':'42','StartTime':'20200101','EndTime':'20261105'}
        for changes in ({'CardNo':'22345678'},{'Pin':'99'},{'StartTime':'20210101'},{'EndTime':'20261205'},{'Password':'bad'}):
            with self.assertRaises(app.ScopeRejected): panel.write_dates(expected|changes)
        sdk.SetDeviceData.assert_not_called();panel.disconnect();panel.close_library()

    def test_direct_write_without_serial_confirmation_is_blocked(self):
        panel,sdk,diag,rows,writes,events=self.fake();panel.open()
        with self.assertRaises(app.ScopeRejected): panel.write_dates({'CardNo':CARD,'Pin':'42','StartTime':'20200101','EndTime':'20261105'})
        sdk.SetDeviceData.assert_not_called();panel.disconnect();panel.close_library()

    def test_group_permission_and_sdk_error_are_postwrite_review_not_success(self):
        for fault in ('group','permission','sdk_code'):
            evidence=self.folder/fault;evidence.mkdir()
            panel,sdk,diag,rows,writes,events=self.fake(fault=fault,evidence=evidence)
            panel.open();panel.serial()
            result=core.apply_dates(panel,[{'card':CARD,'before':C3,'end':'20261105'}])
            self.assertTrue(result[CARD]['requires_review']);self.assertFalse(result[CARD]['ok'])
            self.assertEqual(1,len(writes));self.assertEqual('20261105',rows[CARD]['EndTime'])
            if fault=='group': self.assertEqual('CHANGED',rows[CARD]['Group'])
            panel.disconnect();panel.close_library()

    def test_expired_scope_and_missing_export_fail_before_connect(self):
        clock=[dt.datetime(2026,10,25,tzinfo=dt.timezone.utc)];scope=approval(clock=lambda:clock[0])
        panel,sdk,diag,rows,writes,events=self.fake(scope=scope);clock[0]+=dt.timedelta(seconds=61)
        with self.assertRaises(app.ScopeRejected): panel.open()
        diag.load_sdk.assert_not_called()
        panel,sdk,diag,rows,writes,events=self.fake();del sdk.SetDeviceData
        with self.assertRaises(AttributeError): panel.open()
        sdk.Connect.assert_not_called();panel.disconnect();panel.close_library()

    def test_write_attempt_marker_prevents_replay_even_with_new_approval(self):
        for attempt in range(2):
            panel,sdk,diag,rows,writes,events=self.fake();panel.open();panel.serial()
            if attempt==0: panel.write_dates({'CardNo':CARD,'Pin':'42','StartTime':'20200101','EndTime':'20261105'})
            else:
                with self.assertRaises(FileExistsError): panel.write_dates({'CardNo':CARD,'Pin':'42','StartTime':'20200101','EndTime':'20261105'})
                sdk.SetDeviceData.assert_not_called()
            panel.disconnect();panel.close_library()

    def worker_fixture(self):
        scope=approval();back=self.folder/'backup';app.backup(back,scope.plan)
        core.durable(back/'intent_c3.json',core.encoded({'plan_sha256':scope.sha256,'component':'c3'}))
        folder=closures.new_session(self.folder/'cierres','90000000-0000-4000-8000-000000000001','vigencias')
        payload={'mode':'apply','changes':[{'card':CARD,'before':C3,'end':'20261105'}]}
        raw=core.encoded(payload);core.durable(folder/'operation.json',raw)
        return scope,back,folder,payload,binding.hashlib.sha256(raw).hexdigest()

    def test_scoped_worker_rejects_extra_tag_or_wrong_backup_before_open(self):
        scope,back,folder,payload,digest=self.worker_fixture();diag=Mock()
        payload['changes'].append(dict(payload['changes'][0],card='22345678'))
        raw=core.encoded(payload);(folder/'operation.json').write_bytes(raw)
        with self.assertRaises(app.ScopeRejected): binding.run_scoped_worker(folder,binding.hashlib.sha256(raw).hexdigest(),scope,back,diag)
        diag.load_sdk.assert_not_called()
        payload['changes'].pop();raw=core.encoded(payload);(folder/'operation.json').write_bytes(raw)
        (back/'backup.json').write_text('{}')
        with self.assertRaises(app.ScopeRejected): binding.run_scoped_worker(folder,binding.hashlib.sha256(raw).hexdigest(),scope,back,diag)
        diag.load_sdk.assert_not_called()

    def test_scoped_worker_writes_only_exact_plan_and_closes_before_receipt(self):
        scope,back,folder,payload,digest=self.worker_fixture()
        panel,sdk,diag,rows,writes,events=self.fake(scope=scope,evidence=folder)
        self.assertEqual(0,binding.run_scoped_worker(folder,digest,scope,back,diag))
        closed=closures.verified_closure(folder,os.getpid())
        self.assertTrue(closed['operation_ok']);self.assertEqual(['connect','disconnect','library_close'],events)
        self.assertEqual({CARD:{'ok':True}},json.loads((folder/'response.json').read_bytes())['data'])
        for path in list(folder.glob('*.json'))+list(back.glob('*.json')):
            self.assertNotIn(b'private_fixture',path.read_bytes())
        with self.assertRaises(app.ScopeRejected): binding.run_scoped_worker(folder,digest,approval(),back,diag)
        self.assertEqual(1,sdk.Connect.call_count)

    def test_no_change_plan_has_no_c3_write_path(self):
        value=app.make_plan(CARD,API,ACCESS,dict(C3,EndTime='20261105'));scope=approval(value)
        panel,sdk,diag,rows,writes,events=self.fake(scope=scope)
        with self.assertRaises(app.ScopeRejected): panel.open()
        diag.load_sdk.assert_not_called()


class PolicyParityTests(ScratchCase):
    def test_plan_flags_match_frozen_r2_with_null_false_and_expired_api_dates(self):
        cases=[(None,None,None,'2026-11-05 23:59:59',C3),
               (app.START,END,False,'2026-11-05 23:59:59',dict(C3,EndTime='20261105')),
               (app.START,END,True,'2026-09-05 23:59:59',C3)]
        for index,(start,end,valid,expiration,c3) in enumerate(cases):
            module=app.load_reference();module.ROOT=self.folder/str(index)
            (module.ROOT/'registros').mkdir(parents=True)
            row=[42,CARD,start,end,valid];connection=Mock()
            connection.cursor.return_value.fetchall.return_value=[row]
            module.worker=Mock(return_value={CARD:c3})
            api=[{'card_no':CARD,'expiration':expiration}]
            with patch.dict(sys.modules,{'pyodbc':types.SimpleNamespace(connect=Mock(return_value=connection))}), \
                 patch.object(module.urllib.request,'urlopen',return_value=io.BytesIO(json.dumps(api).encode())):
                module.cycle('private_fixture',False,None)
            with next((module.ROOT/'registros').glob('plan_*.csv')).open(encoding='utf-8-sig') as stream:
                old=next(csv.DictReader(stream))
            new=app.make_plan(CARD,api,app.access_snapshot(row),c3)
            self.assertEqual(old['vigencia_api'],new['api_end'])
            self.assertEqual(old['cambiar_access'],str(new['access_change']))
            self.assertEqual(old['cambiar_c3'],str(new['c3_change']))

    def test_expired_api_date_is_not_replaced_with_an_invented_date(self):
        api=[{'card_no':CARD,'expiration':'2026-09-05 23:59:59'}]
        value=app.make_plan(CARD,api,ACCESS,C3);scope=approval(value)
        access=types.SimpleNamespace(read=Mock(return_value=ACCESS),update=Mock())
        apply=Mock(return_value={CARD:{'ok':True}})
        result=app.execute(scope,lambda:api,access,lambda card:C3,apply,self.folder/'evidence')
        self.assertEqual('verified',result['status'])
        self.assertEqual('20260905',apply.call_args.args[0]['changes'][0]['end'])
        self.assertEqual(dt.datetime(2026,9,5,23,59,59),access.update.call_args.args[1])


if __name__=='__main__': unittest.main()
