"""Union y conciliacion con MDB/API/SDK ficticios; ninguna escritura real."""
import copy
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
import aplicador_integrado as integrated
import test_aplicacion_vigencias as f
import test_respaldo_protegido as p


class IntegratedTests(unittest.TestCase):
    def setUp(self):
        self.root=ROOT/'datos'/'pruebas_integracion_aplicador';self.root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=self.root);self.folder=Path(self.temp.name)
        self.mdb_root=self.folder/'mdb';self.store=p.protected.Store(self.folder/'profiles',crypt=p.FakeCrypto())
        self.source=self.folder/'source.mdb';self.source.write_bytes(b'full-fixture-mdb')
        self.user=copy.deepcopy(f.USER);self.permits=copy.deepcopy(p.PERMITS);self.access_before=copy.deepcopy(f.ACCESS)
        self.plan=f.plan();self.api=copy.deepcopy(f.API);self.events=[]
        self.gate=integrated.SDKGate();self.ledger=self.folder/'workers';self.evidence=self.folder/'transactions'
        self.guard=Mock();self.fault=None;self.fail_access=False;self.after_read=None
        self.stack=__import__('contextlib').ExitStack()
        self.mdb_copy=self.stack.enter_context(patch.object(integrated.mdb,'create_backup',side_effect=self.copy_mdb))
        self.bundle=self.prepare()
        self.access=types.SimpleNamespace(read=lambda card:copy.deepcopy(self.access_before),update=Mock(side_effect=self.update_access))

    def tearDown(self):
        self.stack.close()
        if not self.folder.resolve().is_relative_to(self.root.resolve()): raise RuntimeError('Temporal ajeno.')
        self.temp.cleanup()

    def copy_mdb(self,source,root,password,plan,*,guard):
        guard();self.events.append('mdb_backup')
        folder=Path(root)/str(uuid.uuid4());folder.mkdir(parents=True)
        raw=source.read_bytes();(folder/'Database_PRO_antes.mdb').write_bytes(raw)
        receipt={'protocol':1,'backup_id':folder.name,'created_utc':f.app.utc_now().isoformat(),
                 'serial':plan['serial'],'card':plan['card'],'plan_sha256':f.app.digest(plan),
                 'mdb_bytes':len(raw),'mdb_sha256':hashlib.sha256(raw).hexdigest(),
                 'validation':{'access_before_sha256':f.app.digest(plan['access_before'])},
                 'status':'copy_verified','approval_issued':False}
        (folder/'manifest.json').write_text(json.dumps(receipt));return receipt

    def prepare(self):
        return integrated.prepare_bundle(self.plan,self.user,self.permits,self.source,self.mdb_root,
            'fixture_pwd',self.store,self.folder/'bundles',guard=self.guard)

    def update_access(self,before,end,scope):
        self.events.append('access_update')
        self.assertEqual(before,self.access_before)
        if scope.plan['c3_change']: self.assertIn('c3',scope.verified)
        if self.fail_access: raise OSError('private_fixture access failed')
        scope.consume('access');self.access_before=dict(before,start='2020-01-01 00:00:00',end=f.app.date_text(end),valid_raw=True)
        return copy.deepcopy(self.access_before)

    def request(self,run_id,payload):
        folder=integrated.closures.new_session(self.ledger,run_id,'vigencias')
        raw=integrated.core.encoded(payload);(folder/'operation.json').write_bytes(raw)
        return folder,hashlib.sha256(raw).hexdigest()

    def finish(self,folder,code):
        if code==0: integrated.closures.acknowledge(folder,os.getpid())
        self.gate.release('vigencias',clean=code==0)
        return integrated.ClosedWorker(os.getpid(),code,b'',b''),folder

    def read_child(self,card,run_id):
        self.events.append('read_child');self.gate.acquire('vigencias')
        folder,digest=self.request(run_id,{'mode':'read'});owner=self
        class Panel:
            sdk_sha256=integrated.closures.SDK_HASH
            def open(self): pass
            def serial(self): return integrated.core.SERIAL
            def inventory(self): return [{key:owner.user[key] for key in integrated.core.FIELDS}]
            def disconnect(self): owner.events.append('read_disconnect')
            def close_library(self): owner.events.append('read_library_closed')
        code=integrated.core.worker(folder,digest,Panel)
        value=self.finish(folder,code)
        if self.after_read: self.after_read()
        return value

    def apply_child(self,payload,scope,session,bundle,run_id):
        self.events.append('apply_child');self.gate.acquire('vigencias');folder,digest=self.request(run_id,payload)
        harness=f.BindingTests('runTest');harness.folder=folder
        _,sdk,diag,rows,writes,events=harness.fake(scope=scope,evidence=folder,fault=self.fault)
        rows[f.CARD]=copy.deepcopy(self.user)
        if self.fault=='close': sdk.Disconnect.side_effect=RuntimeError('private_fixture close failed')
        code=integrated.run_worker(folder,digest,scope,session,bundle,diag)
        self.user=copy.deepcopy(rows[f.CARD]);self.events.extend(events)
        return self.finish(folder,code)

    def execute(self,scope=None,bundle='default',read=None,apply=None):
        return integrated.execute(scope or f.approval(self.plan),lambda:copy.deepcopy(self.api),self.access,
            read or self.read_child,apply or self.apply_child,self.evidence,self.ledger,
            self.bundle if bundle=='default' else bundle,gate=self.gate,guard=self.guard)

    def review(self):
        return integrated.review_recovery(self.bundle,self.plan,lambda:copy.deepcopy(self.api),
            self.access_before,self.user,self.permits,gate=self.gate,guard=self.guard)

    def test_backups_are_bound_to_plan_and_no_private_fields_in_public_evidence(self):
        meta,snapshot=self.bundle.check(self.plan)
        self.assertEqual(f.USER,snapshot['user']);self.assertEqual(p.PERMITS,snapshot['permissions'])
        self.assertEqual(f.app.digest(self.plan),meta['plan_sha256'])
        for path in self.folder.rglob('*.json'): self.assertNotIn(b'private_fixture',path.read_bytes())

    def test_missing_or_foreign_bundle_prevents_both_destinations(self):
        read=Mock();apply=Mock()
        with self.assertRaises(f.app.ScopeRejected): self.execute(bundle=None,read=read,apply=apply)
        other=f.app.make_plan(f.CARD,[{'card_no':f.CARD,'expiration':'2026-12-05 23:59:59'}],f.ACCESS,f.C3)
        with self.assertRaises(f.app.ScopeRejected): self.bundle.check(other)
        read.assert_not_called();apply.assert_not_called();self.access.update.assert_not_called()

    def test_mdb_or_receipt_corruption_blocks_before_sdk(self):
        meta,_=self.bundle.check(self.plan);path=self.mdb_root/meta['mdb_backup_id']/'Database_PRO_antes.mdb';path.write_bytes(b'bad')
        read=Mock()
        with self.assertRaises(f.app.ScopeRejected): self.execute(read=read)
        read.assert_not_called();self.access.update.assert_not_called()

    def test_profile_cipher_corruption_blocks_before_sdk(self):
        meta,_=self.bundle.check(self.plan);path=self.store.root/meta['snapshot_id']/'snapshot.dpapi';path.write_bytes(b'bad')
        read=Mock()
        with self.assertRaises(p.protected.ProtectedBackupError): self.execute(read=read)
        read.assert_not_called()

    def test_both_components_verified_only_after_c3_disconnect_receipt_ack_and_gate_release(self):
        result=self.execute()
        self.assertEqual('verified',result['status']);self.assertEqual('20261105',self.user['EndTime'])
        self.assertEqual(f.API[0]['expiration'],self.access_before['end'])
        self.assertLess(self.events.index('library_close'),self.events.index('access_update'))
        self.assertIsNone(self.gate.active);self.assertFalse(self.gate.fault)
        integrated.check_runs(self.evidence);self.assertEqual(2,integrated.core.check_operations(self.ledger))

    def test_used_approval_cannot_be_replayed_even_if_external_state_was_reset(self):
        scope=f.approval(self.plan);self.execute(scope=scope)
        self.user=copy.deepcopy(f.USER);self.access_before=copy.deepcopy(f.ACCESS)
        count=len(list(self.ledger.iterdir()))
        with self.assertRaises(f.app.ScopeRejected): self.execute(scope=scope)
        self.assertEqual(count,len(list(self.ledger.iterdir())))

    def test_no_changes_uses_closed_read_without_forcing_backup_or_write(self):
        self.user['EndTime']='20261105';self.access_before['end']=f.API[0]['expiration']
        self.plan=f.app.make_plan(f.CARD,self.api,self.access_before,{k:self.user[k] for k in integrated.core.FIELDS})
        apply=Mock();result=self.execute(bundle=None,apply=apply)
        self.assertEqual('no_changes',result['status']);apply.assert_not_called();self.access.update.assert_not_called()

    def test_access_only_still_requires_backups_and_closed_c3_read(self):
        self.user['EndTime']='20261105'
        self.plan=f.app.make_plan(f.CARD,self.api,self.access_before,{k:self.user[k] for k in integrated.core.FIELDS})
        self.bundle=self.prepare();apply=Mock();self.assertEqual('verified',self.execute(apply=apply)['status'])
        apply.assert_not_called();self.assertIn('read_library_closed',self.events);self.access.update.assert_called_once()

    def test_c3_only_does_not_update_access(self):
        self.access_before['end']=f.API[0]['expiration']
        self.plan=f.app.make_plan(f.CARD,self.api,self.access_before,f.C3);self.bundle=self.prepare()
        self.assertEqual('verified',self.execute()['status']);self.access.update.assert_not_called()

    def test_profile_change_after_backup_is_rejected_before_set(self):
        self.user['Group']='changed'
        with self.assertRaises(integrated.core.ReviewRequired): self.execute()
        self.assertEqual('20261001',self.user['EndTime']);self.access.update.assert_not_called()
        self.assertFalse(list(self.ledger.glob('*/write_attempt.json')))

    def test_api_change_before_write_cannot_use_prepared_backup_as_authority(self):
        self.api[0]['expiration']='2026-12-05 23:59:59'
        with self.assertRaises(f.app.ScopeRejected): self.execute()
        self.assertNotIn('apply_child',self.events);self.access.update.assert_not_called()

    def test_api_changes_between_destinations_prevents_access(self):
        original=self.apply_child
        def changed(*args):
            value=original(*args);self.api[0]['expiration']='2026-12-05 23:59:59';return value
        with self.assertRaises(integrated.core.ReviewRequired): self.execute(apply=changed)
        self.assertEqual('20261105',self.user['EndTime']);self.access.update.assert_not_called()

    def test_expiry_after_read_never_renews_scope(self):
        clock=[f.dt.datetime(2026,10,25,tzinfo=f.dt.timezone.utc)]
        scope=f.approval(self.plan,clock=lambda:clock[0])
        self.after_read=lambda:clock.__setitem__(0,clock[0]+f.dt.timedelta(seconds=61))
        with self.assertRaises(f.app.ScopeRejected): self.execute(scope=scope)
        self.assertNotIn('apply_child',self.events);self.access.update.assert_not_called()

    def test_bad_exit_or_pid_or_ack_cannot_release_access(self):
        original=self.apply_child
        def invalid(*args):
            child,folder=original(*args)
            return integrated.ClosedWorker(child.pid+9999,0,b'',b''),folder
        with self.assertRaises(integrated.core.ReviewRequired): self.execute(apply=invalid)
        self.access.update.assert_not_called()

    def test_close_failure_latches_gate_and_blocks_recovery(self):
        self.fault='close'
        with self.assertRaises(integrated.core.ReviewRequired): self.execute()
        self.assertTrue(self.gate.fault);self.access.update.assert_not_called()
        with self.assertRaises(integrated.core.ReviewRequired): self.review()

    def test_partial_access_failure_preserves_c3_and_backup_without_automatic_rollback(self):
        self.fail_access=True
        with self.assertRaises(integrated.core.ReviewRequired): self.execute()
        self.assertEqual('20261105',self.user['EndTime']);self.assertEqual(f.ACCESS,self.access_before)
        _,snapshot=self.bundle.check(self.plan);self.assertEqual(f.USER,snapshot['user'])
        with self.assertRaises(integrated.core.ReviewRequired): integrated.check_runs(self.evidence)

    def test_restart_cannot_bypass_partial_failure_with_new_transaction_uuid(self):
        self.fail_access=True
        with self.assertRaises(integrated.core.ReviewRequired): self.execute()
        count=len(list(self.ledger.iterdir()));self.fail_access=False
        with self.assertRaises(integrated.core.ReviewRequired): self.execute()
        self.assertEqual(count,len(list(self.ledger.iterdir())))

    def test_recovery_after_partial_write_targets_new_api_and_keeps_blockers(self):
        self.fail_access=True
        with self.assertRaises(integrated.core.ReviewRequired): self.execute()
        originals={str(path):path.read_bytes() for path in self.evidence.rglob('*.json')}
        self.api[0]['expiration']='2026-12-05 23:59:59';review=self.review()
        self.assertEqual('needs_api_reconciliation',review['status']);self.assertFalse(review['approval_issued'])
        self.assertFalse(review['retry_authorized']);self.assertEqual('2026-12-05 23:59:59',review['plan']['api_end'])
        self.assertTrue(all(Path(path).read_bytes()==raw for path,raw in originals.items()))
        with self.assertRaises(integrated.core.ReviewRequired): self.execute()

    def test_recovery_keeps_expired_api_date_and_blocks_missing_tag(self):
        self.api[0]['expiration']='2026-09-05 23:59:59'
        self.assertEqual('2026-09-05 23:59:59',self.review()['plan']['api_end'])
        self.api=[{'card_no':'22345678','expiration':f.API[0]['expiration']}]
        self.assertEqual('blocked',self.review()['status'])

    def test_recovery_reports_protected_field_change_without_values_or_repair(self):
        self.user['Password']='new_private_fixture';before=copy.deepcopy(self.user);review=self.review()
        self.assertEqual('blocked',review['status']);self.assertEqual(['Password'],review['changed_field_names'])
        self.assertNotIn('private_fixture',json.dumps(review));self.assertEqual(before,self.user)

    def test_recovery_blocks_identity_or_permissions_change(self):
        self.permits=[dict(p.PERMITS[0],AuthorizeDoorId='9')]
        self.assertEqual('blocked',self.review()['status'])
        self.permits=copy.deepcopy(p.PERMITS);self.user['Pin']='999'
        self.assertEqual(['identity_changed'],self.review()['reasons'])

    def test_no_parent_ack_is_rejected_even_with_successful_response(self):
        original=self.apply_child
        def no_ack(*args):
            child,folder=original(*args);(folder/'parent_ack.json').unlink();return child,folder
        with self.assertRaises(integrated.core.ReviewRequired): self.execute(apply=no_ack)
        self.access.update.assert_not_called()

    def test_wrong_operation_run_uuid_is_not_accepted(self):
        original=self.read_child
        def wrong(card,run_id): return original(card,str(uuid.uuid4()))
        with self.assertRaises(integrated.core.ReviewRequired): self.execute(read=wrong)
        self.assertNotIn('apply_child',self.events)

    def test_failed_mdb_backup_never_seals_profile_or_emits_bundle(self):
        self.mdb_copy.side_effect=OSError('fixture disk')
        with patch.object(self.store,'seal') as seal:
            with self.assertRaises(OSError): self.prepare()
        seal.assert_not_called()

    def test_incomplete_transaction_record_blocks_after_restart(self):
        folder=self.evidence/str(uuid.uuid4());folder.mkdir(parents=True)
        (folder/'transaction.json').write_text('{"status":"running"}')
        with self.assertRaises(integrated.core.ReviewRequired): self.execute()
        self.assertNotIn('read_child',self.events)


if __name__=='__main__': unittest.main()
