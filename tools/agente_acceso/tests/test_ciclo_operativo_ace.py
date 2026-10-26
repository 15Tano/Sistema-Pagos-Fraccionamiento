"""Ciclo completo con MDB/DPAPI nativos en archivo ficticio separado."""
import contextlib
import copy
import os
from pathlib import Path
import sys
import types
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import ciclo_operativo as cycle
import respaldo_ciclo as checkpoint
import test_ciclo_operativo as simulation
import test_respaldo_mdb_ace as native
import test_aplicacion_vigencias as f


@unittest.skipUnless(os.name=='nt','Requiere Windows/ACE/DPAPI x64.')
class NativeCycleTests(unittest.TestCase):
    def test_native_mdb_cycle_commits_only_api_dates_and_keeps_other_tables_and_backup(self):
        fixture=native.NativeMDBTests('runTest');fixture.setUp()
        self.addCleanup(fixture.tearDown)
        harness=simulation.CycleTests('runTest');harness.setUp()
        self.addCleanup(harness.doCleanups)
        h=harness.h
        h.source=fixture.source;h.mdb_root=fixture.folder/'backups'
        h.store=checkpoint.protected.Store(fixture.folder/'profiles');harness.sdk.store=h.store
        original_hash=checkpoint.mdb.file_hash(fixture.source)
        def prepare(plans,run):
            return checkpoint.prepare(plans,fixture.source,h.mdb_root,native.PASSWORD,harness.sdk,run,
                fixture.folder/'bundles',guard=h.guard)
        @contextlib.contextmanager
        def access():
            import pyodbc
            connection=pyodbc.connect('Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq='+str(fixture.source)+
                ';PWD='+native.PASSWORD+';',autocommit=False,timeout=15)
            try:
                yield f.app.AccessDates(connection)
            finally:
                try: connection.rollback()
                finally: connection.close()
        run=cycle.Cycle(lambda:copy.deepcopy(f.API),lambda:cycle.access_inventory(fixture.source,native.PASSWORD),
            harness.sdk,guard=h.guard,access_factory=access,prepare=prepare,authorize=f.approval,evidence=h.evidence)
        result=run()
        self.assertEqual('verified',result['status']);self.assertEqual(1,result['verified'])
        folders=list(h.mdb_root.iterdir());self.assertEqual(1,len(folders))
        self.assertEqual(original_hash,checkpoint.mdb.file_hash(folders[0]/'Database_PRO_antes.mdb'))
        connection=checkpoint.mdb.connect_copy(fixture.source,native.PASSWORD)
        try:
            self.assertEqual(f.API[0]['expiration'],f.app.AccessDates(connection).read(f.CARD)['end'])
            cursor=connection.cursor()
            try:
                self.assertEqual((99,'99999999','private_fixture_name'),tuple(cursor.execute(
                    'SELECT USERID,CardNo,name FROM USERINFO WHERE USERID=99').fetchone()))
                for table,count in (('CHECKINOUT',1),('acc_levelset',1),('acc_levelset_emp',2),('personnel_issuecard',2)):
                    self.assertEqual(count,cursor.execute('SELECT COUNT(*) FROM '+table).fetchone()[0])
            finally: cursor.close()
        finally: connection.close()
        self.assertEqual('20261105',h.user['EndTime'])
        self.assertEqual(f.USER['Password'],h.user['Password'])


if __name__=='__main__': unittest.main()
