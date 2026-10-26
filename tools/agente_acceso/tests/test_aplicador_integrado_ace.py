"""MDB/DPAPI nativos y SDK/API ficticios. Conciliacion solo en otra copia ficticia."""
import copy
import os
from pathlib import Path
import shutil
import sys
import types
import unittest
from unittest.mock import Mock

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import aplicador_integrado as integrated
import test_aplicador_integrado as simulation
import test_aplicacion_vigencias as fixtures
import test_respaldo_mdb_ace as native


@unittest.skipUnless(os.name=='nt','Requiere Windows/ACE/DPAPI x64.')
class NativeIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.fixture=native.NativeMDBTests('runTest');self.fixture.setUp()
        self.folder=self.fixture.folder;self.connections=[]

    def tearDown(self):
        for connection in self.connections: connection.close()
        self.fixture.tearDown()

    def close(self,connection):
        connection.rollback();connection.close();self.connections.remove(connection)

    def runner(self,folder,source,user,plan):
        import pyodbc
        # Nunca reutilizar una ruta instalada para esta prueba.
        self.assertTrue(source.resolve().is_relative_to(self.folder.resolve()))
        harness=simulation.IntegratedTests('runTest')
        harness.folder=folder;folder.mkdir()
        harness.source=source;harness.user=copy.deepcopy(user);harness.plan=copy.deepcopy(plan)
        harness.permits=copy.deepcopy(simulation.p.PERMITS);harness.api=[{'card_no':plan['card'],'expiration':plan['api_end']}]
        harness.access_before=copy.deepcopy(plan['access_before']);harness.events=[]
        harness.guard=Mock();harness.gate=integrated.SDKGate();harness.fault=None;harness.after_read=None
        harness.ledger=folder/'workers';harness.evidence=folder/'transactions';harness.mdb_root=folder/'mdb'
        harness.store=integrated.protected.Store(folder/'profiles')
        harness.bundle=integrated.prepare_bundle(plan,user,harness.permits,source,harness.mdb_root,native.PASSWORD,
            harness.store,folder/'bundles',guard=harness.guard)
        connection=pyodbc.connect('Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq='+str(source)+';PWD='+native.PASSWORD+';',autocommit=False)
        self.connections.append(connection);harness.access=fixtures.app.AccessDates(connection)
        return harness,connection

    def test_partial_failure_reconciles_in_separate_lab_copy_using_new_api_preserving_original_block(self):
        original,connection=self.runner(self.folder/'original_attempt',self.fixture.source,fixtures.USER,fixtures.plan())
        live=original.access;before=live.read(fixtures.CARD)
        original.access=types.SimpleNamespace(read=live.read,update=Mock(side_effect=OSError('fixture ack lost before Access write')))
        with self.assertRaises(integrated.core.ReviewRequired): original.execute()
        self.assertEqual('20261105',original.user['EndTime']);self.assertEqual(before,live.read(fixtures.CARD))
        original.access_before=live.read(fixtures.CARD)
        original.api[0]['expiration']='2026-12-05 23:59:59'
        review=original.review();self.assertEqual('needs_api_reconciliation',review['status'])
        self.assertFalse(review['retry_authorized']);self.close(connection)
        old_files={str(path):path.read_bytes() for path in original.evidence.rglob('*.json')}
        with self.assertRaises(integrated.core.ReviewRequired): integrated.check_runs(original.evidence)

        # Ensayo explicito en OTRA MDB ficticia, no excepcion al bloqueo operativo.
        isolated=self.folder/'lab_copy.mdb'
        with integrated.mdb.exclusive_source(self.fixture.source) as source,isolated.open('xb') as output:
            shutil.copyfileobj(source,output)
        lab,lab_connection=self.runner(self.folder/'reconciliation_lab',isolated,original.user,review['plan'])
        result=lab.execute();self.assertEqual('verified',result['status'])
        self.assertEqual('20261205',lab.user['EndTime'])
        self.assertEqual('2026-12-05 23:59:59',lab.access.read(fixtures.CARD)['end'])
        cursor=lab_connection.cursor()
        self.assertEqual((99,'99999999','private_fixture_name'),tuple(cursor.execute('SELECT USERID,CardNo,name FROM USERINFO WHERE USERID=99').fetchone()))
        self.assertEqual(1,cursor.execute('SELECT COUNT(*) FROM CHECKINOUT').fetchone()[0])
        self.assertEqual(2,cursor.execute('SELECT COUNT(*) FROM acc_levelset_emp').fetchone()[0]);cursor.close()
        self.close(lab_connection)
        check=integrated.mdb.connect_copy(self.fixture.source,native.PASSWORD)
        try: self.assertEqual(before,fixtures.app.AccessDates(check).read(fixtures.CARD))
        finally: check.close()
        self.assertTrue(all(Path(path).read_bytes()==raw for path,raw in old_files.items()))
        with self.assertRaises(integrated.core.ReviewRequired): integrated.check_runs(original.evidence)
        _,snapshot=original.bundle.check(original.plan);self.assertEqual(fixtures.USER,snapshot['user'])


if __name__=='__main__': unittest.main()
