"""Procesos Python reales, SDK/API/MDB ficticios y DPAPI del usuario de prueba."""
import copy
import contextlib
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
import uuid
from unittest.mock import Mock,patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import transporte_aplicador as t
import test_aplicador_integrado as base
import test_aplicacion_vigencias as f


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.root=ROOT/'datos'/'pruebas_transporte';self.root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=self.root);self.folder=Path(self.temp.name)
        self.work=self.folder/'data';self.work.mkdir()
        self.state=self.work/'fixture_sdk.json'
        self.state.write_text(json.dumps({'user':f.USER,'permits':base.p.PERMITS}))
        self.python=os.environ.get('SI_TEST_CHILD_PYTHON',sys.executable)
        self.gate=t.SDKGate();self.guard=Mock()
        self.transport=t.Transport(self.work,self.python,gate=self.gate,guard=self.guard,command_factory=self.command,timeout=20)
        self.run=str(uuid.uuid4())

    def tearDown(self):
        if not self.folder.resolve().is_relative_to(self.root.resolve()): raise RuntimeError('Temporal ajeno.')
        self.temp.cleanup()

    def command(self,folder,digest):
        return [self.python,'-B',str(ROOT/'tests'/'sdk_proceso_ficticio.py'),'--worker',str(folder),'--sha256',digest]

    def test_profile_is_encrypted_before_public_response_and_child_is_closed(self):
        result=self.transport.capture_profile(f.plan(),self.run)
        self.assertEqual(f.USER,result['snapshot']['user']);self.assertEqual(base.p.PERMITS,result['snapshot']['permissions'])
        self.assertEqual(0,result['child'].returncode);self.assertNotEqual(os.getpid(),result['child'].pid)
        self.assertEqual(b'',result['child'].stdout);self.assertEqual(b'',result['child'].stderr)
        self.assertTrue((result['folder']/'parent_ack.json').exists());self.assertIsNone(self.gate.active)
        for path in self.work.rglob('*'):
            if path.is_file() and path!=self.state: self.assertNotIn(b'private_fixture',path.read_bytes())

    def test_selected_child_architecture_and_no_secret_environment(self):
        with patch.dict(os.environ,{'SANISIDRO_ACCESS_PASSWORD':'fixture-secret','SANISIDRO_API_TOKEN':'fixture-token'}):
            self.transport.read_child(f.CARD,self.run)
        state=json.loads(self.state.read_bytes());self.assertFalse(state['events'][0]['inherited_secret'])
        expected=int(os.environ.get('SI_TEST_CHILD_BITS',str(__import__('struct').calcsize('P')*8)))
        self.assertEqual(expected,state['events'][0]['bits']);self.assertEqual(0,state.get('sets',0))

    def test_existing_inventory_callback_is_accepted_by_integrated_parent(self):
        child,folder=self.transport.read_child(f.CARD,self.run)
        value=t.integrated.accept_child(child,folder,{'mode':'read'},self.gate,self.transport.ledger,self.run,set())
        self.assertEqual(f.C3,value[f.CARD]);self.assertEqual(1,t.core.check_operations(self.transport.ledger))

    def test_profile_disallows_write_and_cannot_be_replayed(self):
        result=self.transport.capture_profile(f.plan(),self.run)
        digest=hashlib.sha256((result['folder']/'profile_operation.json').read_bytes()).hexdigest()
        with self.assertRaises(f.app.ScopeRejected): t.worker(result['folder'],digest)
        self.assertEqual(0,json.loads(self.state.read_bytes()).get('sets',0))

    def test_wrong_serial_blocks_profile_and_future_dispatches(self):
        state=json.loads(self.state.read_bytes());state['fault']='serial';self.state.write_text(json.dumps(state))
        with self.assertRaises(t.core.ReviewRequired): self.transport.capture_profile(f.plan(),self.run)
        with self.assertRaises(t.core.ReviewRequired): self.transport.read_child(f.CARD,str(uuid.uuid4()))
        self.assertEqual(0,json.loads(self.state.read_bytes()).get('sets',0))

    def test_disconnect_failure_latches_fault_and_preserves_evidence(self):
        state=json.loads(self.state.read_bytes());state['fault']='disconnect';self.state.write_text(json.dumps(state))
        with self.assertRaises(t.core.UnsafeClosure): self.transport.capture_profile(f.plan(),self.run)
        self.assertTrue(self.gate.fault);self.assertTrue((self.work/'cierre_inseguro.json').exists())
        with self.assertRaises(t.core.UnsafeClosure): self.transport.read_child(f.CARD,str(uuid.uuid4()))

    def test_tampered_operation_is_rejected_before_sdk_child_can_query(self):
        def corrupt(folder,digest):
            (folder/'operation.json').write_bytes(b'{}');return self.command(folder,digest)
        self.transport.command=corrupt
        with self.assertRaises(t.core.UnsafeClosure): self.transport.read_child(f.CARD,self.run)
        state=json.loads(self.state.read_bytes());self.assertEqual(0,state.get('disconnects',0));self.assertEqual(0,state.get('sets',0))

    def test_guard_rejection_does_not_start_a_process(self):
        self.guard.side_effect=RuntimeError('fixture maintenance')
        with self.assertRaises(RuntimeError): self.transport.read_child(f.CARD,self.run)
        self.assertFalse(self.transport.ledger.exists())

    def application(self):
        # Base ficticia de la integracion previa; cambiar solo DPAPI por nativa.
        harness=base.IntegratedTests('runTest');harness.setUp();self.addCleanup(harness.tearDown)
        harness.store=t.protected.Store(harness.folder/'native_profiles');harness.bundle=harness.prepare()
        return harness

    def test_complete_parent_child_apply_preserves_original_approval_time_and_closes_before_access(self):
        harness=self.application();scope=f.approval(harness.plan);stamp=scope.created
        result=t.integrated.execute(scope,lambda:f.API,harness.access,self.transport.read_child,self.transport.apply_child,
            harness.evidence,self.transport.ledger,harness.bundle,gate=self.gate,guard=self.guard)
        self.assertEqual('verified',result['status']);self.assertEqual(stamp,scope.created)
        self.assertEqual({'c3','access'},scope.consumed)
        self.assertEqual('20261105',json.loads(self.state.read_bytes())['user']['EndTime'])
        self.assertEqual(f.API[0]['expiration'],harness.access_before['end'])
        self.assertEqual(2,t.core.check_operations(self.transport.ledger))

    def test_apply_without_private_grant_never_reaches_set(self):
        harness=self.application();scope=f.approval();evidence=harness.folder/'evidence';f.app.backup(evidence,scope.plan)
        t.core.durable(evidence/'intent_c3.json',t.core.encoded({'component':'c3','plan_sha256':scope.sha256}))
        def remove(folder,digest):
            (folder/'grant.dpapi').unlink();return self.command(folder,digest)
        self.transport.command=remove
        payload={'mode':'apply','changes':[{'card':f.CARD,'before':f.C3,'end':'20261105'}]}
        with self.assertRaises(t.core.UnsafeClosure): self.transport.apply_child(payload,scope,evidence,harness.bundle,self.run)
        self.assertEqual(0,json.loads(self.state.read_bytes()).get('sets',0))

    def test_expired_approval_is_not_reissued_by_transport(self):
        harness=self.application();scope=f.approval();scope.created-=f.dt.timedelta(seconds=61)
        with self.assertRaises(f.app.ScopeRejected): self.transport.apply_child({},scope,harness.folder,harness.bundle,self.run)
        self.assertFalse(self.transport.ledger.exists())

    def test_complete_application_grant_is_encrypted_on_disk(self):
        harness=self.application();scope=f.approval(harness.plan)
        t.integrated.execute(scope,lambda:f.API,harness.access,self.transport.read_child,self.transport.apply_child,
            harness.evidence,self.transport.ledger,harness.bundle,gate=self.gate,guard=self.guard)
        paths=list(self.transport.ledger.glob('*/grant.dpapi'));self.assertEqual(1,len(paths))
        self.assertNotIn(b'approved_utc',paths[0].read_bytes());self.assertNotIn(b'private_fixture',paths[0].read_bytes())

    def test_grant_of_another_worker_is_not_accepted(self):
        harness=self.application();scope=f.approval();evidence=harness.folder/'evidence';f.app.backup(evidence,scope.plan)
        t.core.durable(evidence/'intent_c3.json',t.core.encoded({'component':'c3','plan_sha256':scope.sha256}))
        def foreign(folder,digest):
            path=folder/'grant.dpapi';value=json.loads(t.protected.dpapi(path.read_bytes(),decrypt=True))
            value['worker_id']=str(uuid.uuid4());path.write_bytes(t.protected.dpapi(t.core.encoded(value)))
            return self.command(folder,digest)
        self.transport.command=foreign
        payload={'mode':'apply','changes':[{'card':f.CARD,'before':f.C3,'end':'20261105'}]}
        with self.assertRaises(t.core.UnsafeClosure): self.transport.apply_child(payload,scope,evidence,harness.bundle,self.run)
        self.assertEqual(0,json.loads(self.state.read_bytes()).get('sets',0))

    def test_preflight_checks_files_without_connecting_sdk(self):
        import respaldo_real_mdb as previous
        import referencia_vigencias as reference
        sync=self.folder/'sync';sync.mkdir();(sync/'stable.py').write_bytes(b'fixture')
        prepared_plan=f.plan()
        with patch.object(t,'ROOT',self.folder),patch.object(t,'DESTINATION',self.folder),patch.object(t,'PYTHON32',Path(sys.executable)), \
                patch.object(previous.trial,'SYNC',sync),patch.object(previous,'revisions'),patch.object(previous,'read_plan',return_value=prepared_plan), \
                patch.object(reference,'EXPECTED',{'stable.py':hashlib.sha256(b'fixture').hexdigest()}),patch.object(t.struct,'calcsize',return_value=8):
            result=t.preflight()
        self.assertEqual('preflight_ok',result['status']);self.assertFalse(result['sdk_connected']);self.assertFalse(result['dates_applied'])
        self.assertNotIn('events',json.loads(self.state.read_bytes()))

    def test_preflight_rejects_wrong_folder_or_parent_architecture(self):
        for change in (patch.object(t,'DESTINATION',self.folder/'foreign'),patch.object(t.struct,'calcsize',return_value=4)):
            with change:
                with self.assertRaises(RuntimeError): t.preflight()

    def test_cli_does_not_emit_approval_or_accept_force_or_password(self):
        for option in ('--aprobar','--aplicar','--force','--password'):
            with patch.object(sys,'argv',['transporte_aplicador.py',option]),contextlib.redirect_stderr(__import__('io').StringIO()):
                with self.assertRaises(SystemExit): t.main()

    def test_child_rejects_original_deadline_even_when_cipher_was_resealed(self):
        harness=self.application();scope=f.approval();evidence=harness.folder/'evidence';f.app.backup(evidence,scope.plan)
        t.core.durable(evidence/'intent_c3.json',t.core.encoded({'component':'c3','plan_sha256':scope.sha256}))
        def expired(folder,digest):
            path=folder/'grant.dpapi';value=json.loads(t.protected.dpapi(path.read_bytes(),decrypt=True))
            value['approved_utc']=(f.app.utc_now()-f.dt.timedelta(seconds=61)).isoformat()
            path.write_bytes(t.protected.dpapi(t.core.encoded(value)));return self.command(folder,digest)
        self.transport.command=expired
        payload={'mode':'apply','changes':[{'card':f.CARD,'before':f.C3,'end':'20261105'}]}
        with self.assertRaises(t.core.UnsafeClosure): self.transport.apply_child(payload,scope,evidence,harness.bundle,self.run)
        self.assertEqual(0,json.loads(self.state.read_bytes()).get('sets',0))

    def actual_fixture(self,stack):
        import respaldo_real_mdb as previous
        package=self.folder/'package';package.mkdir()
        def read(path,maximum=131072): return json.loads(Path(path).read_bytes())
        def save(path,value): Path(path).write_text(json.dumps(value))
        pub=types.SimpleNamespace(read=read,save=save,own_lock=lambda path:contextlib.nullcontext())
        diag=types.SimpleNamespace(maintenance_guard=Mock(),maintenance_lock=contextlib.nullcontext)
        stack.enter_context(patch.object(t,'ROOT',package))
        stack.enter_context(patch.object(t,'preflight',return_value={'status':'preflight_ok'}))
        stack.enter_context(patch.object(t,'Transport',return_value=self.transport))
        stack.enter_context(patch.object(previous.trial,'DATA',self.work))
        stack.enter_context(patch.object(previous,'pub',return_value=pub))
        stack.enter_context(patch.object(previous,'read_plan',side_effect=f.plan))
        quiet=stack.enter_context(patch.object(previous,'quiet'))
        stack.enter_context(patch.object(t.closures,'diagnostic_module',return_value=diag))
        return package,quiet

    def test_actual_readonly_parent_and_persisted_final_proof_with_mock_hardware(self):
        with contextlib.ExitStack() as stack,contextlib.redirect_stdout(__import__('io').StringIO()) as output:
            package,quiet=self.actual_fixture(stack)
            self.assertEqual(0,t.capture_actual(self.run));self.assertEqual(0,t.verify_actual(self.run))
            result=json.loads((package/'datos'/'sesiones'/self.run/'resultado.json').read_bytes())
            proof=json.loads((package/'datos'/'sesiones'/self.run/'cierre_final.json').read_bytes())
        self.assertTrue(result['profile_verified']);self.assertFalse(result['dates_applied'])
        self.assertEqual('cierre_transporte_confirmado',proof['status']);self.assertEqual(self.run,proof['run_id'])
        self.assertNotIn('private_fixture',output.getvalue());self.assertEqual(0,json.loads(self.state.read_bytes()).get('sets',0))

    def test_actual_verifier_rejects_foreign_launch_and_changed_cipher(self):
        with contextlib.ExitStack() as stack,contextlib.redirect_stdout(__import__('io').StringIO()):
            package,quiet=self.actual_fixture(stack);t.capture_actual(self.run)
            with self.assertRaises(ValueError): t.verify_actual(str(uuid.uuid4()))
            result=json.loads((package/'datos'/'sesiones'/self.run/'resultado.json').read_bytes())
            cipher=self.work/'perfiles'/result['snapshot_id']/'snapshot.dpapi';cipher.write_bytes(b'corrupt')
            with self.assertRaises(t.protected.ProtectedBackupError): t.verify_actual(self.run)
            self.assertFalse((package/'datos'/'sesiones'/self.run/'cierre_final.json').exists())

    def test_actual_parent_does_not_reuse_stopped_without_final_proof(self):
        with contextlib.ExitStack() as stack,contextlib.redirect_stdout(__import__('io').StringIO()):
            package,quiet=self.actual_fixture(stack);t.capture_actual(self.run)
            count=len(json.loads(self.state.read_bytes())['events'])
            with self.assertRaises(OSError): t.capture_actual(str(uuid.uuid4()))
            self.assertEqual(count,len(json.loads(self.state.read_bytes())['events']))

    def test_actual_final_verifier_requires_parent_and_worker_absent(self):
        with contextlib.ExitStack() as stack,contextlib.redirect_stdout(__import__('io').StringIO()):
            package,quiet=self.actual_fixture(stack);t.capture_actual(self.run)
            quiet.side_effect=RuntimeError('fixture live/reused PID')
            with self.assertRaises(RuntimeError): t.verify_actual(self.run)
            self.assertFalse((package/'datos'/'sesiones'/self.run/'cierre_final.json').exists())


if __name__=='__main__': unittest.main()
