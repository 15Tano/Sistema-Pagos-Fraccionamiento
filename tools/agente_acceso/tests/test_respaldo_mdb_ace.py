"""ACE/Win32/ACL nativos sobre MDB ficticios; ningun archivo de caseta."""
import datetime as dt
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import respaldo_mdb as mdb
import test_aplicacion_vigencias as fixtures
PASSWORD='mdb_fixture_pwd'


@unittest.skipUnless(os.name=='nt','Requiere Windows/ACE x64.')
class NativeMDBTests(unittest.TestCase):
    def setUp(self):
        import pyodbc
        self.root=ROOT/'datos'/'pruebas_respaldo_mdb_ace';self.root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=self.root);self.folder=Path(self.temp.name)
        self.source=self.folder/'ficticia.mdb';self.backups=self.folder/'backups'
        self.connection=None
        try:
            escaped=str(self.source).replace("'","''")
            code=("$ErrorActionPreference='Stop'; $mdbCatalog=New-Object -ComObject ADOX.Catalog; "
                  "$null=$mdbCatalog.Create('Provider=Microsoft.ACE.OLEDB.12.0;Data Source="+escaped+
                  ";Jet OLEDB:Engine Type=5;Jet OLEDB:Database Password="+PASSWORD+";'); $mdbCatalog.ActiveConnection.Close()")
            result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',code],
                capture_output=True,timeout=30,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),
                env={key:value for key,value in os.environ.items() if not key.upper().startswith('SANISIDRO_')})
            if result.returncode: raise RuntimeError('No se pudo crear MDB ficticio.')
            self.connection=pyodbc.connect('Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq='+str(self.source)+';PWD='+PASSWORD+';',autocommit=False)
            cursor=self.connection.cursor()
            for statement in (
                'CREATE TABLE USERINFO (USERID LONG PRIMARY KEY, CardNo TEXT(32), name TEXT(50), acc_startdate DATETIME, acc_enddate DATETIME, set_valid_time YESNO)',
                'CREATE TABLE CHECKINOUT (USERID LONG, CHECKTIME DATETIME)',
                'CREATE TABLE acc_levelset (id LONG PRIMARY KEY, level_name TEXT(50))',
                'CREATE TABLE acc_levelset_emp (employee_id LONG, acclevelset_id LONG)',
                'CREATE TABLE personnel_issuecard (UserID_id LONG, cardno TEXT(32))',
            ): cursor.execute(statement)
            for uid,card in ((42,fixtures.CARD),(99,'99999999')):
                cursor.execute('INSERT INTO USERINFO (USERID,CardNo,name,acc_startdate,acc_enddate,set_valid_time) VALUES (?,?,?,?,?,?)',
                    uid,card,'private_fixture_name',fixtures.app.START,dt.datetime(2026,10,1,23,59,59),True)
                cursor.execute('INSERT INTO acc_levelset_emp VALUES (?,?)',uid,5)
                cursor.execute('INSERT INTO personnel_issuecard VALUES (?,?)',uid,card)
            cursor.execute('INSERT INTO CHECKINOUT VALUES (?,?)',42,dt.datetime(2026,10,25,12))
            cursor.execute('INSERT INTO acc_levelset VALUES (?,?)',5,'fixture_level')
            self.connection.commit();cursor.close();self.connection.close();self.connection=None
        except BaseException:
            if self.connection is not None: self.connection.close()
            self.temp.cleanup();raise

    def tearDown(self):
        if self.connection is not None: self.connection.close()
        if not self.folder.resolve().is_relative_to(self.root.resolve()): raise RuntimeError('Temporal ajeno.')
        self.temp.cleanup()

    def backup(self):
        return mdb.create_backup(self.source,self.backups,PASSWORD,fixtures.plan(),guard=lambda:None)

    def test_native_copy_acl_hash_source_and_five_tables_are_verified(self):
        before=mdb.file_hash(self.source);receipt=self.backup();copy=self.backups/receipt['backup_id']/'Database_PRO_antes.mdb'
        self.assertEqual(before,receipt['mdb_sha256']);self.assertEqual(before,mdb.file_hash(self.source))
        self.assertEqual(before,mdb.file_hash(copy))
        self.assertEqual({'USERINFO':2,'CHECKINOUT':1,'acc_levelset':1,'acc_levelset_emp':2,'personnel_issuecard':2},receipt['validation']['table_counts'])
        connection=mdb.connect_copy(copy,PASSWORD)
        try:
            cursor=connection.cursor()
            self.assertEqual((99,'99999999','private_fixture_name'),tuple(cursor.execute('SELECT USERID,CardNo,name FROM USERINFO WHERE USERID=99').fetchone()))
            self.assertEqual(1,cursor.execute('SELECT COUNT(*) FROM CHECKINOUT').fetchone()[0]);cursor.close()
        finally: connection.close()

    def test_existing_ace_connection_blocks_copy_without_shared_retry(self):
        self.connection=mdb.connect_copy(self.source,PASSWORD)
        with self.assertRaises(mdb.MDBBackupError): self.backup()
        self.assertFalse(self.backups.exists())

    def test_exclusive_handle_blocks_second_reader_writer_then_releases(self):
        with mdb.exclusive_source(self.source):
            with self.assertRaises(OSError): self.source.open('rb')
            with self.assertRaises(OSError): self.source.open('r+b')
        with mdb.exclusive_source(self.source) as stream: self.assertGreater(len(stream.read(10)),0)

    def test_validation_connection_cannot_update_copy(self):
        import pyodbc
        receipt=self.backup();path=self.backups/receipt['backup_id']/'Database_PRO_antes.mdb'
        before=mdb.file_hash(path);connection=mdb.connect_copy(path,PASSWORD)
        try:
            cursor=connection.cursor()
            with self.assertRaises(pyodbc.Error): cursor.execute('UPDATE USERINFO SET name=? WHERE USERID=?','changed',42)
            cursor.close();connection.rollback()
        finally: connection.close()
        self.assertEqual(before,mdb.file_hash(path))

    def test_wrong_schema_keeps_copy_unconfirmed_without_changing_source(self):
        import pyodbc
        connection=pyodbc.connect('Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq='+str(self.source)+';PWD='+PASSWORD+';',autocommit=False)
        cursor=connection.cursor();cursor.execute('DROP TABLE personnel_issuecard');connection.commit();cursor.close();connection.close()
        before=mdb.file_hash(self.source)
        with self.assertRaises(mdb.MDBBackupError): self.backup()
        self.assertEqual(before,mdb.file_hash(self.source));self.assertEqual([],list(self.backups.rglob('manifest.json')))
        self.assertEqual(1,len(list(self.backups.rglob('*.mdb'))))

    def test_existing_private_destination_is_not_overwritten(self):
        receipt=self.backup();folder=self.backups/receipt['backup_id'];before=(folder/'manifest.json').read_bytes()
        with patch.object(mdb.uuid,'uuid4',return_value=receipt['backup_id']):
            with self.assertRaises(mdb.MDBBackupError): self.backup()
        self.assertEqual(before,(folder/'manifest.json').read_bytes());self.assertEqual(1,len(list(self.backups.iterdir())))

    def test_wrong_password_cannot_confirm_protected_mdb_copy(self):
        before=mdb.file_hash(self.source)
        with self.assertRaises(mdb.MDBBackupError) as caught:
            mdb.create_backup(self.source,self.backups,'wrong_fixture_pwd',fixtures.plan(),guard=lambda:None)
        self.assertNotIn('fixture_pwd',str(caught.exception))
        self.assertEqual(before,mdb.file_hash(self.source));self.assertEqual([],list(self.backups.rglob('manifest.json')))


if __name__=='__main__': unittest.main()
