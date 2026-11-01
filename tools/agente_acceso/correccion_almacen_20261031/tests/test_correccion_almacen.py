"""Regresion de cadencia Dell y actualizacion sobre copias; nunca hardware o tareas."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import actualizar_almacen as app
import produccion_config as config
from latencia_politicas import ReaderObservation

STATUS = b'2026-10-30 19:55:00,0,0,0,255,0,0\r\n'
EVENT = b'2026-10-30 19:55:00,123,99000177,1,0,0,4\r\n'


class UpdateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        original = Path(os.environ['SI_STORAGE_BASE_ZIP'])
        if hashlib.sha256(original.read_bytes()).hexdigest() != app.BASE_ZIP_SHA:
            raise ValueError('ZIP de fixture original distinto.')
        with zipfile.ZipFile(original) as archive:
            cls.before_sources = {name: archive.read(name) for name in archive.namelist()}
        cls.area = ROOT / 'datos' / 'pruebas_correccion_almacen'
        cls.area.mkdir(parents=True, exist_ok=True)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=self.area)
        self.base = Path(self.temp.name).resolve()
        self.root = self.base / 'ZKSync'
        self.root.mkdir()
        (self.root / 'sync.lock').write_bytes(b'0')
        old = self.root / 'integrado' / app.OLD
        for name, raw in self.before_sources.items():
            path = old / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
        library = app.production.installer().library
        (self.root / library.ENTRY).write_bytes(library.WRAPPER)
        (self.root / 'vigilar_sync.py').write_bytes(library.MONITOR)
        settings = {'protocol': 1, 'enabled': True, 'agent_id': config.AGENT, 'serial': config.SERIAL,
            'url': config.URL, 'archive_acknowledged': True, 'release_sha256': app.OLD, 'dates_engine': config.ENGINE}
        raw = app.encoded(settings)
        (self.root / 'servicio-config.json').write_bytes(raw)
        activation = {'protocol': 1, 'purpose': 'production_r2_reference', 'agent_id': config.AGENT,
            'serial': config.SERIAL, 'release_sha256': app.OLD, 'config_sha256': app.sha(raw),
            'dates_engine': config.ENGINE, 'reference_sources': config.reference.EXPECTED,
            'authorized_utc': '2026-01-01T00:00:00+00:00'}
        (self.root / 'activacion-integrada.json').write_bytes(app.encoded(activation))
        (self.root / 'enlace-integrado.json').write_bytes(app.encoded({'protocol': 1,
            'installation_id': '43c51f89-9576-4dd2-9445-d48db8b7b92c', 'mode': 'integrado', 'release_sha256': app.OLD}))
        (self.root / 'acceso-datos').mkdir()
        self.data = {'originals.sqlite': b'fixture_originals_keep', 'credencial-ingesta.dpapi': b'fixture_dpapi_keep',
            'outbox.sqlite': b'fixture_queue_keep', 'tareas.xml': b'fixture_task_keep'}
        for name, value in self.data.items():
            (self.root / 'acceso-datos' / name).write_bytes(value)
        self.guard = Mock()
        self.helper = app.Update(self.root, ROOT, guard=self.guard, private=lambda p: p.mkdir(parents=True))
        self.before = self.helper.bindings()

    def tearDown(self):
        self.assertTrue(self.base.is_relative_to(self.area.resolve()))
        self.temp.cleanup()

    def check_data(self):
        for name, raw in self.data.items():
            self.assertEqual(raw, (self.root / 'acceso-datos' / name).read_bytes())

    def apply(self):
        with app.ownership.sync_lock(self.root / 'sync.lock'):
            return self.helper.apply(app.digest(self.helper.plan()))

    def test_plan_is_readonly_and_exactly_scoped(self):
        before = {str(p.relative_to(self.root)): app.sha(p.read_bytes()) for p in self.root.rglob('*') if p.is_file()}
        plan = self.helper.plan()
        after = {str(p.relative_to(self.root)): app.sha(p.read_bytes()) for p in self.root.rglob('*') if p.is_file()}
        self.assertEqual(before, after)
        self.assertEqual('windows_scandir', plan['scan_policy'])
        self.assertFalse(plan['cross_call_size_cache'])
        self.assertEqual(self.before_sources['latencia_politicas.py'].replace(b'max_gap=1.5', b'max_gap=3.0'),
            (ROOT / 'latencia_politicas.py').read_bytes())

    def test_update_and_rollback_preserve_every_original_data_byte(self):
        result = self.apply()
        self.assertEqual('storage_update_installed_waiting_resume', result['status'])
        self.assertNotEqual(app.OLD, config.load(self.root).release_sha256)
        config.activation(self.root, config.load(self.root))
        self.assertFalse((self.root / 'revision_instalacion.json').exists())
        self.check_data()
        key = result['update_id']
        plan = self.helper.rollback_plan(key)
        with app.ownership.sync_lock(self.root / 'sync.lock'):
            returned = self.helper.rollback(key, app.digest(plan))
        self.assertTrue(returned['preserve_all_data'])
        self.assertEqual(self.before, self.helper.bindings())
        self.check_data()

    def test_missing_lock_and_wrong_approval_refuse_before_copying_code(self):
        plan = self.helper.plan()
        with self.assertRaises(app.ownership.OwnershipError):
            self.helper.apply(app.digest(plan))
        with app.ownership.sync_lock(self.root / 'sync.lock'):
            with self.assertRaises(PermissionError):
                self.helper.apply('0' * 64)
        self.assertEqual(self.before, self.helper.bindings())
        self.assertFalse((self.root / 'revision_instalacion.json').exists())

    def test_failed_maintenance_and_existing_review_marker_block_changes(self):
        self.guard.side_effect = PermissionError('fixture_unconfirmed_closure')
        with self.assertRaises(PermissionError):
            self.helper.plan()
        self.guard.side_effect = None
        (self.root / 'revision_instalacion.json').write_text('{}')
        with self.assertRaises(PermissionError):
            self.helper.plan()
        self.assertEqual(self.before, self.helper.bindings())

    def test_partial_config_write_keeps_blocking_marker_and_has_exact_rollback(self):
        original = app.replace
        count = 0
        def interrupted(path, raw):
            nonlocal count
            count += 1
            if count == 2:
                raise OSError('fixture_interruption')
            return original(path, raw)
        with app.ownership.sync_lock(self.root / 'sync.lock'):
            approved = app.digest(self.helper.plan())
            with patch.object(app, 'replace', side_effect=interrupted):
                with self.assertRaises(OSError):
                    self.helper.apply(approved)
        marker = app.read(self.root / 'revision_instalacion.json')
        key = marker['update_id']
        with self.assertRaises(PermissionError):
            self.helper.plan()
        plan = self.helper.rollback_plan(key)
        with app.ownership.sync_lock(self.root / 'sync.lock'):
            self.helper.rollback(key, app.digest(plan))
        self.assertEqual(self.before, self.helper.bindings())
        self.assertFalse((self.root / 'revision_instalacion.json').exists())
        self.check_data()

    def test_copy_failure_before_binding_changes_is_recoverable_without_fake_receipt(self):
        def private(path):
            if path.parent.name == 'integrado':
                raise OSError('fixture_copy_failure')
            path.mkdir(parents=True)
        self.helper.private = private
        with app.ownership.sync_lock(self.root / 'sync.lock'):
            approved = app.digest(self.helper.plan())
            with self.assertRaises(OSError):
                self.helper.apply(approved)
        key = app.read(self.root / 'revision_instalacion.json')['update_id']
        plan = self.helper.rollback_plan(key)
        with app.ownership.sync_lock(self.root / 'sync.lock'):
            self.helper.rollback(key, app.digest(plan))
        self.assertEqual(self.before, self.helper.bindings())

    def test_partial_failure_never_overwrites_a_later_unrelated_change(self):
        with app.ownership.sync_lock(self.root / 'sync.lock'):
            approved = app.digest(self.helper.plan())
            with patch.object(app, 'replace', side_effect=OSError('fixture_interrupt')):
                with self.assertRaises(OSError):
                    self.helper.apply(approved)
        key = app.read(self.root / 'revision_instalacion.json')['update_id']
        (self.root / 'enlace-integrado.json').write_bytes(b'fixture_unrelated_change')
        with self.assertRaises(PermissionError):
            self.helper.rollback_plan(key)
        self.assertTrue((self.root / 'revision_instalacion.json').exists())

    def test_interrupted_rollback_keeps_marker_and_requires_a_new_plan_for_retry(self):
        result = self.apply()
        key = result['update_id']
        approved = app.digest(self.helper.rollback_plan(key))
        original = app.replace
        count = 0
        def interrupted(path, raw):
            nonlocal count
            count += 1
            if count == 2:
                raise OSError('fixture_rollback_interruption')
            return original(path, raw)
        with app.ownership.sync_lock(self.root / 'sync.lock'):
            with patch.object(app, 'replace', side_effect=interrupted):
                with self.assertRaises(OSError):
                    self.helper.rollback(key, approved)
        self.assertTrue((self.root / 'revision_instalacion.json').exists())
        next_plan = self.helper.rollback_plan(key)
        self.assertNotEqual(approved, app.digest(next_plan))
        with app.ownership.sync_lock(self.root / 'sync.lock'):
            with self.assertRaises(PermissionError):
                self.helper.rollback(key, approved)
            self.helper.rollback(key, app.digest(next_plan))
        self.assertEqual(self.before, self.helper.bindings())
        self.assertFalse((self.root / 'revision_instalacion.json').exists())
        self.check_data()

    def test_changed_source_even_with_a_coherent_manifest_is_rejected(self):
        payload = self.base / 'payload'
        source_manifest = app.read(ROOT / 'OPERATIVA_SHA256SUMS.json')
        for row in source_manifest['files']:
            dest = payload / row['name']
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / row['name'], dest)
        changed = 'referencia_r2/c3_worker.py'
        (payload / changed).write_bytes(b'# fixture unauthorized SDK change\n')
        for row in source_manifest['files']:
            if row['name'] == changed:
                row['sha256'] = app.sha((payload / changed).read_bytes())
        (payload / 'OPERATIVA_SHA256SUMS.json').write_bytes(app.encoded(source_manifest))
        helper = app.Update(self.root, payload, guard=self.guard, private=Mock())
        with self.assertRaises(ValueError):
            helper.plan()
        self.assertEqual(self.before, self.helper.bindings())

    def test_plan_drift_and_tampered_backup_refuse_update_or_rollback(self):
        plan = self.helper.plan()
        link = app.read(self.root / 'enlace-integrado.json')
        link['installation_id'] = '00000000-0000-4000-8000-000000000001'
        (self.root / 'enlace-integrado.json').write_bytes(app.encoded(link))
        with app.ownership.sync_lock(self.root / 'sync.lock'):
            with self.assertRaises(PermissionError):
                self.helper.apply(app.digest(plan))
        for name, raw in self.before.items():
            (self.root / name).write_bytes(raw)
        result = self.apply()
        backup = self.root / 'actualizaciones_almacen' / result['update_id']
        (backup / 'servicio-config.json').write_bytes(b'fixture_tampered_backup')
        with self.assertRaises(ValueError):
            self.helper.rollback_plan(result['update_id'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
