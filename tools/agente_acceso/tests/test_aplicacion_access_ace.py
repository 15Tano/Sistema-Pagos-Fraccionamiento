"""Validacion local ACE/ODBC real, exclusivamente sobre MDB ficticios propios."""
import datetime as dt
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import aplicacion_vigencias as app
from test_aplicacion_vigencias import API,C3,CARD,END,approval


class NativeAccessTests(unittest.TestCase):
    def setUp(self):
        import pyodbc
        self.root=ROOT/'datos'/'pruebas_access_aplicador';self.root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=self.root);self.folder=Path(self.temp.name)
        self.path=self.folder/'ficticia.mdb'
        escaped=str(self.path).replace("'","''")
        command=("$ErrorActionPreference='Stop'; $appCatalog=New-Object -ComObject ADOX.Catalog; "
                 "$null=$appCatalog.Create('Provider=Microsoft.ACE.OLEDB.12.0;Data Source="+escaped+
                 ";Jet OLEDB:Engine Type=5;'); $appCatalog.ActiveConnection.Close()")
        result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',command],
            capture_output=True,timeout=30,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        if result.returncode:
            self.temp.cleanup()
            self.fail('ACE no pudo crear MDB ficticio; codigo='+str(result.returncode))
        self.connection=pyodbc.connect('Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq='+str(self.path)+';',autocommit=False)
        cursor=self.connection.cursor()
        cursor.execute('CREATE TABLE USERINFO (USERID LONG PRIMARY KEY, CardNo TEXT(32), name TEXT(50), privilege SHORT, acc_startdate DATETIME, acc_enddate DATETIME, set_valid_time YESNO)')
        for uid,card in ((42,CARD),(99,'99999999')):
            cursor.execute('INSERT INTO USERINFO (USERID,CardNo,name,privilege,acc_startdate,acc_enddate,set_valid_time) VALUES (?,?,?,?,?,?,?)',
                uid,card,'Fixture',3,app.START,dt.datetime(2026,10,1,23,59,59),True)
        cursor.execute('CREATE TABLE acc_levelset_emp (employee_id LONG, acclevelset_id LONG)')
        cursor.execute('INSERT INTO acc_levelset_emp (employee_id,acclevelset_id) VALUES (?,?)',42,5)
        self.connection.commit();cursor.close();self.access=app.AccessDates(self.connection)

    def tearDown(self):
        if hasattr(self,'connection'): self.connection.close()
        if hasattr(self,'folder'):
            if not self.folder.resolve().is_relative_to(self.root.resolve()): raise RuntimeError('Temporal ajeno')
            self.temp.cleanup()

    def scope(self):
        before=self.access.read(CARD)
        return before,approval(app.make_plan(CARD,API,before,dict(C3,EndTime='20261105')))

    def test_real_update_verifies_dates_and_preserves_user_fields_memberships_other_tag(self):
        before,scope=self.scope();other=self.access.read('99999999')
        result=self.access.update(before,END,scope)
        self.assertEqual('2026-11-05 23:59:59',result['end']);self.assertEqual(other,self.access.read('99999999'))
        cursor=self.connection.cursor()
        self.assertEqual(('Fixture',3),tuple(cursor.execute('SELECT name,privilege FROM USERINFO WHERE USERID=?',42).fetchone()))
        self.assertEqual((42,5),tuple(cursor.execute('SELECT employee_id,acclevelset_id FROM acc_levelset_emp').fetchone()));cursor.close()

    def test_real_null_dates_use_is_null_predicates(self):
        cursor=self.connection.cursor();cursor.execute('UPDATE USERINFO SET acc_startdate=NULL,acc_enddate=NULL WHERE USERID=?',42)
        self.connection.commit();cursor.close()
        before,scope=self.scope();self.assertIsNone(before['start']);self.assertIsNone(before['end'])
        self.access.update(before,END,scope)
        self.assertEqual('2020-01-01 00:00:00',self.access.read(CARD)['start'])
        self.assertEqual('2026-11-05 23:59:59',self.access.read(CARD)['end'])

    def test_real_postupdate_verification_failure_rolls_back(self):
        before,scope=self.scope();read=self.access.read;calls=[0]
        def incorrect(card):
            value=read(card);calls[0]+=1
            return value if calls[0]==1 else dict(value,end='2099-01-01 23:59:59')
        with patch.object(self.access,'read',side_effect=incorrect):
            with self.assertRaises(RuntimeError): self.access.update(before,END,scope)
        self.assertEqual(before,self.access.read(CARD))

    def test_real_optimistic_predicate_detects_change_between_select_and_update(self):
        before,scope=self.scope();connection=self.connection
        class Cursor:
            def __init__(self): self.inner=connection.cursor()
            def execute(self,sql,*args):
                if sql.startswith('UPDATE USERINFO SET acc_startdate = ?'):
                    # Cambio ya confirmado justo antes del UPDATE condicionado.
                    other=connection.cursor();other.execute('UPDATE USERINFO SET acc_enddate=? WHERE USERID=?',dt.datetime(2026,12,5,23,59,59),42)
                    connection.commit();other.close()
                self.inner.execute(sql,*args);return self
            @property
            def rowcount(self): return self.inner.rowcount
            def fetchall(self): return self.inner.fetchall()
            def close(self): self.inner.close()
        proxy=type('Connection',(),{'autocommit':False,'cursor':staticmethod(Cursor),'commit':staticmethod(connection.commit),'rollback':staticmethod(connection.rollback)})()
        access=app.AccessDates(proxy)
        with self.assertRaises(app.ScopeRejected): access.update(before,END,scope)
        self.assertEqual('2026-12-05 23:59:59',self.access.read(CARD)['end'])

    def test_commit_error_after_actual_commit_cannot_claim_rollback_of_committed_data(self):
        before,scope=self.scope();connection=self.connection
        def uncertain_commit():
            connection.commit()
            raise OSError('fixture commit acknowledgement lost')
        proxy=type('Connection',(),{'autocommit':False,'cursor':staticmethod(connection.cursor),'commit':staticmethod(uncertain_commit),'rollback':staticmethod(connection.rollback)})()
        with self.assertRaises(OSError): app.AccessDates(proxy).update(before,END,scope)
        self.assertEqual('2026-11-05 23:59:59',self.access.read(CARD)['end'])


if __name__=='__main__': unittest.main()
