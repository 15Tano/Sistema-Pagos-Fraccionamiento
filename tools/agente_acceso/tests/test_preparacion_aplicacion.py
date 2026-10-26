"""Preparacion de alcance: servicios y sistema sustituidos, ninguna aprobacion."""
import contextlib
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock,patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import preparar_aplicacion as prep
import aplicacion_vigencias as app
from test_aplicacion_vigencias import API,ACCESS,C3,CARD


class PreparationTests(unittest.TestCase):
    def setUp(self):
        self.root=ROOT/'datos'/'pruebas_preparacion_aplicador';self.root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=self.root);self.folder=Path(self.temp.name)
    def tearDown(self):
        if not self.folder.resolve().is_relative_to(self.root.resolve()): raise RuntimeError('Temporal ajeno')
        self.temp.cleanup()

    def test_collect_reads_api_then_access_then_c3_and_never_emits_approval(self):
        events=[]
        with patch.object(app,'Approval',side_effect=AssertionError('No approval during preparation')):
            result=prep.collect(CARD,lambda:events.append('api') or API,lambda c:events.append('access') or ACCESS,lambda c:events.append('c3') or C3)
        self.assertEqual(['api','access','c3'],events)
        self.assertFalse(result['approval_issued']);self.assertEqual(app.digest(result['plan']),result['plan_sha256'])

    def test_missing_api_or_access_does_not_query_later_components(self):
        access=Mock(return_value=None);panel=Mock()
        with self.assertRaises(app.ScopeRejected): prep.collect(CARD,lambda:[{'card_no':'22345678','expiration':API[0]['expiration']}],access,panel)
        access.assert_not_called();panel.assert_not_called()
        with self.assertRaises(app.ScopeRejected): prep.collect(CARD,lambda:API,access,panel)
        panel.assert_not_called()

    def test_cli_cannot_enable_apply_or_create_an_approval(self):
        with patch.object(sys,'argv',['preparar_aplicacion.py','--aplicar']),patch.object(prep,'verify_package') as verify,contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit): prep.main()
        verify.assert_not_called()

    def run_prepare(self,missing=False):
        root=self.folder/'paquete';root.mkdir()
        data=self.folder/'data';data.mkdir()
        sync=self.folder/'sync';sync.mkdir();(sync/'fixture').write_bytes(b'fixture')
        gestor=self.folder/'gestor';gestor.mkdir()
        diag=types.SimpleNamespace(maintenance_guard=Mock(),maintenance_lock=contextlib.nullcontext)
        def read(path,maximum=131072): return json.loads(Path(path).read_text())
        def save(path,value): Path(path).write_text(json.dumps(value))
        pub=types.SimpleNamespace(read=read,save=save,own_lock=lambda path:contextlib.nullcontext())
        connection=Mock();connection.autocommit=False
        connection.cursor.return_value.execute.return_value.fetchall.return_value=[(42,CARD,app.parse_date(ACCESS['start']),app.parse_date(ACCESS['end']),True)]
        pyodbc=types.SimpleNamespace(connect=Mock(return_value=connection))
        api=[{'card_no':'22345678','expiration':API[0]['expiration']}] if missing else API
        source=types.SimpleNamespace(api_request=Mock(),DB_PATH='ficticia.mdb',
            urllib=types.SimpleNamespace(request=types.SimpleNamespace(urlopen=Mock(return_value=io.BytesIO(json.dumps(api).encode())))))
        exchange=Mock(return_value={CARD:C3})
        def receipts(run): return {'total':16+exchange.call_count,'current':[{'worker_id':run,'pid':123456701}] if exchange.called else []}
        with patch.object(prep,'ROOT',root),patch.object(prep.trial,'ROOT',root),patch.object(prep.trial,'DATA',data),patch.object(prep.trial,'SYNC',sync), \
             patch.object(prep,'EXPECTED',{'fixture':hashlib.sha256(b'fixture').hexdigest()}),patch.object(prep.struct,'calcsize',return_value=8), \
             patch.object(prep.closures,'diagnostic_module',return_value=diag),patch.object(prep.core,'check_operations',return_value=16), \
             patch.object(prep.trial,'publisher',return_value=pub),patch.object(prep.trial,'inspector',return_value=types.SimpleNamespace(inventory=lambda:{'processes':[]})), \
             patch.object(prep.trial,'receipts',side_effect=receipts),patch.object(prep,'load_reference',return_value=source), \
             patch.object(prep.core,'Exchange',return_value=exchange),patch.dict(sys.modules,{'pyodbc':pyodbc}), \
             patch.dict(os.environ,{'SANISIDRO_ACCESS_PASSWORD':'private_fixture'}),contextlib.redirect_stdout(io.StringIO()):
            code=prep.prepare(CARD)
        state=json.loads((root/'estado_puente.json').read_bytes())
        result=json.loads((root/'datos'/'sesiones'/state['run_id']/'resultado.json').read_bytes())
        return code,state,result,pyodbc,connection,exchange

    def test_preparation_uses_readonly_access_and_saves_unapproved_plan_with_closure(self):
        code,state,result,pyodbc,connection,exchange=self.run_prepare()
        self.assertEqual(0,code);self.assertEqual('stopped',state['phase']);self.assertTrue(result['plan_created'])
        self.assertFalse(result['approval_issued']);self.assertEqual(app.digest(result['plan']),result['plan_sha256'])
        self.assertTrue(pyodbc.connect.call_args.kwargs['readonly']);self.assertFalse(pyodbc.connect.call_args.kwargs['autocommit'])
        exchange.assert_called_once_with({'mode':'read'});connection.close.assert_called_once()
        self.assertNotIn('private_fixture',json.dumps(result))

    def test_api_absent_preparation_closes_cleanly_without_access_or_sdk(self):
        code,state,result,pyodbc,connection,exchange=self.run_prepare(missing=True)
        self.assertEqual(1,code);self.assertEqual('stopped',state['phase']);self.assertFalse(result['plan_created'])
        self.assertEqual('api',result['stage']);pyodbc.connect.assert_not_called();exchange.assert_not_called()


if __name__=='__main__': unittest.main()
