"""Contratos de copia MDB; ACE, exclusividad y ACL sustituidos. Sin datos reales."""
import contextlib
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
import uuid
from unittest.mock import Mock,patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import respaldo_mdb as mdb
import test_aplicacion_vigencias as fixtures


class MDBTests(unittest.TestCase):
    def setUp(self):
        self.root=ROOT/'datos'/'pruebas_mdb_ficticio';self.root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=self.root);self.folder=Path(self.temp.name)
        self.source=self.folder/'source.mdb';self.raw=b'fixture-private-data'*5000;self.source.write_bytes(self.raw)
        self.backups=self.folder/'backups';self.guard=Mock();self.events=[]
        self.plan=fixtures.plan()
        self.connect=Mock(side_effect=self.connection)

    def tearDown(self):
        if not self.folder.resolve().is_relative_to(self.root.resolve()): raise RuntimeError('Temporal ajeno.')
        self.temp.cleanup()

    @contextlib.contextmanager
    def source_open(self,path):
        self.events.append('source_open')
        with path.open('rb') as stream: yield stream
        self.events.append('source_closed')

    def private(self,path):
        self.events.append('private_before_copy');self.assertFalse(path.exists());path.mkdir()

    def connection(self,path,password):
        self.events.append('validate_copy');self.assertIn('source_closed',self.events)
        self.assertEqual(self.raw,path.read_bytes());self.assertNotEqual(self.source,path)
        self.connection_result=Mock(autocommit=False)
        def cursor():
            value=Mock()
            def execute(sql,*args):
                if sql.startswith('SELECT * FROM ['):
                    name=sql.split('[')[1].split(']')[0]
                    value.description=[(column,) for column in mdb.TABLES[name]]
                elif sql.startswith('SELECT COUNT(*)'): value.fetchone.return_value=(2,)
                else:
                    self.assertIn('WHERE CardNo = ?',sql);self.assertEqual((fixtures.CARD,),args)
                    value.fetchall.return_value=[(42,fixtures.CARD,fixtures.app.START,
                        fixtures.dt.datetime(2026,10,1,23,59,59),True)]
                return value
            value.execute.side_effect=execute
            return value
        self.connection_result.cursor.side_effect=cursor
        return self.connection_result

    def run_backup(self,**kwargs):
        return mdb.create_backup(self.source,self.backups,'fake-private-pwd',self.plan,
            guard=self.guard,source_open=self.source_open,private=self.private,connect=self.connect,**kwargs)

    def test_full_bytes_hash_and_receipt_match_source_without_modifying_it(self):
        receipt=self.run_backup();folder=self.backups/receipt['backup_id']
        self.assertEqual(self.raw,self.source.read_bytes());self.assertEqual(self.raw,(folder/'Database_PRO_antes.mdb').read_bytes())
        self.assertEqual(hashlib.sha256(self.raw).hexdigest(),receipt['mdb_sha256'])
        self.assertEqual(receipt,json.loads((folder/'manifest.json').read_bytes()))
        self.assertEqual('copy_verified',receipt['status']);self.assertFalse(receipt['approval_issued'])
        self.assertNotIn('fake-private',json.dumps(receipt));self.assertNotIn('name',json.dumps(receipt))
        self.assertEqual(set(mdb.TABLES),set(receipt['validation']['table_counts']))
        self.assertEqual(['source_open','private_before_copy','source_closed','validate_copy'],self.events)
        self.assertEqual(2,self.guard.call_count)
        self.connection_result.rollback.assert_called_once();self.connection_result.close.assert_called_once()

    def test_guard_failure_prevents_source_open_and_folder_creation(self):
        self.guard.side_effect=RuntimeError('fixture')
        with self.assertRaises(mdb.MDBBackupError): self.run_backup()
        self.assertEqual([],self.events);self.assertFalse(self.backups.exists());self.connect.assert_not_called()

    def test_lost_guard_after_copy_prevents_validation_and_receipt(self):
        self.guard.side_effect=[None,RuntimeError('fixture')]
        with self.assertRaises(mdb.MDBBackupError): self.run_backup()
        self.connect.assert_not_called();self.assertEqual([],list(self.backups.rglob('manifest.json')))
        self.assertEqual(1,len(list(self.backups.rglob('*.mdb'))))

    def test_source_busy_never_uses_shared_fallback(self):
        with patch.object(self,'source_open',side_effect=OSError('fixture busy')):
            with self.assertRaises(mdb.MDBBackupError): self.run_backup()
        self.assertFalse(self.backups.exists());self.connect.assert_not_called()

    def test_acl_failure_prevents_copy_and_odbc(self):
        with patch.object(self,'private',side_effect=OSError('fixture acl')):
            with self.assertRaises(mdb.MDBBackupError): self.run_backup()
        self.assertEqual([],list(self.backups.rglob('*.mdb')));self.connect.assert_not_called()

    def test_empty_or_oversized_source_rejected_before_destination(self):
        for raw,limit in ((b'',10),(self.raw,1)):
            self.source.write_bytes(raw)
            with patch.object(mdb,'MAX_MDB_BYTES',limit):
                with self.assertRaises(mdb.MDBBackupError): self.run_backup()
            self.assertFalse(self.backups.exists())

    def test_disk_reserve_or_byte_capacity_blocks_copy(self):
        for change in (patch.object(mdb,'MAX_STORE_BYTES',1),
                       patch.object(mdb.shutil,'disk_usage',return_value=Mock(free=mdb.MIN_FREE_BYTES))):
            with change:
                with self.assertRaises(mdb.MDBBackupError): self.run_backup()
            self.assertFalse(self.backups.exists())

    def test_count_limit_retains_prior_backup(self):
        first=self.run_backup();folder=self.backups/first['backup_id'];original=(folder/'manifest.json').read_bytes()
        with patch.object(mdb,'MAX_BACKUPS',1):
            with self.assertRaises(mdb.MDBBackupError): self.run_backup()
        self.assertEqual([folder],list(self.backups.iterdir()));self.assertEqual(original,(folder/'manifest.json').read_bytes())

    def test_incomplete_backup_counts_and_is_not_removed(self):
        folder=self.backups/str(uuid.uuid4());folder.mkdir(parents=True);path=folder/'Database_PRO_antes.mdb';path.write_bytes(b'partial')
        with patch.object(mdb,'MAX_BACKUPS',1):
            with self.assertRaises(mdb.MDBBackupError): self.run_backup()
        self.assertEqual(b'partial',path.read_bytes());self.assertEqual([],list(self.backups.rglob('manifest.json')))

    def test_copy_hash_mismatch_prevents_open_and_verified_receipt(self):
        with patch.object(mdb,'file_hash',return_value='0'*64):
            with self.assertRaises(mdb.MDBBackupError): self.run_backup()
        self.connect.assert_not_called();self.assertEqual([],list(self.backups.rglob('manifest.json')))

    def test_validation_failure_redacts_odbc_password_and_keeps_incomplete_copy(self):
        self.connect.side_effect=RuntimeError('PWD=fake-private-pwd; fixture')
        with self.assertRaises(mdb.MDBBackupError) as caught: self.run_backup()
        self.assertNotIn('fake-private',str(caught.exception));self.assertEqual([],list(self.backups.rglob('manifest.json')))
        self.assertEqual(1,len(list(self.backups.rglob('*.mdb'))))

    def test_copy_modified_by_validation_never_gets_verified_receipt(self):
        original=mdb.validate_copy
        def modified(path,*args,**kwargs):
            result=original(path,*args,**kwargs);path.write_bytes(b'changed-copy');return result
        with patch.object(mdb,'validate_copy',side_effect=modified):
            with self.assertRaises(mdb.MDBBackupError): self.run_backup()
        self.assertEqual(self.raw,self.source.read_bytes());self.assertEqual([],list(self.backups.rglob('manifest.json')))

    def test_receipt_persistence_failure_does_not_confirm(self):
        with patch.object(mdb.core,'durable',side_effect=OSError('fixture disk')):
            with self.assertRaises(mdb.MDBBackupError): self.run_backup()
        self.assertEqual([],list(self.backups.rglob('manifest.json')))

    def test_mutating_callers_plan_does_not_change_backed_scope(self):
        expected=fixtures.app.digest(self.plan)
        self.guard.side_effect=lambda:self.plan.update(api_end='2099-01-01 23:59:59')
        result=self.run_backup();self.assertEqual(expected,result['plan_sha256'])

    def test_only_copy_is_opened_readonly_without_commit(self):
        import types
        connect=Mock(return_value=Mock())
        with patch.dict(sys.modules,{'pyodbc':types.SimpleNamespace(connect=connect)}):
            mdb.connect_copy(self.folder/'copy.mdb','fake}pwd')
        self.assertEqual({'readonly':True,'autocommit':False,'timeout':15},connect.call_args.kwargs)
        self.assertIn('PWD=fake}pwd;',connect.call_args.args[0])

    def test_unsafe_odbc_path_is_rejected_before_driver_connection(self):
        import types
        connect=Mock()
        with patch.dict(sys.modules,{'pyodbc':types.SimpleNamespace(connect=connect)}):
            for name in ('copy;.mdb','copy}.mdb','copy\n.mdb'):
                with self.assertRaises(ValueError): mdb.connect_copy(self.folder/name,'fixture')
        connect.assert_not_called()

    def test_password_separators_or_trimmed_values_do_not_reach_driver(self):
        import types
        connect=Mock()
        with patch.dict(sys.modules,{'pyodbc':types.SimpleNamespace(connect=connect)}):
            for password in ('fake;PWD=other',' fake','fake ','fake\n',None):
                with self.assertRaises(ValueError): mdb.connect_copy(self.folder/'copy.mdb',password)
        connect.assert_not_called()

    def test_bad_schema_or_changed_tag_closes_connection_and_never_commits(self):
        for mismatch in ('schema','tag'):
            connection=Mock(autocommit=False);cursor=Mock();connection.cursor.return_value=cursor
            cursor.description=[('wrong',)] if mismatch=='schema' else [(name,) for required in mdb.TABLES.values() for name in required]
            cursor.execute.return_value=cursor;cursor.fetchone.return_value=(1,)
            cursor.fetchall.return_value=[]
            with self.assertRaises(ValueError): mdb.validate_copy(self.source,'fixture',self.plan,connect=lambda *args:connection)
            connection.rollback.assert_called_once();connection.close.assert_called_once();connection.commit.assert_not_called()


if __name__=='__main__': unittest.main()
