"""Instalacion/activacion/reversion sobre copias ficticias, sin caseta ni tareas."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import produccion_config as config
from produccion_instalador import Installer,installation
import produccion_paquete as package
import sesion_operativa as session


class ProductionInstallationTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_produccion';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base);self.base=Path(self.temp.name)
        manifest=json.loads((ROOT/'OPERATIVA_SHA256SUMS.json').read_bytes())
        if manifest.get('release')==package.RELEASE:
            self.payload=ROOT
        else:
            from empaquetar_produccion import entries
            self.payload=self.base/'payload';self.payload.mkdir()
            for name,raw in entries().items():
                path=self.payload/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
        self.root=self.base/'ZKSync';self.root.mkdir();(self.root/'sync.lock').write_bytes(b'0')
        self.gestor=self.base/'GestionTags';self.gestor.mkdir()
        self.lib=installation()
        for name,digest in self.lib.ROOT_FILES.items():
            folder='referencia_r2' if name in self.lib.reference.EXPECTED else 'referencia_operacion'
            raw=(self.payload/folder/name).read_bytes()
            self.assertEqual(digest,hashlib.sha256(raw).hexdigest());(self.root/name).write_bytes(raw)
        for name,digest in self.lib.GESTOR_FILES.items():
            raw=(self.payload/'referencia_operacion'/name).read_bytes()
            self.assertEqual(digest,hashlib.sha256(raw).hexdigest());(self.gestor/name).write_bytes(raw)
        self.sensitive={'access-password.dpapi':b'fixture_old_credential','database_fixture.mdb':b'fixture_keep'}
        for name,raw in self.sensitive.items(): (self.root/name).write_bytes(raw)
        self.xml={n:'<Task fixture="'+n+'" />' for n in ('SanIsidro-Vigencias','SanIsidro-Vigilancia')}
        self.guard=Mock()
        self.helper=Installer(self.root,self.payload,guard=self.guard,private=lambda p:p.mkdir(parents=True))
        self.plan=self.helper.plan(self.xml)
        self.digest=self.helper.library.digest(self.plan)

    def tearDown(self): self.temp.cleanup()

    def stage(self): return self.helper.stage(self.plan,self.xml,approved_sha256=self.digest)

    def test_wrapper_is_isolated_without_changing_legacy_library(self):
        import instalacion_operativa as legacy
        self.assertIn(b'from runner_operativo import main',legacy.WRAPPER)
        self.assertIn(b'from runner_produccion import main',self.helper.library.WRAPPER)
        self.assertEqual('r2',self.plan['initial_mode'])

    def test_install_activation_and_exact_rollback_preserve_original_data_and_tasks(self):
        with session.sync_lock(self.root/'sync.lock'):
            result=self.stage()
            self.assertEqual('r2',json.loads((self.root/'enlace-integrado.json').read_bytes())['mode'])
            released=self.helper.activate(result['release_sha256'],approved_sha256=result['release_sha256'],credential_check=Mock())
            self.assertEqual('r2_reference_unchanged',released['dates_engine'])
            self.assertEqual('integrado',json.loads((self.root/'enlace-integrado.json').read_bytes())['mode'])
            config.activation(self.root,config.load(self.root))
            for name,raw in self.sensitive.items(): self.assertEqual(raw,(self.root/name).read_bytes())
            plan=self.helper.library.rollback_plan(self.root,result['installation_id'],guard=self.guard)
            restored=self.helper.rollback(approved_sha256=self.helper.library.digest(plan))
            self.assertEqual('r2_restored',restored['status'])
        for name,digest in self.lib.ROOT_FILES.items(): self.assertEqual(digest,self.lib.sha(self.root/name))
        for name,digest in self.lib.GESTOR_FILES.items(): self.assertEqual(digest,self.lib.sha(self.gestor/name))
        for name,raw in self.sensitive.items(): self.assertEqual(raw,(self.root/name).read_bytes())
        self.assertTrue((self.root/'servicio-config.json').exists())
        self.assertFalse((self.root/'revision_instalacion.json').exists())

    def test_modified_plan_does_not_touch_original_entry(self):
        with session.sync_lock(self.root/'sync.lock'):
            with self.assertRaises(PermissionError): self.helper.stage(self.plan,self.xml,approved_sha256='0'*64)
        self.assertEqual(self.lib.ROOT_FILES[self.lib.ENTRY],self.lib.sha(self.root/self.lib.ENTRY))

    def test_bad_credential_does_not_enable_integrated_mode(self):
        with session.sync_lock(self.root/'sync.lock'):
            result=self.stage()
            with self.assertRaises(PermissionError):
                self.helper.activate(result['release_sha256'],approved_sha256=result['release_sha256'],
                    credential_check=Mock(side_effect=PermissionError('fixture_DPAPI_failure')))
        self.assertEqual('r2',json.loads((self.root/'enlace-integrado.json').read_bytes())['mode'])
        self.assertFalse((self.root/'activacion-integrada.json').exists())

    def test_drift_between_plan_and_install_is_rejected_before_replacement(self):
        (self.root/'c3_worker.py').write_text('# fixture changed')
        with session.sync_lock(self.root/'sync.lock'):
            with self.assertRaises(ValueError): self.stage()
        self.assertEqual(self.lib.ROOT_FILES[self.lib.ENTRY],self.lib.sha(self.root/self.lib.ENTRY))


if __name__=='__main__': unittest.main(verbosity=2)
