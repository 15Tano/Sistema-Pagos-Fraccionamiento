"""Instalacion/reversion sobre directorios ficticios con lock Windows real."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock,patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import instalacion_operativa as install
import sesion_operativa as session


class InstallationTests(unittest.TestCase):
    def setUp(self):
        root=ROOT/'datos'/'pruebas_instalacion';root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=root);self.folder=Path(self.temp.name)
        self.sync=self.folder/'ZKSync';self.sync.mkdir();(self.sync/'sync.lock').write_bytes(b'0')
        for name,digest in install.ROOT_FILES.items():
            source=ROOT/('referencia_r2' if name in install.reference.EXPECTED else 'referencia_operacion')/name
            raw=source.read_bytes();self.assertEqual(digest,hashlib.sha256(raw).hexdigest())
            (self.sync/name).write_bytes(raw)
        self.sensitive={'access-password.dpapi':b'private_fixture_cipher',
            'acceso-datos/outbox.sqlite':b'fixture_existing_queue','Database_PRO.mdb':b'fixture_do_not_touch'}
        for name,raw in self.sensitive.items():
            path=self.sync/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
        self.payload=self.folder/'payload';self.payload.mkdir()
        self.gestor=self.folder/'GestionTags';self.gestor.mkdir()
        for name in install.GESTOR_FILES:
            (self.gestor/name).write_bytes((ROOT/'referencia_operacion'/name).read_bytes())
        files=[]
        for name in ('runner_operativo.py','sesion_operativa.py','almacen_operativo.py','config_operativa.py','vigilancia_operativa.py'):
            raw=('# fixture source '+name).encode();(self.payload/name).write_bytes(raw)
            files.append({'name':name,'sha256':hashlib.sha256(raw).hexdigest()})
        for name in install.GESTOR_CANDIDATE:
            raw=(ROOT/'gestor_candidato'/name).read_bytes();path=self.payload/'gestor_candidato'/name
            path.parent.mkdir(exist_ok=True);path.write_bytes(raw)
            files.append({'name':'gestor_candidato/'+name,'sha256':hashlib.sha256(raw).hexdigest()})
        (self.payload/'OPERATIVA_SHA256SUMS.json').write_text(json.dumps({'files':files}))
        self.xml={name:'<Task fixture="'+name+'" />' for name in ('SanIsidro-Vigencias','SanIsidro-Vigilancia')}
        self.guard=Mock();self.plan=install.prepare(self.sync,self.payload,self.xml,guard=self.guard)

    def tearDown(self): self.temp.cleanup()

    def consent(self,plan=None):
        plan=plan or self.plan
        return install.Consent(plan,confirmed=True,approved_sha256=install.digest(plan))

    def stage(self,plan=None,consent=None):
        with session.sync_lock(self.sync/'sync.lock'):
            return install.stage(plan or self.plan,self.payload,self.xml,consent or self.consent(plan),
                guard=self.guard,private=lambda folder:folder.mkdir(parents=True))

    def test_plan_is_readonly_and_does_not_copy_credential_queue_or_mdb(self):
        self.assertFalse(self.plan['changes_tasks']);self.assertFalse(self.plan['changes_credentials'])
        self.assertFalse(self.plan['changes_mdb']);self.assertFalse(self.plan['changes_existing_outbox'])
        self.assertEqual('r2',self.plan['initial_mode']);self.assertFalse((self.sync/'instalaciones').exists())

    def test_staging_preserves_six_r2_sources_xml_and_data_and_defaults_to_r2(self):
        result=self.stage();key=result['installation_id']
        self.assertEqual('staged_r2_preserved',result['status'])
        self.assertEqual('r2',install.read(self.sync/'enlace-integrado.json')['mode'])
        for name,digest in install.ROOT_FILES.items():
            self.assertEqual(digest,install.sha(self.sync/'instalaciones'/key/'r2'/name))
            if name not in (install.ENTRY,'vigilar_sync.py'):self.assertEqual(digest,install.sha(self.sync/name))
        for name,raw in self.sensitive.items(): self.assertEqual(raw,(self.sync/name).read_bytes())
        for name,xml in self.xml.items(): self.assertEqual(xml,(self.sync/'instalaciones'/key/'tareas'/(name+'.xml')).read_text())
        self.assertFalse((self.sync/'revision_instalacion.json').exists())
        for name,expected in self.plan['gestor_after'].items():self.assertEqual(expected,install.sha(self.gestor/name))

    def test_staged_wrapper_runs_original_help_without_sdk_or_credential_access(self):
        self.stage()
        child=subprocess.run([sys.executable,'-B',str(self.sync/install.ENTRY),'--help'],capture_output=True,timeout=10)
        self.assertEqual(0,child.returncode,child.stderr.decode(errors='replace'))
        self.assertIn(b'--aplicar',child.stdout);self.assertIn(b'--continuo',child.stdout)
        self.assertFalse((self.sync/'registros').exists())

    def test_stage_requires_exact_consent_and_held_lock(self):
        with self.assertRaises(PermissionError): install.Consent(self.plan)
        with self.assertRaises(session.OwnershipError):
            install.stage(self.plan,self.payload,self.xml,self.consent(),guard=self.guard,private=lambda p:p.mkdir(parents=True))
        self.assertEqual(install.ROOT_FILES[install.ENTRY],install.sha(self.sync/install.ENTRY))
        for name,expected in install.GESTOR_FILES.items():self.assertEqual(expected,install.sha(self.gestor/name))
        self.assertEqual(install.ROOT_FILES['vigilar_sync.py'],install.sha(self.sync/'vigilar_sync.py'))

    def test_drift_between_plan_and_stage_prevents_any_replacement(self):
        (self.sync/'c3_worker.py').write_text('# fixture changed')
        with self.assertRaises(ValueError): self.stage()
        self.assertFalse((self.sync/'instalaciones').exists())

    def test_cannot_substitute_expected_r2_hashes_in_external_plan(self):
        changed=copy.deepcopy(self.plan);changed['before'][install.ENTRY]='0'*64
        with self.assertRaises(PermissionError): self.stage(changed)
        self.assertFalse((self.sync/'instalaciones').exists())

    def test_payload_tampering_is_detected_before_installed_entry_changes(self):
        (self.payload/'runner_operativo.py').write_text('# other fixture')
        with self.assertRaises(ValueError): self.stage()
        self.assertEqual(install.ROOT_FILES[install.ENTRY],install.sha(self.sync/install.ENTRY))

    def test_partial_copy_leaves_review_marker_and_never_activates_integrated_mode(self):
        real=install.durable
        def fail(path,raw):
            if 'integrado' in Path(path).parts: raise OSError('fixture copy interrupted')
            return real(path,raw)
        with patch.object(install,'durable',side_effect=fail):
            with self.assertRaises(OSError): self.stage()
        self.assertTrue((self.sync/'revision_instalacion.json').exists())
        self.assertEqual(install.ROOT_FILES[install.ENTRY],install.sha(self.sync/install.ENTRY))
        with self.assertRaises(PermissionError): install.prepare(self.sync,self.payload,self.xml,guard=self.guard)

    def test_rollback_restores_exact_original_without_rewinding_any_data(self):
        result=self.stage();key=result['installation_id']
        plan=install.rollback_plan(self.sync,key,guard=self.guard)
        with session.sync_lock(self.sync/'sync.lock'):
            restored=install.rollback(plan,self.consent(plan),guard=self.guard)
        self.assertEqual('r2_restored',restored['status'])
        self.assertEqual(install.ROOT_FILES[install.ENTRY],install.sha(self.sync/install.ENTRY))
        for name,raw in self.sensitive.items(): self.assertEqual(raw,(self.sync/name).read_bytes())
        self.assertTrue((self.sync/'integrado'/self.plan['release_sha256']).is_dir())

    def test_changed_entry_or_backup_blocks_rollback(self):
        result=self.stage();key=result['installation_id']
        (self.sync/install.ENTRY).write_text('# third party edit fixture')
        with self.assertRaises(PermissionError): install.rollback_plan(self.sync,key,guard=self.guard)
        (self.sync/install.ENTRY).write_bytes(install.WRAPPER)
        (self.sync/'instalaciones'/key/'r2'/install.ENTRY).write_text('# bad backup fixture')
        with self.assertRaises(PermissionError): install.rollback_plan(self.sync,key,guard=self.guard)

    def test_manifest_cannot_escape_release_or_copy_dll(self):
        path=self.payload/'OPERATIVA_SHA256SUMS.json';original=json.loads(path.read_bytes())
        for name in ('../credential.py','sdk.dll','C:/private.py','a//b.py'):
            value=copy.deepcopy(original);value['files'].append({'name':name,'sha256':'0'*64})
            path.write_text(json.dumps(value))
            with self.assertRaises(ValueError): install.source_files(self.payload)

    def test_unknown_installed_manager_hash_refuses_patch(self):
        (self.gestor/'gt_backend.py').write_text('# unknown installed version')
        with self.assertRaises(ValueError):install.prepare(self.sync,self.payload,self.xml,guard=self.guard)
        self.assertFalse((self.sync/'instalaciones').exists())


if __name__=='__main__': unittest.main()
