"""Respaldo/recuperacion con cifrado y hardware ficticios; ningun dato real."""
import copy
import hashlib
import hmac
import json
from pathlib import Path
import sys
import tempfile
import unittest
import uuid
from unittest.mock import Mock,patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import respaldo_protegido as protected
import recuperacion_selectiva as recovery
import puente_fechas_protegido as hook
import vigencias_candidato as core
from test_aplicacion_vigencias import API,ACCESS,C3,CARD,USER,plan,approval
import test_aplicacion_vigencias as fixtures

PERMITS=[{'Pin':'42','AuthorizeTimezoneId':'1','AuthorizeDoorId':'1'},
         {'Pin':'42','AuthorizeTimezoneId':'1','AuthorizeDoorId':'2'}]


class FakeCrypto:
    """Interfaz de cifrado sustituida para pruebas; no usar fuera de fixtures."""
    def __init__(self,key=b'fixture-only-key'): self.key=key
    def __call__(self,data,decrypt=False):
        if decrypt:
            tag,payload=data[:32],data[32:]
            if not hmac.compare_digest(tag,hmac.digest(self.key,payload,'sha256')): raise ValueError('fixture invalid')
            return bytes(value^0xa5 for value in payload)
        payload=bytes(value^0xa5 for value in data)
        return hmac.digest(self.key,payload,'sha256')+payload


class ScratchCase(unittest.TestCase):
    def setUp(self):
        self.root=ROOT/'datos'/'pruebas_respaldo_protegido';self.root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=self.root);self.folder=Path(self.temp.name)
        self.store=protected.Store(self.folder/'protected',crypt=FakeCrypto())
    def tearDown(self):
        if not self.folder.resolve().is_relative_to(self.root.resolve()): raise RuntimeError('Temporal ajeno')
        self.temp.cleanup()
    def seal(self): return self.store.seal(plan(),USER,PERMITS)


class StoreTests(ScratchCase):
    def test_full_user_permissions_and_access_snapshot_roundtrip_without_plaintext_files(self):
        meta=self.seal();value=self.store.open(meta['snapshot_id'],plan_sha256=meta['plan_sha256'])
        self.assertEqual(USER,value['user']);self.assertEqual(PERMITS,value['permissions'])
        self.assertEqual(ACCESS,value['plan']['access_before'])
        for path in self.store.root.rglob('*'):
            if path.is_file(): self.assertNotIn(b'private_fixture',path.read_bytes())
        self.assertNotIn('Password',json.dumps(meta));self.assertNotIn('plain_sha256',meta)

    def test_snapshot_owns_deep_copy_and_reopen_discards_mutated_return_value(self):
        user=copy.deepcopy(USER);permits=copy.deepcopy(PERMITS)
        meta=self.store.seal(plan(),user,permits);user['Password']='changed';permits[0]['AuthorizeDoorId']='9'
        first=self.store.open(meta['snapshot_id']);first['user']['Group']='changed'
        second=self.store.open(meta['snapshot_id'])
        self.assertEqual(USER,second['user']);self.assertEqual(PERMITS,second['permissions'])

    def test_wrong_scope_serial_plan_or_cipher_manifest_never_opens(self):
        for field,value in (('serial','OTHER'),('card','22345678'),('plan_sha256','0'*64),('cipher_sha256','0'*64)):
            meta=self.seal();path=self.store.root/meta['snapshot_id']/'manifest.json'
            path.write_text(json.dumps(meta|{field:value}))
            with self.assertRaises(protected.ProtectedBackupError): self.store.open(meta['snapshot_id'])
        meta=self.seal()
        with self.assertRaises(protected.ProtectedBackupError): self.store.open(meta['snapshot_id'],plan_sha256='0'*64)

    def test_cipher_corruption_even_with_updated_checksum_fails_authentication(self):
        meta=self.seal();folder=self.store.root/meta['snapshot_id']
        raw=bytearray((folder/'snapshot.dpapi').read_bytes());raw[-1]^=1
        (folder/'snapshot.dpapi').write_bytes(raw)
        (folder/'manifest.json').write_text(json.dumps(meta|{'cipher_sha256':hashlib.sha256(raw).hexdigest()}))
        with self.assertRaises(protected.ProtectedBackupError): self.store.open(meta['snapshot_id'])

    def test_wrong_protector_context_cannot_open_ciphertext(self):
        meta=self.seal();other=protected.Store(self.store.root,crypt=FakeCrypto(b'other-fixture-user'))
        with self.assertRaises(protected.ProtectedBackupError): other.open(meta['snapshot_id'])

    def test_plaintext_or_wrong_roundtrip_protector_is_rejected_before_writing(self):
        for crypt in (lambda data,decrypt=False:data,lambda data,decrypt=False:b'wrong'):
            store=protected.Store(self.folder/'bad',crypt=crypt)
            with self.assertRaises(protected.ProtectedBackupError): store.seal(plan(),USER,PERMITS)
            self.assertFalse(store.root.exists())

    def test_invalid_user_permissions_or_noncanonical_scope_rejected(self):
        for user,permits in ((dict(USER,Pin='99'),PERMITS),(dict(USER,Password=None),PERMITS),
                             (USER,[dict(PERMITS[0],Pin='99')]),(USER,[PERMITS[0],PERMITS[0]])):
            with self.assertRaises(protected.ProtectedBackupError): self.store.seal(plan(),user,permits)

    def test_crypto_failure_redacts_original_exception(self):
        def fail(data,decrypt=False): raise OSError('private_fixture should not escape')
        store=protected.Store(self.folder,crypt=fail)
        with self.assertRaises(protected.ProtectedBackupError) as caught: store.seal(plan(),USER,PERMITS)
        self.assertNotIn('private_fixture',str(caught.exception))

    def test_persistence_failure_cannot_return_valid_backup(self):
        original=core.durable
        def fail(path,raw):
            if Path(path).name=='manifest.json': raise OSError('disk full')
            return original(path,raw)
        with patch.object(core,'durable',side_effect=fail):
            with self.assertRaises(protected.ProtectedBackupError): self.seal()

    def test_replaced_ciphertext_from_another_snapshot_is_context_bound(self):
        first=self.seal();second=self.seal()
        raw=(self.store.root/first['snapshot_id']/'snapshot.dpapi').read_bytes()
        folder=self.store.root/second['snapshot_id'];(folder/'snapshot.dpapi').write_bytes(raw)
        (folder/'manifest.json').write_text(json.dumps(second|{'cipher_sha256':hashlib.sha256(raw).hexdigest()}))
        with self.assertRaises(protected.ProtectedBackupError): self.store.open(second['snapshot_id'])

    def test_path_traversal_or_non_uuid_identifiers_never_read_other_files(self):
        for value in ('..','../snapshot','C:\\other','0000',True):
            with self.assertRaises(protected.ProtectedBackupError): self.store.open(value)

    def test_count_limit_preserves_existing_snapshot_and_prevents_new_folder(self):
        meta=self.seal();before=list(self.store.root.iterdir())
        with patch.object(protected,'MAX_SNAPSHOTS',1):
            with self.assertRaises(protected.ProtectedBackupError): self.seal()
        self.assertEqual(before,list(self.store.root.iterdir()));self.store.open(meta['snapshot_id'])

    def test_byte_limit_does_not_delete_backup_to_make_room(self):
        meta=self.seal()
        with patch.object(protected,'MAX_STORE_BYTES',1):
            with self.assertRaises(protected.ProtectedBackupError): self.seal()
        self.assertEqual(1,len(list(self.store.root.iterdir())));self.store.open(meta['snapshot_id'])

    def test_disk_reserve_prevents_any_new_snapshot(self):
        with patch.object(protected.shutil,'disk_usage',return_value=Mock(free=protected.MIN_FREE_BYTES)):
            with self.assertRaises(protected.ProtectedBackupError): self.seal()
        self.assertFalse(self.store.root.exists())

    def test_incomplete_snapshot_is_retained_and_counts_towards_limit(self):
        orphan=self.store.root/str(uuid.uuid4());orphan.mkdir(parents=True)
        (orphan/'snapshot.dpapi').write_bytes(b'partial-fixture')
        with patch.object(protected,'MAX_SNAPSHOTS',1):
            with self.assertRaises(protected.ProtectedBackupError): self.seal()
        self.assertEqual(b'partial-fixture',(orphan/'snapshot.dpapi').read_bytes())
        with self.assertRaises(protected.ProtectedBackupError): self.store.open(orphan.name)

    def test_foreign_or_nested_content_blocks_admission_without_deleting(self):
        orphan=self.store.root/str(uuid.uuid4());orphan.mkdir(parents=True)
        foreign=orphan/'other.json';foreign.write_bytes(b'fixture')
        with self.assertRaises(protected.ProtectedBackupError): self.seal()
        self.assertEqual(b'fixture',foreign.read_bytes())

    def test_reparse_detection_rejects_windows_junction_attributes(self):
        attributes=Mock(st_file_attributes=0x400)
        with patch.object(Path,'is_symlink',return_value=False),patch.object(Path,'exists',return_value=True), \
                patch.object(Path,'lstat',return_value=attributes):
            with self.assertRaises(ValueError): protected.checked_path(self.folder)

    def test_oversized_cipher_is_rejected_before_folder_creation(self):
        store=protected.Store(self.folder/'bad',crypt=lambda data,decrypt=False:b'x'*(protected.MAX_BYTES+1))
        with self.assertRaises(protected.ProtectedBackupError): store.seal(plan(),USER,PERMITS)
        self.assertFalse(store.root.exists())


class RecoveryTests(ScratchCase):
    def evaluate(self,*,api=None,access=None,user=None,permits=None):
        meta=self.seal()
        return recovery.review(self.store,meta['snapshot_id'],api or API,
            ACCESS if access is None else access,USER if user is None else user,PERMITS if permits is None else permits)

    def test_recovery_targets_current_api_not_backup_vigencia(self):
        api=[{'card_no':CARD,'expiration':'2026-12-05 23:59:59'}]
        result=self.evaluate(api=api)
        self.assertEqual('needs_api_reconciliation',result['status'])
        self.assertEqual('2026-12-05 23:59:59',result['plan']['api_end'])
        self.assertFalse(result['approval_issued']);self.assertNotIn('private_fixture',json.dumps(result))

    def test_current_state_already_matching_api_has_no_changes(self):
        result=self.evaluate(access=dict(ACCESS,end=API[0]['expiration']),user=dict(USER,EndTime='20261105'))
        self.assertEqual('already_consistent',result['status'])
        self.assertFalse(result['plan']['access_change']);self.assertFalse(result['plan']['c3_change'])

    def test_identity_change_blocks_new_plan_without_creating_or_reassigning_tag(self):
        for args in ({'access':dict(ACCESS,userid=99)},{'user':dict(USER,Pin='99')},{'user':dict(USER,CardNo='22345678')}):
            result=self.evaluate(**args)
            self.assertEqual('blocked',result['status']);self.assertEqual(['identity_changed'],result['reasons'])
            self.assertNotIn('plan',result)

    def test_private_field_change_names_are_visible_values_are_not(self):
        result=self.evaluate(user=dict(USER,Password='new_private_fixture'))
        self.assertEqual('blocked',result['status']);self.assertEqual(['Password'],result['changed_field_names'])
        self.assertNotIn('private_fixture',json.dumps(result));self.assertNotIn('plan',result)

    def test_permissions_change_blocks_instead_of_adding_or_deleting_levels(self):
        result=self.evaluate(permits=[dict(PERMITS[0],AuthorizeDoorId='9')])
        self.assertEqual(['permissions_changed'],result['reasons']);self.assertEqual('blocked',result['status'])

    def test_api_absence_and_missing_destinations_never_restore_from_old_backup(self):
        meta=self.seal()
        other=[{'card_no':'22345678','expiration':API[0]['expiration']}]
        result=recovery.review(self.store,meta['snapshot_id'],other,ACCESS,USER,PERMITS)
        self.assertEqual(['missing_in_api'],result['reasons'])
        for access,user in ((None,USER),(ACCESS,None)):
            result=recovery.review(self.store,meta['snapshot_id'],API,access,user,PERMITS)
            self.assertEqual('blocked',result['status']);self.assertNotIn('plan',result)

    def test_review_reauthenticates_from_ciphertext_not_mutated_plain_dict(self):
        meta=self.seal();opened=self.store.open(meta['snapshot_id']);opened['user']['Group']='CHANGED'
        result=recovery.review(self.store,meta['snapshot_id'],API,ACCESS,dict(USER,Group='CHANGED'),PERMITS)
        self.assertEqual(['Group'],result['changed_field_names']);self.assertEqual('blocked',result['status'])

    def test_expired_current_api_is_used_without_reactivating_from_backup(self):
        result=self.evaluate(api=[{'card_no':CARD,'expiration':'2026-09-05 23:59:59'}])
        self.assertEqual('2026-09-05 23:59:59',result['plan']['api_end'])
        self.assertFalse(result['approval_issued'])


class HookTests(ScratchCase):
    def panel(self,*,store=None,fault=None):
        harness=fixtures.BindingTests('runTest');harness.folder=self.folder
        scope=approval();_,sdk,diag,rows,writes,events=harness.fake(scope=scope,evidence=self.folder,fault=fault)
        panel=hook.ProtectedDatesPanel(scope,self.folder,store or self.store,diag)
        panel.open();panel.serial()
        return panel,sdk,rows,writes,events

    def apply(self,panel): return core.apply_dates(panel,[{'card':CARD,'before':C3,'end':'20261105'}])

    def test_encrypted_snapshot_and_disk_roundtrip_precede_actual_sdk_attempt(self):
        panel,sdk,rows,writes,events=self.panel();original=sdk.SetDeviceData.side_effect
        def checked(*args):
            meta=json.loads((self.folder/'protected_backup.json').read_bytes())
            before=self.store.open(meta['snapshot_id'],plan_sha256=meta['plan_sha256'])
            self.assertEqual(USER,before['user']);self.assertEqual(PERMITS,before['permissions'])
            return original(*args)
        sdk.SetDeviceData.side_effect=checked
        self.assertEqual({CARD:{'ok':True}},self.apply(panel));self.assertEqual(1,len(writes))
        panel.disconnect();panel.close_library()

    def test_dpapi_failure_keeps_sdk_write_unreachable(self):
        def fail(data,decrypt=False): raise OSError('private_fixture')
        panel,sdk,rows,writes,events=self.panel(store=protected.Store(self.folder/'bad',crypt=fail))
        result=self.apply(panel)
        self.assertTrue(result[CARD]['requires_review']);sdk.SetDeviceData.assert_not_called()
        self.assertEqual(USER,rows[CARD]);panel.disconnect();panel.close_library()

    def test_link_persistence_failure_does_not_write_dates(self):
        panel,sdk,rows,writes,events=self.panel();original=core.durable
        def fail(path,raw):
            if Path(path).name=='protected_backup.json': raise OSError('disk full')
            return original(path,raw)
        with patch.object(core,'durable',side_effect=fail): self.apply(panel)
        sdk.SetDeviceData.assert_not_called();panel.disconnect();panel.close_library()

    def test_postwrite_private_corruption_preserves_original_encrypted_snapshot(self):
        panel,sdk,rows,writes,events=self.panel(fault='group');result=self.apply(panel)
        self.assertTrue(result[CARD]['requires_review']);self.assertEqual(1,len(writes))
        meta=panel.protected_ref;self.assertEqual(USER,self.store.open(meta['snapshot_id'])['user'])
        review=recovery.review(self.store,meta['snapshot_id'],API,ACCESS,rows[CARD],PERMITS)
        self.assertEqual(['Group'],review['changed_field_names'])
        panel.disconnect();panel.close_library()

    def test_repeated_write_or_missing_precapture_is_rejected_without_second_snapshot(self):
        panel,sdk,rows,writes,events=self.panel()
        values={'CardNo':CARD,'Pin':'42','StartTime':'20200101','EndTime':'20261105'}
        with self.assertRaises(PermissionError): panel.write_dates(values)
        self.assertEqual({CARD:{'ok':True}},self.apply(panel))
        with self.assertRaises(PermissionError): panel.write_dates(values)
        self.assertEqual(1,sdk.SetDeviceData.call_count);self.assertEqual(1,len(list(self.store.root.iterdir())))
        panel.disconnect();panel.close_library()


if __name__=='__main__': unittest.main()
