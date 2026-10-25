"""Binding/planes/cierre con SDK y sistema sustituidos; no hardware ni red."""
import contextlib
import copy
import csv
import hashlib
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
sys.path.insert(0, str(ROOT))
import adaptadores_cierre as closures
import vigencias_candidato as core
import puente_sdk_readonly as binding
import ensayo_puente_readonly as trial
from captura_rt import UnsafeClosure

RUN = '80000000-0000-4000-8000-000000000001'
OTHER = '80000000-0000-4000-8000-000000000002'
HEADER = ['tag', 'vigencia_api', 'estado', 'cambiar_access', 'cambiar_c3']
ROWS = [['12345678','2026-11-05 23:59:59','EXISTENTE','False','False'],
        ['22345678','2026-11-05 23:59:59','NO_ENCONTRADO','False','False']]


class ScratchCase(unittest.TestCase):
    def setUp(self):
        self.scratch = ROOT / 'datos' / 'pruebas_puente_readonly'
        self.scratch.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=self.scratch)
        self.folder = Path(self.temp.name)
    def tearDown(self):
        if not self.folder.resolve().is_relative_to(self.scratch.resolve()): raise RuntimeError('Temporal ajeno')
        self.temp.cleanup()


class BridgeTests(ScratchCase):
    def sdk(self, *, serial=None, code=1, raw=None, fault=None):
        events=[]
        def connect(connection):
            events.append('connect')
            return 0 if fault=='connect' else 1
        def param(handle,buffer,size,field):
            self.assertEqual(b'~SerialNumber',field)
            buffer.value=(serial or b'~SerialNumber=CO2K225060027')
            return -1 if fault=='serial' else 0
        def data(handle,buffer,size,table,fields,condition,options):
            self.assertEqual((b'user',b'*',b'',b''),(table,fields,condition,options))
            buffer.value=raw or b'CardNo,Pin,StartTime,EndTime,Password\r\n12345678,42,20200101,20261105,private_fixture\r\n'
            return code
        def disconnect(handle):
            events.append('disconnect')
            if fault=='disconnect': raise RuntimeError('fixture')
        def directory_close():
            events.append('directory_close')
            if fault=='library': raise RuntimeError('fixture')
        sdk=types.SimpleNamespace(Connect=Mock(side_effect=connect),Disconnect=Mock(side_effect=disconnect),
            GetDeviceParam=Mock(side_effect=param),GetDeviceData=Mock(side_effect=data),
            SetDeviceData=Mock(side_effect=AssertionError('SDK write forbidden')),GetRTLog=Mock(side_effect=AssertionError('RT forbidden')))
        directory=types.SimpleNamespace(close=Mock(side_effect=directory_close))
        diag=types.SimpleNamespace(CONNECTION=b'fixture',maintenance_guard=Mock(),
            load_sdk=Mock(return_value=(sdk,directory,{'sha256':closures.SDK_HASH})))
        return diag,sdk,events

    def session(self,payload=None):
        folder=closures.new_session(self.folder/'cierres',RUN,'vigencias')
        raw=core.encoded(payload or {'mode':'read'})
        core.durable(folder/'operation.json',raw)
        return folder,hashlib.sha256(raw).hexdigest()

    def test_native_signatures_reused_inventory_only_and_private_columns_removed(self):
        folder,digest=self.session();diag,sdk,events=self.sdk()
        self.assertEqual(0,binding.run_readonly(folder,digest,lambda:binding.ReadOnlyPanel(diag)))
        self.assertEqual(['connect','disconnect','directory_close'],events)
        closed=closures.verified_closure(folder,os.getpid())
        self.assertTrue(closed['operation_ok'])
        raw=(folder/'response.json').read_bytes()
        self.assertNotIn(b'private_fixture',raw);self.assertNotIn(b'Password',raw)
        sdk.SetDeviceData.assert_not_called();sdk.GetRTLog.assert_not_called()

    def test_apply_payload_rejected_before_maintenance_dll_or_connect(self):
        folder,digest=self.session({'mode':'apply','changes':[{'card':'12345678'}]})
        factory=Mock()
        with self.assertRaises(ValueError): binding.run_readonly(folder,digest,factory)
        factory.assert_not_called()

    def test_binding_write_method_has_no_sdk_path(self):
        panel=binding.ReadOnlyPanel(Mock())
        with self.assertRaises(PermissionError): panel.write_dates({})

    def test_wrong_digest_rejected_before_panel_creation(self):
        folder,digest=self.session();factory=Mock()
        with self.assertRaises(ValueError): binding.run_readonly(folder,'0'*64,factory)
        factory.assert_not_called()

    def test_unexpected_library_hash_never_connects(self):
        folder,digest=self.session();diag,sdk,events=self.sdk()
        diag.load_sdk.return_value[2]['sha256']='0'*64
        binding.run_readonly(folder,digest,lambda:binding.ReadOnlyPanel(diag))
        sdk.Connect.assert_not_called()
        self.assertEqual(['directory_close'],events)

    def test_no_maintenance_prevents_loading_installed_library(self):
        folder,digest=self.session();diag,sdk,events=self.sdk()
        diag.maintenance_guard.side_effect=RuntimeError('fixture')
        binding.run_readonly(folder,digest,lambda:binding.ReadOnlyPanel(diag))
        diag.load_sdk.assert_not_called();sdk.Connect.assert_not_called()
        self.assertEqual([],events)

    def test_wrong_serial_or_param_error_never_queries_inventory(self):
        for kwargs in ({'serial':b'~SerialNumber=OTHER'},{'fault':'serial'}):
            folder,digest=self.session();diag,sdk,events=self.sdk(**kwargs)
            binding.run_readonly(folder,digest,lambda:binding.ReadOnlyPanel(diag))
            sdk.GetDeviceData.assert_not_called()
            self.assertEqual('ControllerIdentityError',closures.verified_closure(folder,os.getpid())['error_type'])

    def test_connect_failure_closes_library_without_disconnect_of_invalid_handle(self):
        folder,digest=self.session();diag,sdk,events=self.sdk(fault='connect')
        binding.run_readonly(folder,digest,lambda:binding.ReadOnlyPanel(diag))
        self.assertEqual(['connect','directory_close'],events)
        sdk.Disconnect.assert_not_called()

    def test_incomplete_duplicate_or_empty_inventory_returns_error_after_close(self):
        for kwargs in ({'code':0},{'code':2},{'raw':b'CardNo,Pin,StartTime,EndTime\r\n1,2,a,b\r\n1,2,a,b\r\n','code':2}):
            folder,digest=self.session();diag,sdk,events=self.sdk(**kwargs)
            binding.run_readonly(folder,digest,lambda:binding.ReadOnlyPanel(diag))
            self.assertFalse(closures.verified_closure(folder,os.getpid())['operation_ok'])
            self.assertEqual(['connect','disconnect','directory_close'],events)

    def test_disconnect_or_library_error_never_confirms_clean_receipt(self):
        for fault in ('disconnect','library'):
            folder,digest=self.session();diag,sdk,events=self.sdk(fault=fault)
            self.assertEqual(1,binding.run_readonly(folder,digest,lambda:binding.ReadOnlyPanel(diag)))
            with self.assertRaises(ValueError): closures.verified_closure(folder,os.getpid())

    def write_plan(self,name,rows=None,header=None):
        folder=self.folder/name
        (folder/'registros').mkdir(parents=True)
        with (folder/'registros'/'plan_fixture.csv').open('w',encoding='utf-8-sig',newline='') as stream:
            writer=csv.writer(stream);writer.writerow(header or HEADER);writer.writerows(ROWS if rows is None else rows)
        return folder

    def test_plan_comparison_ignores_sdk_row_order_and_preserves_all_business_fields(self):
        a=trial.plan(self.write_plan('a'));b=trial.plan(self.write_plan('b',list(reversed(ROWS))))
        result=trial.compare(a,b)
        self.assertTrue(result['equal']);self.assertEqual(result['reference_sha256'],result['candidate_sha256'])

    def test_diff_reports_missing_added_expiration_and_change_flags(self):
        a=trial.plan(self.write_plan('a'));b=copy.deepcopy(a)
        b.pop('22345678');b['33333333']=dict(b['12345678']);b['12345678']['cambiar_c3']='True'
        b['12345678']['vigencia_api']='2026-12-05 23:59:59'
        result=trial.compare(a,b)
        self.assertFalse(result['equal'])
        self.assertEqual((1,1,1),(result['missing_count'],result['added_count'],result['changed_count']))

    def test_invalid_csv_never_becomes_equal_empty_plans(self):
        for i,rows in enumerate(([],[ROWS[0],ROWS[0]],[ROWS[0][:-1]],[['bad',*ROWS[0][1:]]])):
            with self.assertRaises(ValueError): trial.plan(self.write_plan(str(i),rows))
        with self.assertRaises(ValueError): trial.plan(self.write_plan('headers',header=['bad']))

    def test_pair_runs_reference_then_candidate_and_can_stop_between(self):
        folders=(self.write_plan('a'),self.write_plan('b'));events=[]
        a=lambda:events.append('reference');b=lambda:events.append('candidate')
        result=trial.pair(a,b,folders,lambda:False,lambda state:None)
        self.assertEqual(['reference','candidate'],events);self.assertTrue(result['comparison']['equal'])
        events.clear()
        result=trial.pair(a,b,folders,lambda:len(events)>0,lambda state:None)
        self.assertEqual(['reference'],events);self.assertIsNone(result['comparison']);self.assertEqual('requested',result['stop_reason'])

    def test_reference_error_does_not_start_candidate(self):
        reference=Mock(side_effect=RuntimeError('fixture'));candidate=Mock()
        with self.assertRaises(RuntimeError): trial.pair(reference,candidate,(None,None),lambda:False,lambda state:None)
        candidate.assert_not_called()

    def test_unknown_reader_polling_and_reused_pid_block_closure(self):
        for role in ('polling','trial','zkaccess','other_sanisidro','unclassified_python'):
            with self.assertRaises(RuntimeError): trial.quiet({'processes':[{'pid':1,'role':role}]})
        with self.assertRaises(RuntimeError): trial.quiet({'processes':[{'pid':42,'role':'external'}]},[42])

    def test_watchdog_exception_requires_exact_path_bytes_and_real_script_position(self):
        sync=self.folder/'sync';sync.mkdir();monitor=sync/'vigilar_sync.py';monitor.write_bytes(b'fixture')
        row={'pid':1,'role':'other_sanisidro','command':'fixture'}
        inspect=types.SimpleNamespace(argv_windows=Mock(return_value=['python.exe','-B',str(monitor)]))
        with patch.object(trial,'SYNC',sync),patch.object(trial,'MONITOR_SHA',hashlib.sha256(b'fixture').hexdigest()),patch.object(trial,'inspector',return_value=inspect):
            trial.quiet({'processes':[row]})
            monitor.write_bytes(b'other')
            with self.assertRaises(RuntimeError): trial.quiet({'processes':[row]})
            monitor.write_bytes(b'fixture');inspect.argv_windows.return_value=['python.exe','-c',str(monitor)]
            with self.assertRaises(RuntimeError): trial.quiet({'processes':[row]})

    def test_receipts_bound_to_current_run_and_reject_non_readonly_operation(self):
        data=self.folder/'data';base=data/'cierres'
        folder=closures.new_session(base,RUN,'vigencias');request=closures.request_at(folder/'request.json')
        raw=b'{"12345678":{"CardNo":"12345678","Pin":"42","StartTime":"20200101","EndTime":"20261105"}}'
        (folder/'response.json').write_bytes(raw)
        closures.write_closure(folder,request,started=closures.now(),closed=True,operation_ok=True,sdk_sha256=closures.SDK_HASH,response=raw)
        closures.acknowledge(folder,os.getpid())
        with patch.object(trial,'DATA',data):
            self.assertEqual(1,len(trial.receipts(RUN)['current']))
            self.assertEqual([],trial.receipts(OTHER)['current'])
            (folder/'operation.json').write_text('{"mode":"apply"}')
            with patch.object(core,'check_operations',return_value=1):
                with self.assertRaises(ValueError): trial.receipts(RUN)

    def verify_fixture(self):
        state={'pid':123456789,'run_id':RUN,'phase':'stopped'}
        proof={'total':16,'current':[{'worker_id':OTHER,'pid':123456788}]}
        result=state|{'receipts':proof}
        read=Mock(side_effect=[copy.deepcopy(state),copy.deepcopy(result),copy.deepcopy(state)])
        publisher=types.SimpleNamespace(read=read)
        diag=types.SimpleNamespace(maintenance_lock=contextlib.nullcontext)
        inspect=types.SimpleNamespace(inventory=lambda:{'processes':[]})
        return state,proof,publisher,diag,inspect

    def test_final_verification_checks_receipts_and_current_inventory_without_sdk(self):
        state,proof,publisher,diag,inspect=self.verify_fixture()
        with patch.object(trial,'publisher',return_value=publisher),patch.object(closures,'diagnostic_module',return_value=diag), \
             patch.object(trial,'inspector',return_value=inspect),patch.object(trial,'receipts',return_value=proof), \
             patch.object(trial,'DATA',self.folder/'data'),contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(0,trial.verify_closed())
        self.assertEqual('cierre_puente_confirmado',json.loads(output.getvalue())['status'])

    def test_final_verification_blocks_changed_state_and_receipts(self):
        for fault in ('state','receipts','pid'):
            state,proof,publisher,diag,inspect=self.verify_fixture()
            returned=copy.deepcopy(proof)
            if fault=='state': publisher.read.side_effect=[state,state|{'receipts':proof},state|{'run_id':OTHER}]
            if fault=='receipts': returned['total']+=1
            if fault=='pid': inspect.inventory=lambda:{'processes':[{'pid':state['pid'],'role':'external'}]}
            with patch.object(trial,'publisher',return_value=publisher),patch.object(closures,'diagnostic_module',return_value=diag), \
                 patch.object(trial,'inspector',return_value=inspect),patch.object(trial,'receipts',return_value=returned),patch.object(trial,'DATA',self.folder/'data'):
                with self.assertRaises((RuntimeError,UnsafeClosure)):
                    trial.verify_closed()


class ManualTests(ScratchCase):
    def fixture_manual(self,stack,*,fail=False):
        root=self.folder/'paquete';root.mkdir()
        data=self.folder/'almacen';data.mkdir()
        sync=self.folder/'sync';sync.mkdir();(sync/'fixture.py').write_bytes(b'fixture')
        gestor=self.folder/'gestor';gestor.mkdir();(gestor/'mantenimiento.json').write_text('{"active":true}')
        diag=types.SimpleNamespace(GESTOR=gestor,maintenance_guard=Mock(),maintenance_lock=contextlib.nullcontext)
        def read(path,maximum=131072): return json.loads(Path(path).read_text(encoding='utf-8'))
        def save(path,value): Path(path).write_text(json.dumps(value),encoding='utf-8')
        pub=types.SimpleNamespace(read=read,save=save,own_lock=lambda path:contextlib.nullcontext())
        calls=[]
        def cycle(kind,gate,base,run_id):
            module=types.SimpleNamespace(ROOT=None)
            def run():
                calls.append(kind)
                if fail and kind=='candidate': raise RuntimeError('fixture')
                (module.ROOT/'registros').mkdir(parents=True,exist_ok=True)
                with (module.ROOT/'registros'/'plan_fixture.csv').open('w',encoding='utf-8-sig',newline='') as stream:
                    writer=csv.writer(stream);writer.writerow(HEADER);writer.writerows(ROWS)
                folder=closures.new_session(base,run_id,'vigencias')
                request=closures.request_at(folder/'request.json');raw=b'{"fixture":"inventory"}'
                (folder/'response.json').write_bytes(raw)
                closures.write_closure(folder,request,started=closures.now(),closed=True,operation_ok=True,sdk_sha256=closures.SDK_HASH,response=raw)
                value=json.loads((folder/'closed.json').read_bytes());value['pid']=123456701+len(calls)
                (folder/'closed.json').write_text(json.dumps(value))
                closures.acknowledge(folder,value['pid'])
            return types.SimpleNamespace(module=module,__call__=run),run
        def reference(password,gate,base,python,run_id):
            value,run=cycle('reference',gate,base,run_id)
            class Reference:
                module=value.module
                def __call__(self): return run()
            return Reference()
        candidate_modes=[]
        def candidate(password,exchange,workdir,*,apply):
            candidate_modes.append(apply)
            value,run=cycle('candidate',exchange.gate,exchange.base,exchange.run_id)
            value.module.ROOT=Path(workdir)
            class Candidate:
                module=value.module
                def __call__(self): return run()
            return Candidate()
        for name,value in [('ROOT',root),('DATA',data),('SYNC',sync),('EXPECTED',{'fixture.py':hashlib.sha256(b'fixture').hexdigest()})]:
            stack.enter_context(patch.object(trial,name,value))
        stack.enter_context(patch.object(trial,'publisher',return_value=pub))
        stack.enter_context(patch.object(trial,'inspector',return_value=types.SimpleNamespace(inventory=lambda:{'processes':[]})))
        stack.enter_context(patch.object(closures,'diagnostic_module',return_value=diag))
        stack.enter_context(patch.object(closures,'SafeReferenceProbe',side_effect=reference))
        stack.enter_context(patch.object(core,'ReferenceCycle',side_effect=candidate))
        stack.enter_context(patch.object(trial.struct,'calcsize',return_value=8))
        stack.enter_context(patch.dict(os.environ,{'SANISIDRO_ACCESS_PASSWORD':'private_fixture'}))
        return root,data,calls,candidate_modes

    def test_manual_saves_two_closed_plans_and_explicit_readonly_mode(self):
        with contextlib.ExitStack() as stack,contextlib.redirect_stdout(io.StringIO()):
            root,data,calls,modes=self.fixture_manual(stack)
            self.assertEqual(0,trial.manual())
            state=json.loads((root/'estado_puente.json').read_bytes())
            result=json.loads((root/'datos'/'sesiones'/state['run_id']/'resultado.json').read_bytes())
        self.assertEqual(['reference','candidate'],calls);self.assertEqual([False],modes)
        self.assertEqual('stopped',state['phase']);self.assertTrue(result['trial_passed'])
        self.assertEqual(2,len(result['receipts']['current']))
        self.assertNotIn('private_fixture',json.dumps(result))

    def test_manual_failure_keeps_fault_and_rejects_another_run(self):
        with contextlib.ExitStack() as stack,contextlib.redirect_stdout(io.StringIO()):
            root,data,calls,modes=self.fixture_manual(stack,fail=True)
            self.assertEqual(1,trial.manual())
            state=json.loads((root/'estado_puente.json').read_bytes())
            self.assertEqual('fault',state['phase'])
            with self.assertRaises(RuntimeError): trial.manual()
        self.assertEqual(['reference','candidate'],calls)


class CliTests(unittest.TestCase):
    def test_no_cli_option_can_enable_apply(self):
        with patch.object(sys,'argv',['ensayo_puente_readonly.py','--aplicar']), \
             patch.object(trial,'verify_package') as verify,contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit): trial.main()
        verify.assert_not_called()


if __name__=='__main__': unittest.main()
