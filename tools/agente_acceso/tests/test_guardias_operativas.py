"""Contratos de activacion, gestor y transporte: sin SDK, red ni tareas reales."""
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock
import uuid

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import config_operativa as config
import guardia_gestor_operativo as guard
import operacion_nativa as native
from emisor_operativo import ArchivingSender
from emisor_servicio import save


class GuardTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_guardias';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base);self.root=Path(self.temp.name)/'ZKSync';self.root.mkdir()
        self.data=self.root/'acceso-datos';self.data.mkdir()
    def tearDown(self):self.temp.cleanup()

    def closed(self):
        key=str(uuid.uuid4());folder=self.data/'cierres'/key;folder.mkdir(parents=True)
        request={'protocol':1,'role':'vigencias','worker_id':key,'run_id':str(uuid.uuid4()),'receipts_dir':None}
        raw=b'{"mode":"read","rows":[]}'
        value={k:request[k] for k in ('protocol','role','run_id','worker_id')}
        value.update(pid=123,closed=True,operation_ok=True,error_type=None,sdk_sha256=guard.SDK_HASH,
            started_utc='2026-10-26T08:00:00+00:00',ended_utc='2026-10-26T08:00:01+00:00',
            response_bytes=len(raw),response_sha256=hashlib.sha256(raw).hexdigest())
        save(folder/'request.json',request);save(folder/'closed.json',value);(folder/'response.json').write_bytes(raw)
        save(folder/'parent_ack.json',{'protocol':1,'pid':123,'exit_code':0,
            'closure_sha256':hashlib.sha256((folder/'closed.json').read_bytes()).hexdigest()})
        return folder

    def test_empty_ledger_and_fully_confirmed_worker_allow_queries(self):
        guard.require_closed(self.root);self.closed();guard.require_closed(self.root,allow_partial_review=False)

    def test_dead_parent_or_stopped_state_does_not_replace_receipt(self):
        folder=self.closed();(folder/'parent_ack.json').unlink()
        (self.root/'registros').mkdir()
        save(self.root/'registros'/'estado.json',{'pid':9999999,'phase':'stopped'})
        with self.assertRaises(OSError):guard.require_closed(self.root)

    def test_receipt_and_response_tampering_block_query(self):
        folder=self.closed();(folder/'response.json').write_bytes(b'other')
        with self.assertRaises(PermissionError):guard.require_closed(self.root)
        (folder/'parent_ack.json').write_text('{}')
        with self.assertRaises(PermissionError):guard.require_closed(self.root)

    def test_partial_date_plan_allows_readonly_review_but_not_resume(self):
        folder=self.data/'transacciones'/str(uuid.uuid4());folder.mkdir(parents=True)
        save(folder/'transaction.json',{'status':'intent'})
        guard.require_closed(self.root)
        with self.assertRaises(PermissionError):guard.require_closed(self.root,allow_partial_review=False)

    def test_sdk_uncertainty_blocks_even_readonly_review(self):
        save(self.data/'cierre_inseguro.json',{})
        with self.assertRaises(PermissionError):guard.require_closed(self.root)

    def test_controller_identity_fault_cannot_be_dismissed_by_clean_disconnect(self):
        folder=self.closed();value=json.loads((folder/'closed.json').read_bytes())
        value.update(operation_ok=False,error_type='ControllerIdentityError',response_bytes=None,response_sha256=None)
        save(folder/'closed.json',value)
        save(folder/'parent_ack.json',{'protocol':1,'pid':123,'exit_code':0,
            'closure_sha256':hashlib.sha256((folder/'closed.json').read_bytes()).hexdigest()})
        with self.assertRaises(PermissionError):guard.require_closed(self.root)

    def test_stop_request_requires_current_pid_and_file_newer_than_process(self):
        path=self.root/'detener.sync.json';save(path,{'pid':123});stamp=path.stat().st_mtime
        self.assertTrue(native.stop_requested(self.root,123,stamp-1))
        self.assertFalse(native.stop_requested(self.root,123,stamp+1))
        self.assertFalse(native.stop_requested(self.root,124,stamp-1))

    def test_task_contract_rejects_wrong_identity_and_unpaused_polling(self):
        rows=[dict(name=name,state='Disabled' if name.endswith('Vigencias') else 'Ready',enabled=not name.endswith('Vigencias'),
              actions_verified=True,same_user=True,highest=True,interactive=True)
              for name in ('SanIsidro-Vigencias','SanIsidro-Vigilancia')]
        native.task_contract({'tasks':rows},maintenance=True)
        wrong=copy.deepcopy(rows);wrong[0]['same_user']=False
        with self.assertRaises(PermissionError):native.task_contract({'tasks':wrong},maintenance=True)
        with self.assertRaises(PermissionError):native.task_contract({'tasks':rows},maintenance=False)

    def powershell_manager(self,mode,*,guard_code='raise SystemExit(1)'):
        manager=self.root.parent/'GestionTags';manager.mkdir()
        source=(ROOT/'gestor_candidato'/'mantenimiento.ps1').read_text(encoding='utf-8')
        source=source.replace("$syncRoot='C:\\SanIsidro\\ZKSync'","$syncRoot='"+str(self.root).replace("'","''")+"'")
        source=source.replace(r'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe',sys.executable)
        (manager/'mantenimiento.ps1').write_text(source,encoding='utf-8')
        (manager/'gt_guard_operativo.py').write_text(guard_code)
        save(manager/'mantenimiento.json',{'active':True,'wasEnabled':True})
        save(self.root/'enlace-integrado.json',{'mode':'integrado'})
        template=r'''
$ErrorActionPreference='Stop'
function Get-ScheduledTask { [pscustomobject]@{Settings=[pscustomobject]@{Enabled=$true}} }
function Get-CimInstance { [pscustomobject]@{Name='python.exe';CommandLine=($syncRoot+'\sincronizar_vigencias.py --aplicar --continuo');ProcessId=123} }
function Disable-ScheduledTask { throw 'UNEXPECTED_TASK_MUTATION' }
function Enable-ScheduledTask { throw 'UNEXPECTED_TASK_MUTATION' }
function Start-ScheduledTask { throw 'UNEXPECTED_TASK_MUTATION' }
function Stop-ScheduledTask { throw 'UNEXPECTED_TASK_MUTATION' }
function Stop-Process { throw 'UNEXPECTED_PROCESS_KILL' }
try { . 'MANAGER' -Operacion 'MODE'; throw 'UNEXPECTED_SUCCESS' }
catch { if($_.Exception.Message -like 'EXPECTED*') { 'REFUSED_WITHOUT_MUTATION';exit 0 }; throw }
'''
        expected='Estado protocol2 no confirmado' if mode=='pausar' else 'Cierre operativo sin confirmar'
        script=template.replace('MANAGER',str(manager/'mantenimiento.ps1').replace("'","''")).replace('MODE',mode).replace('EXPECTED*',expected+'*')
        path=self.root.parent/'fixture_manager.ps1';path.write_text(script,encoding='utf-8')
        return subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(path)],capture_output=True,timeout=15)

    def test_powershell_candidate_never_uses_v1_force_fallback_for_integrated_entry(self):
        child=self.powershell_manager('pausar')
        self.assertEqual(0,child.returncode,child.stderr.decode(errors='replace'))
        self.assertIn(b'REFUSED_WITHOUT_MUTATION',child.stdout)

    def test_powershell_resume_failure_is_checked_before_enabling_task(self):
        child=self.powershell_manager('reanudar')
        self.assertEqual(0,child.returncode,child.stderr.decode(errors='replace'))
        self.assertIn(b'REFUSED_WITHOUT_MUTATION',child.stdout)


class ConfigurationTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_config_operativa';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base);self.root=Path(self.temp.name)
        self.value={'protocol':1,'enabled':True,'agent_id':str(uuid.uuid4()),'serial':config.SERIAL,
            'url':config.URL,'archive_acknowledged':True,'release_sha256':'a'*64}
    def tearDown(self):self.temp.cleanup()
    def settings(self):save(self.root/'servicio-config.json',self.value);return config.load(self.root)
    def accepted(self):
        self.settings();value={'protocol':1,'purpose':'integrated_operation','release_sha256':'a'*64,
            'agent_id':self.value['agent_id'],'serial':config.SERIAL,
            'config_sha256':hashlib.sha256((self.root/'servicio-config.json').read_bytes()).hexdigest(),
            'dates_policy':'api_existing_only','archive_policy':'preserve_all_ack_archives',
            'accepted_checks':dict.fromkeys(('real_date_application','manager_stop_resume','rollback','definitive_https','capacity'),True)}
        save(self.root/'activacion-integrada.json',value);return value

    def test_lab_identity_http_and_other_controller_are_rejected(self):
        for key,value in (('agent_id',config.LAB_AGENT),('url','http://127.0.0.1:18881'),('serial','OTHER')):
            original=self.value[key];self.value[key]=value
            with self.assertRaises(ValueError):self.settings()
            self.value[key]=original

    def test_config_alone_never_grants_activation(self):
        settings=self.settings()
        with self.assertRaises(FileNotFoundError):config.activation(self.root,settings)

    def test_acceptance_is_bound_to_exact_configuration_and_explicit_boolean_checks(self):
        value=self.accepted();settings=config.load(self.root);config.activation(self.root,settings)
        value['accepted_checks']['real_date_application']=1
        save(self.root/'activacion-integrada.json',value)
        with self.assertRaises(PermissionError):config.activation(self.root,settings)
        self.accepted();self.value['enabled']=False;settings=self.settings()
        with self.assertRaises(PermissionError):config.activation(self.root,settings)

    def test_extra_secret_field_is_rejected_without_logging_it(self):
        self.value['token']='fixture-never-print'
        with self.assertRaises(ValueError):self.settings()

    def test_sender_process_imports_no_sdk_or_access_binding(self):
        code="import sys;sys.path.insert(0,sys.argv[1]);import emisor_operativo;assert not any(n in sys.modules for n in ('sdk_operativo','captura_rt','pyodbc','adaptadores_cierre'))"
        child=subprocess.run([sys.executable,'-B','-c',code,str(ROOT)],capture_output=True,timeout=15)
        self.assertEqual(0,child.returncode,child.stderr.decode(errors='replace'))

    def test_http_sender_archives_after_ack_and_never_discards_on_archive_fault(self):
        sender=Mock();sender.once.return_value='acked';archive=Mock();archive.archive_one.side_effect=[False,True]
        value=ArchivingSender(sender,object(),archive)
        self.assertEqual('acked',value.once());self.assertEqual(2,archive.archive_one.call_count)
        archive.archive_one.side_effect=OSError('fixture full')
        with self.assertRaises(OSError):value.once()
        self.assertEqual(1,sender.once.call_count)


if __name__=='__main__':unittest.main()
