"""Cierres/rutas del lanzador con directorios de prueba; nunca caseta."""
import json
import contextlib
import io
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock,patch
import uuid

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import latencia_dell as trial
from emisor_servicio import read,save,utc
from outbox import Outbox


class ClosureTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_latencia_cierre';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base);self.root=Path(self.temp.name)
        self.owner=self.root/'owner';self.data=self.owner/'acceso-datos'
        self.run_id=str(uuid.uuid4());self.folder=self.data/'sesiones'/self.run_id
        (self.folder/'emisor').mkdir(parents=True)
        self.sync=self.root/'sync';(self.sync/'registros').mkdir(parents=True)
        (self.sync/'sync.lock').write_bytes(b'0')
        self.manager=self.root/'GestionTags';self.manager.mkdir()
        self.review=self.manager/'revision_pendiente.json';self.pointer=self.root/'pointer.json'
        self.marker=trial.marker_for(999991,self.run_id)
        save(self.review,self.marker);save(self.manager/'mantenimiento.json',{'active':True})
        save(self.sync/'registros'/'estado.json',{'protocol':2,'phase':'stopped'})
        self.result={'pid':999991,'run_id':self.run_id,'phase':'stopped','closures_confirmed':True,
            'dates_applied':False,'sdk_gate':{'active':None,'fault':False},'review_marker':self.marker,
            'worker_receipts':[],'sender_pid':999992,'trial_passed':True,'heartbeat_utc':utc()}
        save(self.folder/'resultado.json',self.result)
        save(self.pointer,{'pid':999991,'run_id':self.run_id,'phase':'stopped'})
        save(self.folder/'owner.json',{'pid':999991,'run_id':self.run_id,'phase':'closed'})
        sender_id=str(uuid.uuid4());self.sender={'pid':999992,'run_id':sender_id,'phase':'stopped'}
        save(self.folder/'emisor'/'sender.json',self.sender)
        save(self.folder/'emisor'/'closed.json',{'protocol':1,'pid':999992,'run_id':sender_id,'exit_code':0,'report':self.sender})
        save(self.folder/'emisor'/'request.json',{'protocol':1,'base':str(self.owner),'run_id':sender_id})
        box=Outbox(self.data/'outbox.sqlite',trial.AGENT,trial.SERIAL);box.close()
        self.patches=[patch.object(trial,key,value) for key,value in
            [('ROOT',self.root),('OWNER',self.owner),('SYNC',self.sync),('REVIEW',self.review),('POINTER',self.pointer)]]
        self.patches += [patch.object(trial,'preflight',return_value={}),patch('respaldo_real_mdb.quiet')]
        for p in self.patches:p.start()
    def tearDown(self):
        for p in reversed(self.patches):p.stop()
        self.temp.cleanup()
    def test_valid_final_closure_removes_only_own_review_and_records_measurement(self):
        self.assertEqual(0,trial.verify_closed())
        self.assertFalse(self.review.exists())
        self.assertTrue((self.folder/'medicion.json').exists())
        proof=read(self.folder/'cierre_final.json')
        self.assertEqual(trial.digest(self.result),proof['result_sha256'])
        self.assertTrue(read(self.manager/'mantenimiento.json')['active'])
    def test_foreign_review_is_never_removed(self):
        save(self.review,{'foreign':True})
        with self.assertRaises(PermissionError):trial.verify_closed()
        self.assertEqual({'foreign':True},read(self.review))
    def test_process_exit_without_matching_sender_receipt_does_not_clear_review(self):
        save(self.folder/'emisor'/'closed.json',{'exit_code':0})
        with self.assertRaises(PermissionError):trial.verify_closed()
        self.assertEqual(self.marker,read(self.review))
    def test_fault_or_occupied_sdk_does_not_confirm_closure(self):
        self.result['sdk_gate']['fault']=True
        save(self.folder/'resultado.json',self.result)
        with self.assertRaises(PermissionError):trial.verify_closed()
        self.assertTrue(self.review.exists())
    def test_restart_budget_cannot_be_reset_with_an_immediate_new_run(self):
        trial.verify_closed()
        with self.assertRaises(PermissionError):trial.prior_closed()
    def test_private_owner_preparation_never_changes_installed_config(self):
        from respaldo_mdb import private_directory
        with patch('respaldo_mdb.private_directory',side_effect=lambda root:Path(root).mkdir(exist_ok=True)):
            private=self.root/'prepared';trial.prepare_owner(private)
            self.assertFalse((self.sync/'servicio-config.json').exists())
            self.assertIn('latencia_readonly',(private/'servicio-config.json').read_text())
            (private/'sincronizar_vigencias.py').write_text('# changed fixture')
            with self.assertRaises(PermissionError):trial.prepare_owner(private)


class JoinedTrialTests(unittest.TestCase):
    def test_entry_runs_real_owner_reader_and_sender_with_fake_sdk_api_only(self):
        import sdk_operativo as sdk
        import emisor_latencia as emitter
        import adaptadores_cierre as closures
        from servicio_latencia import LatencyService
        import test_aplicacion_vigencias as f
        base=ROOT/'datos'/'pruebas_latencia_union';base.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(dir=base) as temp:
            root=Path(temp);owner=root/'Owner';sync=root/'InstalledSync';manager=root/'GestionTags'
            (sync/'registros').mkdir(parents=True);manager.mkdir()
            (sync/'sync.lock').write_bytes(b'0')
            save(sync/'registros'/'estado.json',{'protocol':2,'phase':'stopped','pid':999999,'consecutive_errors':0})
            save(manager/'mantenimiento.json',{'active':True})
            original_prepare,original_mark=trial.prepare_owner,trial.mark
            def prepare():
                original_prepare(owner)
                (owner/'acceso-datos').mkdir(exist_ok=True)
                save(owner/'acceso-datos'/'fixture_sdk.json',{'user':f.USER,
                    'rt':'2026-10-28 18:00:00,42,12345678,1,0,0,4\r\n'})
            python=os.environ.get('SI_TEST_CHILD_PYTHON',sys.executable)
            def command(folder,digest):
                return [python,'-B',str(ROOT/'tests'/'latencia_proceso_ficticio.py'),
                    '--worker',str(folder),'--sha256',digest,'--root',str(owner)]
            native_transport,native_rt=sdk.Transport,sdk.RT
            def transport(own,py,gate,**_):return native_transport(own,py,gate,command_factory=command)
            def reader(own,py,gate,**_):return native_rt(own,py,gate,command_factory=command)
            def sender(folder):
                return emitter.Process(folder,owner,command=[sys.executable,'-B',
                    str(ROOT/'tests'/'latencia_proceso_ficticio.py'),'--sender',str(folder),'--root',str(owner)])
            class FastTrial(LatencyService):
                def __init__(self,*args,**kwargs):super().__init__(*args,cycle_interval=1,**kwargs)
                def run(self,seconds=None):return super().run(4)
            patches=[patch.object(trial,key,value) for key,value in
                [('ROOT',root),('OWNER',owner),('SYNC',sync),('PYTHON32',Path(python)),
                 ('POINTER',root/'pointer.json'),('Process',sender)]]
            patches.extend([
                patch.object(trial,'preflight',return_value={}),patch.object(trial,'prior_closed'),
                patch.object(trial,'prepare_owner',side_effect=prepare),
                patch.object(trial,'mark',side_effect=lambda marker:original_mark(marker,manager/'revision_pendiente.json')),
                patch.object(closures,'diagnostic_module',return_value=type('Diag',(),{
                    'maintenance_lock':staticmethod(lambda:sdk.session.sync_lock(sync/'sync.lock'))})()),
                patch('respaldo_real_mdb.quiet'),patch('respaldo_real_mdb.revisions'),
                patch('respaldo_mdb.private_directory',side_effect=lambda p:Path(p).mkdir(parents=True,exist_ok=True)),
                patch.object(sdk,'Transport',side_effect=transport),patch.object(sdk,'RT',side_effect=reader),
                patch('referencia_vigencias.load_reference',return_value=type('Ref',(),{'api_request':staticmethod(lambda:object())})()),
                patch('urllib.request.urlopen',side_effect=lambda *_a,**_k:io.BytesIO(json.dumps(f.API).encode())),
                patch('ciclo_operativo.access_inventory',return_value=[(99,f.CARD,f.app.START,f.END,True)]),
                patch('servicio_latencia.LatencyService',FastTrial),
                patch.dict(os.environ,{'SANISIDRO_ACCESS_PASSWORD':'private_fixture'})])
            with contextlib.ExitStack() as stack:
                for p in patches:stack.enter_context(p)
                output=io.StringIO()
                with contextlib.redirect_stdout(output):code=trial.manual(20)
                pointer=read(root/'pointer.json')
                result=read(owner/'acceso-datos'/'sesiones'/pointer['run_id']/'resultado.json')
                self.assertEqual(0,code,json.dumps(result,indent=2))
            pointer=read(root/'pointer.json');folder=owner/'acceso-datos'/'sesiones'/pointer['run_id']
            result=read(folder/'resultado.json')
            self.assertTrue(result['trial_passed']);self.assertFalse(result['dates_applied'])
            self.assertTrue(result['closures_confirmed']);self.assertGreater(len(result['worker_receipts']),1)
            self.assertEqual('closed',read(folder/'owner.json')['phase'])
            state=read(owner/'acceso-datos'/'fixture_sdk.json')
            self.assertGreater(state['reads'],0);self.assertNotIn('sets',state)
            self.assertTrue((manager/'revision_pendiente.json').exists())  # Verificador final aun no ejecutado.
            self.assertEqual('stopped',read(sync/'registros'/'estado.json')['phase'])


if __name__=='__main__':unittest.main()
