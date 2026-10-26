"""Coordinacion ficticia y lanzador con DPAPI de prueba; sin caseta/SDK/tareas."""
import contextlib
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import types
import unittest
import uuid
from unittest.mock import Mock,patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import respaldo_real_mdb as real
import test_aplicacion_vigencias as fixtures

RUN='41a96f2d-c08d-4b5b-80e3-ccf7dc6c48c0'
OTHER='c51e7219-665c-4d43-9ca5-b7a42af60251'
FAKE='fixture_only_DPAPI_pwd'


class CoordinationTests(unittest.TestCase):
    def setUp(self):
        self.root=ROOT/'datos'/'pruebas_respaldo_real';self.root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=self.root);self.folder=Path(self.temp.name)
        self.package=self.folder/'package';self.package.mkdir()
        self.sync=self.folder/'sync';self.sync.mkdir();(self.sync/'registros').mkdir()
        self.data=self.folder/'data';self.data.mkdir()
        self.gestor=self.folder/'gestor';self.gestor.mkdir()
        (self.gestor/'mantenimiento.json').write_text('{"active":true}')
        self.sync_state={'protocol':2,'phase':'stopped','pid':123456799}
        self.write_sync()
        (self.sync/'reference.py').write_bytes(b'fixture-r2')
        for name in ('sync.lock','access-password.dpapi'): (self.sync/name).write_bytes(b'fixture-placeholder')
        self.source=self.folder/'source.mdb';self.source.write_bytes(b'mdb-fixture-content')
        self.plan=fixtures.plan();self.plan_path=self.folder/'plan_propuesto.json'
        self.plan_path.write_text(json.dumps({'plan':self.plan,'plan_sha256':fixtures.app.digest(self.plan),'approval_issued':False}))
        self.snapshot={'tasks':[{'name':'SanIsidro-Vigencias','state':'Disabled','enabled':False}],'processes':[]}
        self.locks=[]
        @contextlib.contextmanager
        def lock(path=None):
            self.locks.append(('acquire',str(path)))
            try: yield
            finally: self.locks.append(('release',str(path)))
        def read(path,maximum=131072):
            if Path(path).stat().st_size>maximum: raise ValueError('Fixture excedido.')
            return json.loads(Path(path).read_text())
        def save(path,value): Path(path).write_text(json.dumps(value))
        self.publisher=types.SimpleNamespace(read=read,save=save,own_lock=lock)
        self.diag=types.SimpleNamespace(GESTOR=self.gestor,maintenance_guard=Mock(),maintenance_lock=lambda:lock('sync.lock'))
        self.inspector=types.SimpleNamespace(inventory=lambda:copy.deepcopy(self.snapshot))
        self.opened=[]
        @contextlib.contextmanager
        def source_open(path):
            self.opened.append('open')
            with path.open('rb') as stream: yield stream
            self.opened.append('closed')
        self.copy=Mock(side_effect=self.fake_copy)
        self.stack=contextlib.ExitStack()
        for name,value in [('ROOT',self.package),('DESTINATION',self.package),('SOURCE',self.source),('PLAN_PATH',self.plan_path),
                           ('PLAN_SHA',fixtures.app.digest(self.plan)),('EXPECTED',{'reference.py':hashlib.sha256(b'fixture-r2').hexdigest()})]:
            self.stack.enter_context(patch.object(real,name,value))
        for name,value in [('SYNC',self.sync),('DATA',self.data)]: self.stack.enter_context(patch.object(real.trial,name,value))
        self.stack.enter_context(patch.object(real,'pub',return_value=self.publisher))
        self.stack.enter_context(patch.object(real.trial,'inspector',return_value=self.inspector))
        self.stack.enter_context(patch.object(real.trial.closures,'diagnostic_module',return_value=self.diag))
        self.ledger=self.stack.enter_context(patch.object(real.core,'check_operations',return_value=17))
        self.stack.enter_context(patch.object(real.mdb,'create_backup',self.copy))
        self.stack.enter_context(patch.object(real.mdb,'exclusive_source',side_effect=source_open))
        self.stack.enter_context(patch.object(real.struct,'calcsize',return_value=8))
        self.stack.enter_context(patch.dict(os.environ,{'SANISIDRO_ACCESS_PASSWORD':FAKE,'SANISIDRO_API_TOKEN':'fixture-token'}))

    def tearDown(self):
        self.stack.close()
        if not self.folder.resolve().is_relative_to(self.root.resolve()): raise RuntimeError('Temporal ajeno.')
        self.temp.cleanup()

    def write_sync(self): (self.sync/'registros'/'estado.json').write_text(json.dumps(self.sync_state))

    def fake_copy(self,source,root,password,plan,*,guard,source_open):
        self.assertEqual(self.source,source);self.assertEqual(FAKE,password)
        self.assertNotIn('SANISIDRO_ACCESS_PASSWORD',os.environ);self.assertNotIn('SANISIDRO_API_TOKEN',os.environ)
        guard()
        with source_open(source) as stream:
            self.assertEqual(source.stat().st_size,os.fstat(stream.fileno()).st_size)
            raw=stream.read(1024)
        guard()
        folder=root/OTHER;folder.mkdir(parents=True)
        (folder/'Database_PRO_antes.mdb').write_bytes(raw)
        receipt={'protocol':1,'backup_id':OTHER,'created_utc':'2026-10-26T02:32:00+00:00',
                 'serial':plan['serial'],'card':plan['card'],'plan_sha256':fixtures.app.digest(plan),
                 'mdb_bytes':len(raw),'mdb_sha256':hashlib.sha256(raw).hexdigest(),
                 'validation':{'table_counts':{}},'status':'copy_verified','approval_issued':False}
        (folder/'manifest.json').write_text(json.dumps(receipt))
        return receipt

    def run_backup(self):
        with contextlib.redirect_stdout(io.StringIO()): return real.backup(RUN)

    def verify(self,run_id=None):
        with contextlib.redirect_stdout(io.StringIO()): return real.verify_closed(run_id)

    def result_path(self): return self.package/'datos'/'sesiones'/RUN/'resultado.json'

    def test_preflight_only_metadata_without_source_open_or_credential_read(self):
        with patch.object(real.mdb,'connect_copy') as connect:
            result=real.preflight()
        self.assertEqual('preflight_ok',result['status']);self.assertFalse(result['source_opened']);self.assertFalse(result['credential_read'])
        self.assertEqual([],self.opened);self.copy.assert_not_called();connect.assert_not_called()
        self.assertFalse((self.package/'estado_respaldo.json').exists())

    def test_fixed_destination_and_x64_are_required_before_copy(self):
        for context in (patch.object(real,'DESTINATION',self.folder/'other'),patch.object(real.struct,'calcsize',return_value=4)):
            with context:
                with self.assertRaises(RuntimeError): real.preflight()
        self.copy.assert_not_called()

    def test_foreign_plan_hash_approval_or_reference_bytes_are_rejected(self):
        original=self.plan_path.read_bytes()
        for value in ({'plan':self.plan,'plan_sha256':'0'*64,'approval_issued':False},
                      {'plan':self.plan,'plan_sha256':fixtures.app.digest(self.plan),'approval_issued':True}):
            self.plan_path.write_text(json.dumps(value))
            with self.assertRaises(ValueError): real.preflight()
        self.plan_path.write_bytes(original);(self.sync/'reference.py').write_bytes(b'changed')
        with self.assertRaises(ValueError): real.preflight()
        self.copy.assert_not_called()

    def test_missing_password_or_launch_identity_never_starts_copy(self):
        os.environ.pop('SANISIDRO_ACCESS_PASSWORD')
        with self.assertRaises(RuntimeError): self.run_backup()
        for key in (None,'../other',True):
            with self.assertRaises((ValueError,TypeError,AttributeError)): real.backup(key)
        self.copy.assert_not_called();self.assertFalse((self.package/'estado_respaldo.json').exists())

    def test_enabled_task_or_non_stopped_state_rejected(self):
        self.snapshot['tasks'][0]['enabled']=True
        with self.assertRaises(RuntimeError): self.run_backup()
        os.environ['SANISIDRO_ACCESS_PASSWORD']=FAKE
        self.snapshot['tasks'][0]['enabled']=False;self.sync_state['phase']='cycle';self.write_sync()
        with self.assertRaises(RuntimeError): self.run_backup()
        self.copy.assert_not_called()

    def test_old_polling_pid_alive_even_with_external_role_blocks(self):
        self.snapshot['processes']=[{'pid':self.sync_state['pid'],'role':'external'}]
        with self.assertRaises(RuntimeError): self.run_backup()
        self.copy.assert_not_called()

    def test_other_reader_blocks_before_copy(self):
        self.snapshot['processes']=[{'pid':123456798,'role':'zkaccess'}]
        with self.assertRaises(RuntimeError): self.run_backup()
        self.copy.assert_not_called()

    def test_revision_or_ledger_error_blocks_before_copy(self):
        (self.data/'cierre_inseguro.json').write_text('{}')
        with self.assertRaises(RuntimeError): self.run_backup()
        (self.data/'cierre_inseguro.json').unlink();os.environ['SANISIDRO_ACCESS_PASSWORD']=FAKE
        self.ledger.side_effect=RuntimeError('fixture-ledger')
        with self.assertRaises(RuntimeError): self.run_backup()
        self.copy.assert_not_called()

    def test_success_saves_result_but_does_not_claim_final_process_closure(self):
        with patch.object(real.app,'Approval',side_effect=AssertionError('No approval')):
            self.assertEqual(0,self.run_backup())
        result=json.loads(self.result_path().read_bytes());state=json.loads((self.package/'estado_respaldo.json').read_bytes())
        self.assertTrue(result['backup_verified']);self.assertFalse(result['sdk_opened']);self.assertFalse(result['approval_issued'])
        self.assertEqual(RUN,result['run_id']);self.assertEqual('stopped',state['phase'])
        self.assertFalse((self.result_path().parent/'cierre_final.json').exists())
        self.assertNotIn(FAKE,json.dumps(result));self.assertEqual(['open','closed'],self.opened)
        self.assertEqual(len([r for r in self.locks if r[0]=='acquire']),len([r for r in self.locks if r[0]=='release']))

    def test_copy_failure_is_redacted_and_can_only_be_closed_after_exit_check(self):
        self.copy.side_effect=OSError('PWD='+FAKE)
        self.assertEqual(1,self.run_backup());result=json.loads(self.result_path().read_bytes())
        self.assertFalse(result['backup_verified']);self.assertEqual('OSError',result['error_type'])
        self.assertNotIn(FAKE,json.dumps(result));self.assertEqual(0,self.verify(RUN))
        proof=json.loads((self.result_path().parent/'cierre_final.json').read_bytes())
        self.assertFalse(proof['backup_verified']);self.assertEqual('cierre_respaldo_confirmado',proof['status'])

    def test_matching_stop_request_prevents_file_read(self):
        (self.package/'detener_respaldo.json').write_text(json.dumps({'pid':os.getpid(),'run_id':RUN}))
        self.assertEqual(1,self.run_backup());self.assertEqual([],self.opened)
        self.assertFalse(json.loads(self.result_path().read_bytes())['backup_verified'])

    def test_stale_stop_request_does_not_stop_another_run(self):
        (self.package/'detener_respaldo.json').write_text(json.dumps({'pid':os.getpid(),'run_id':OTHER}))
        self.assertEqual(0,self.run_backup())

    def test_ctrl_c_is_cooperative_and_signal_handler_is_restored(self):
        old=signal.getsignal(signal.SIGINT);original=self.copy.side_effect
        def cancel(*args,**kwargs):
            signal.getsignal(signal.SIGINT)(signal.SIGINT,None)
            return original(*args,**kwargs)
        self.copy.side_effect=cancel
        self.assertEqual(1,self.run_backup());self.assertEqual([],self.opened)
        self.assertEqual(old,signal.getsignal(signal.SIGINT))

    def test_elapsed_limit_prevents_new_reads_without_killing_processes(self):
        with patch.object(real,'MAX_SECONDS',-1): self.assertEqual(1,self.run_backup())
        self.assertEqual([],self.opened)

    def test_unfinished_previous_session_or_session_limit_blocks_retry(self):
        path=self.package/'estado_respaldo.json';path.write_text('{"phase":"running"}')
        with self.assertRaises(RuntimeError): self.run_backup()
        path.unlink();os.environ['SANISIDRO_ACCESS_PASSWORD']=FAKE
        with patch.object(real,'MAX_RUNS',0):
            # Sin carpeta previa no hay sesiones: crear el contenedor para probar el limite.
            (self.package/'datos'/'sesiones').mkdir(parents=True)
            with self.assertRaises(OSError): self.run_backup()
        self.copy.assert_not_called()

    def test_same_launch_id_cannot_overwrite_existing_run(self):
        self.assertEqual(0,self.run_backup());self.verify(RUN);before=self.result_path().read_bytes()
        os.environ['SANISIDRO_ACCESS_PASSWORD']=FAKE
        with self.assertRaises(FileExistsError): self.run_backup()
        self.assertEqual(before,self.result_path().read_bytes());self.assertEqual(1,self.copy.call_count)

    def test_stopped_without_bound_final_proof_still_blocks_a_new_run(self):
        self.run_backup();os.environ['SANISIDRO_ACCESS_PASSWORD']=FAKE
        with self.assertRaises(RuntimeError):
            with contextlib.redirect_stdout(io.StringIO()): real.backup(OTHER)
        self.assertEqual(1,self.copy.call_count)

    def test_verifier_persists_uuid_pid_result_hash_and_copy_proof(self):
        self.run_backup();self.assertEqual(0,self.verify(RUN))
        proof=json.loads((self.result_path().parent/'cierre_final.json').read_bytes())
        self.assertTrue(proof['backup_verified']);self.assertTrue(proof['source_handle_free'])
        self.assertEqual(fixtures.app.digest(json.loads(self.result_path().read_bytes())),proof['result_sha256'])
        self.assertEqual(RUN,proof['run_id'])

    def test_verifier_never_accepts_a_receipt_from_different_launch(self):
        self.run_backup()
        with self.assertRaises(ValueError): self.verify(OTHER)
        self.assertFalse((self.result_path().parent/'cierre_final.json').exists())

    def test_parent_pid_present_or_reused_blocks_final_closure(self):
        self.run_backup();self.snapshot['processes']=[{'pid':os.getpid(),'role':'control'}]
        with self.assertRaises(RuntimeError): self.verify(RUN)
        self.assertFalse((self.result_path().parent/'cierre_final.json').exists())

    def test_tampered_copy_or_manifest_blocks_final_receipt(self):
        self.run_backup();folder=self.package/'datos'/'mdb_reales'/OTHER
        (folder/'Database_PRO_antes.mdb').write_bytes(b'changed')
        with self.assertRaises(ValueError): self.verify(RUN)
        self.assertFalse((self.result_path().parent/'cierre_final.json').exists())

    def test_source_still_busy_prevents_final_confirmation(self):
        self.run_backup()
        with patch.object(real.mdb,'exclusive_source',side_effect=OSError('fixture busy')):
            with self.assertRaises(OSError): self.verify(RUN)

    def test_final_check_does_not_require_capacity_for_another_backup(self):
        self.run_backup()
        with patch.object(real.mdb,'admit',side_effect=AssertionError('No new admission')):
            self.assertEqual(0,self.verify(RUN))

    def test_partial_result_is_not_accepted(self):
        self.run_backup();self.result_path().write_bytes(b'{')
        with self.assertRaises(ValueError): self.verify(RUN)
        self.assertFalse((self.result_path().parent/'cierre_final.json').exists())

    def test_state_changed_during_final_check_does_not_save_proof(self):
        self.run_backup();original=self.publisher.read;calls=[0]
        def changed(path,maximum=131072):
            value=original(path,maximum)
            if Path(path)==self.package/'estado_respaldo.json':
                calls[0]+=1
                if calls[0]>1: return value|{'run_id':OTHER}
            return value
        self.publisher.read=changed
        with self.assertRaises(RuntimeError): self.verify(RUN)
        self.assertFalse((self.result_path().parent/'cierre_final.json').exists())

    def test_final_check_requires_exclusive_operating_lock(self):
        self.run_backup()
        self.diag.maintenance_lock=Mock(side_effect=OSError('fixture lock busy'))
        with self.assertRaises(OSError): self.verify(RUN)
        self.assertFalse((self.result_path().parent/'cierre_final.json').exists())

    def test_cli_has_no_source_force_apply_or_credential_arguments(self):
        for option in ('--aplicar','--source','--force','--password'):
            with patch.object(sys,'argv',['respaldo_real_mdb.py',option]),contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit): real.main()

    def test_stop_cli_targets_only_current_pid_and_uuid(self):
        state={'pid':123456797,'run_id':RUN,'phase':'running'}
        (self.package/'estado_respaldo.json').write_text(json.dumps(state))
        with patch.object(real,'verify_package'),patch.object(sys,'argv',['respaldo_real_mdb.py','--detener']),contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(0,real.main())
        stop=json.loads((self.package/'detener_respaldo.json').read_bytes())
        self.assertEqual({'pid':state['pid'],'run_id':RUN},stop);self.copy.assert_not_called()


@unittest.skipUnless(os.name=='nt','Requiere Windows PowerShell/DPAPI para el fixture.')
class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.root=ROOT/'datos'/'pruebas_lanzador_mdb';self.root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=self.root);self.folder=Path(self.temp.name)
        self.environment={k:v for k,v in os.environ.items() if not k.upper().startswith('SANISIDRO_') and k.upper()!='PSMODULEPATH'}
        self.secret=self.folder/'fixture.dpapi'
        self.environment['MDB_FIXTURE_SECRET_PATH']=str(self.secret)
        code="$ErrorActionPreference='Stop'; ConvertTo-SecureString '"+FAKE+"' -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $env:MDB_FIXTURE_SECRET_PATH"
        process=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',code],env=self.environment,capture_output=True,timeout=20,
            creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        if process.returncode:
            self.temp.cleanup();self.fail('No se pudo crear credencial DPAPI ficticia.')
        source=(ROOT/'lanzar_respaldo_real.ps1').read_text()
        source=source.replace(r'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe',sys.executable)
        source=source.replace(r'C:\SanIsidro\ZKSync\access-password.dpapi',str(self.secret))
        self.launcher=self.folder/'lanzar_respaldo_real.ps1';self.launcher.write_text(source)
        (self.folder/'verificar_respaldo_real.ps1').write_text("Write-Output 'fixture_package_verified'")
        helper='''import json,os,sys
from pathlib import Path
root=Path(__file__).resolve().parent
mode=sys.argv[1]
run=sys.argv[sys.argv.index('--run-id')+1]
entry={'mode':mode,'run_id':run,'pid':os.getpid(),'secret_present':os.environ.get('SANISIDRO_ACCESS_PASSWORD')=='fixture_only_DPAPI_pwd','args_contain_secret':any('fixture_only_DPAPI_pwd' in a for a in sys.argv)}
with (root/'calls.jsonl').open('a') as stream: stream.write(json.dumps(entry)+'\\n')
code=int(os.environ.get('MDB_FIXTURE_BACKUP_EXIT' if mode=='--respaldar' else 'MDB_FIXTURE_VERIFY_EXIT','0'))
raise SystemExit(code)
'''
        (self.folder/'respaldo_real_mdb.py').write_text(helper)

    def tearDown(self):
        if not self.folder.resolve().is_relative_to(self.root.resolve()): raise RuntimeError('Temporal ajeno.')
        self.temp.cleanup()

    def run_launcher(self,backup=0,verify=0):
        environment=self.environment|{'MDB_FIXTURE_BACKUP_EXIT':str(backup),'MDB_FIXTURE_VERIFY_EXIT':str(verify)}
        result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(self.launcher)],
            env=environment,capture_output=True,text=True,timeout=30,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        self.assertNotIn(FAKE,result.stdout+result.stderr)
        path=self.folder/'calls.jsonl'
        rows=[json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []
        return result,rows

    def test_launcher_verifies_after_backup_with_same_uuid_and_without_secret(self):
        result,rows=self.run_launcher()
        self.assertEqual(0,result.returncode);self.assertEqual(['--respaldar','--verificar-cierre'],[r['mode'] for r in rows])
        self.assertTrue(rows[0]['secret_present']);self.assertFalse(rows[1]['secret_present'])
        self.assertEqual(rows[0]['run_id'],rows[1]['run_id']);self.assertNotEqual(rows[0]['pid'],rows[1]['pid'])
        self.assertTrue(all(not r['args_contain_secret'] for r in rows))

    def test_failed_copy_keeps_failure_code_even_when_closure_succeeds(self):
        result,rows=self.run_launcher(backup=1)
        self.assertEqual(1,result.returncode);self.assertEqual(2,len(rows));self.assertFalse(rows[-1]['secret_present'])

    def test_failed_final_verification_returns_failure(self):
        result,rows=self.run_launcher(verify=2)
        self.assertEqual(1,result.returncode);self.assertIn('CIERRE NO CONFIRMADO',result.stdout);self.assertEqual(2,len(rows))

    def test_missing_credential_does_not_launch_or_verify_old_run(self):
        self.secret.unlink();result,rows=self.run_launcher()
        self.assertEqual(1,result.returncode);self.assertEqual([],rows)


if __name__=='__main__': unittest.main()
