"""Cierre/verificador de lanzamiento con IO temporal y controles nativos sustituidos."""
import contextlib
import copy
import io
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock,patch
import uuid
import os

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import piloto_vigencias_dell as entry
from emisor_servicio import save,read


class ClosureTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_piloto_cierre';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base);self.root=Path(self.temp.name)/'package';self.root.mkdir()
        self.sync=self.root.parent/'ZKSync';self.sync.mkdir();(self.sync/'sync.lock').write_bytes(b'0')
        self.manager=self.root.parent/'GestionTags';self.manager.mkdir()
        self.key=str(uuid.uuid4());self.folder=self.root/'datos'/'sesiones'/self.key;self.folder.mkdir(parents=True)
        self.marker={'protocol':1,'purpose':'pilot_vigencias','run_id':self.key,'pid':123}
        self.result={'pid':123,'run_id':self.key,'phase':'stopped','worker_receipts':[],
            'dates_applied':False,'approval_issued':False,'review_marker':self.marker}
        save(self.folder/'resultado.json',self.result);save(self.root/'estado_piloto.json',{'pid':123,'run_id':self.key,'phase':'stopped'})
        save(self.manager/'revision_pendiente.json',self.marker)
        self.stack=contextlib.ExitStack();self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(entry,'ROOT',self.root));self.stack.enter_context(patch.object(entry,'SYNC',self.sync))
        self.stack.enter_context(patch.object(entry,'preflight'));self.stack.enter_context(patch.object(entry,'quiet'))
        self.stack.enter_context(patch.object(entry,'maintenance'))
        self.stack.enter_context(patch.object(entry.mdb,'exclusive_source',return_value=contextlib.nullcontext()))
        self.stack.enter_context(patch('sys.stdout',io.StringIO()))
    def tearDown(self):self.doCleanups();self.temp.cleanup()

    def test_verified_closure_saves_proof_and_removes_only_own_review_marker(self):
        self.assertEqual(0,entry.verify_closed(self.key))
        self.assertFalse((self.manager/'revision_pendiente.json').exists())
        proof=read(self.folder/'cierre_final.json');self.assertEqual(entry.app.digest(self.result),proof['result_sha256'])
        self.assertTrue(proof['safe_to_resume']);entry.check_previous()

    def test_wrong_launcher_uuid_does_not_touch_review_marker(self):
        with self.assertRaises(PermissionError):entry.verify_closed(str(uuid.uuid4()))
        self.assertEqual(self.marker,read(self.manager/'revision_pendiente.json'))

    def test_fault_never_becomes_confirmed_closure(self):
        save(self.root/'estado_piloto.json',{'pid':123,'run_id':self.key,'phase':'fault'})
        with self.assertRaises(PermissionError):entry.verify_closed(self.key)
        self.assertFalse((self.folder/'cierre_final.json').exists())

    def test_partial_transaction_blocks_proof_and_removal(self):
        folder=self.folder/'transacciones'/str(uuid.uuid4());folder.mkdir(parents=True)
        save(folder/'transaction.json',{'status':'requires_review'})
        with self.assertRaises(entry.app.core.ReviewRequired):entry.verify_closed(self.key)
        self.assertTrue((self.manager/'revision_pendiente.json').exists());self.assertFalse((self.folder/'cierre_final.json').exists())

    def test_foreign_review_marker_is_never_removed(self):
        foreign={'purpose':'other'};save(self.manager/'revision_pendiente.json',foreign)
        with self.assertRaises(PermissionError):entry.verify_closed(self.key)
        self.assertEqual(foreign,read(self.manager/'revision_pendiente.json'))

    def test_missing_receipt_in_result_blocks_confirmation(self):
        self.result['worker_receipts']=[{'worker_id':str(uuid.uuid4()),'pid':555}];save(self.folder/'resultado.json',self.result)
        with self.assertRaises(PermissionError):entry.verify_closed(self.key)
        self.assertTrue((self.manager/'revision_pendiente.json').exists())

    def test_open_source_handle_prevents_resume(self):
        with patch.object(entry.mdb,'exclusive_source',side_effect=OSError('fixture still open')):
            with self.assertRaises(OSError):entry.verify_closed(self.key)
        self.assertTrue((self.manager/'revision_pendiente.json').exists())

    def test_previous_unverified_launch_blocks_new_one(self):
        with self.assertRaises(FileNotFoundError):entry.check_previous()

    def test_cli_rejects_force_and_continuous_modes(self):
        for option in ('--force','--continuo','--todos'):
            with patch.object(sys,'argv',['pilot',option]),patch('sys.stderr',io.StringIO()):
                with self.assertRaises(SystemExit):entry.main()

    def test_preflight_rejects_limited_process_before_reading_installed_files(self):
        # El principal Highest de la tarea no acredita elevacion de esta consola.
        with patch.object(entry,'DESTINATION',self.root),patch.object(entry,'is_elevated',return_value=False), \
                patch.object(entry.installed,'sha') as sha:
            # setUp sustituye preflight; invocar su funcion original desde el modulo nuevo.
            import importlib.util
            spec=importlib.util.spec_from_file_location('_pilot_elevation_test',ROOT/'piloto_vigencias_dell.py')
            actual=importlib.util.module_from_spec(spec);spec.loader.exec_module(actual)
            with patch.object(actual,'ROOT',self.root),patch.object(actual,'DESTINATION',self.root),patch.object(actual,'is_elevated',return_value=False):
                with self.assertRaises(actual.ElevationRequired):actual.preflight()
        sha.assert_not_called()


class NativeEntryWiringTests(unittest.TestCase):
    def test_actual_launcher_runtime_then_verifier_and_second_noop_in_fictitious_environment(self):
        import test_respaldo_mdb_ace as native
        import test_ciclo_operativo as fixture
        import test_aplicacion_vigencias as f
        db=native.NativeMDBTests('runTest');db.setUp();self.addCleanup(db.tearDown)
        h=fixture.CycleTests('runTest');h.setUp();self.addCleanup(h.doCleanups)
        # ACE limita rutas; no modificar LongPaths ni usar datos instalados.
        short=tempfile.TemporaryDirectory(prefix='si-pilot-')
        short_root=Path(short.name).resolve();temp_root=Path(tempfile.gettempdir()).resolve()
        def cleanup_short():
            if short_root.parent!=temp_root or not short_root.name.startswith('si-pilot-'):
                raise RuntimeError('Temporal fuera de raiz de pruebas.')
            short.cleanup()
        self.addCleanup(cleanup_short)
        root=short_root/'package';root.mkdir();sync=short_root/'ZKSync';sync.mkdir();(sync/'sync.lock').write_bytes(b'0')
        (sync/'registros').mkdir();save(sync/'registros'/'estado.json',{'protocol':2,'pid':999999,'phase':'stopped'})
        manager=short_root/'GestionTags';manager.mkdir();save(manager/'mantenimiento.json',{'active':True})
        def transport(data,python,*,gate,guard,**kwargs):
            h.h.ledger=Path(data)/'cierres';h.h.gate=gate;h.sdk.ledger=h.h.ledger;h.sdk.gate=gate
            return h.sdk
        def inventory(_):
            return {'tasks':[dict(name=name,state='Disabled' if name.endswith('Vigencias') else 'Ready',
                enabled=not name.endswith('Vigencias'),actions_verified=True,same_user=True,highest=True,interactive=True)
                for name in ('SanIsidro-Vigencias','SanIsidro-Vigilancia')]}
        def response(_request,**kwargs):return contextlib.nullcontext(io.BytesIO(f.app.core.encoded(f.API)))
        with contextlib.ExitStack() as stack:
            for name,value in (('ROOT',root),('SYNC',sync),('SOURCE',db.source)):
                stack.enter_context(patch.object(entry,name,value))
            stack.enter_context(patch.object(entry,'preflight'));stack.enter_context(patch.object(entry,'quiet'))
            stack.enter_context(patch.object(entry.native,'inventory',side_effect=inventory))
            stack.enter_context(patch.object(entry,'load_reference',return_value=types.SimpleNamespace(api_request=lambda:'fixture')))
            stack.enter_context(patch.object(entry.urllib.request,'urlopen',side_effect=response))
            stack.enter_context(patch.object(entry.checkpoint,'CycleTransport',side_effect=transport))
            confirm=stack.enter_context(patch.object(entry,'confirmation',return_value=True))
            stack.enter_context(patch('sys.stdout',io.StringIO()))
            for index in range(2):
                key=str(uuid.uuid4())
                with patch.dict(os.environ,{'SANISIDRO_ACCESS_PASSWORD':native.PASSWORD}):
                    self.assertEqual(0,entry.run_actual(f.CARD,key))
                self.assertTrue((manager/'revision_pendiente.json').exists())
                result=read(root/'datos'/'sesiones'/key/'resultado.json')
                self.assertEqual('verified' if index==0 else 'no_changes',result['status'])
                self.assertEqual(0,entry.verify_closed(key));self.assertFalse((manager/'revision_pendiente.json').exists())
            self.assertEqual(1,confirm.call_count)


if __name__=='__main__':unittest.main()
