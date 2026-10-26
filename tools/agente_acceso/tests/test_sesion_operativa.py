"""Propiedad de sesion con DPAPI/locks/procesos Windows de prueba; nunca SDK."""
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
import sesion_operativa as session


class SessionTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_sesion';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base);self.folder=Path(self.temp.name)
        (self.folder/'sync.lock').write_bytes(b'0')
        (self.folder/'sincronizar_vigencias.py').write_text('# fixture entry')
        (self.folder/'servicio-config.json').write_text('{}')
        self.startup=Mock()

    def tearDown(self): self.temp.cleanup()

    def owner(self): return session.Owner(self.folder,startup_guard=self.startup)

    def request(self,owner,role='vigencias'):
        folder=session.closures.new_session(owner.data/'cierres',str(uuid.uuid4()),role)
        digest=hashlib.sha256(b'fixture operation').hexdigest()
        owner.grant(folder,digest)
        return folder,digest

    def check(self,folder,digest,**kwargs):
        return session.checked_worker(folder,digest,root=self.folder,**kwargs)

    def test_native_identity_has_birth_and_image_and_rejects_dead_child(self):
        current=session.native_identity(os.getpid())
        self.assertEqual(os.getpid(),current['pid']);self.assertGreater(int(current['birth_ticks']),0)
        child=subprocess.Popen([sys.executable,'-c','pass'],creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        child.wait(timeout=10)
        with self.assertRaises(session.OwnershipError): session.native_identity(child.pid)

    def test_lock_is_exclusive_and_child_guard_requires_it(self):
        with self.owner() as owner:
            folder,digest=self.request(owner)
            actual=self.check(folder,digest)
            self.assertEqual(owner.record,actual)
            with self.assertRaises(OSError):
                with session.sync_lock(self.folder/'sync.lock'): pass
        with self.assertRaises(session.OwnershipError): self.check(folder,digest)

    def test_owner_files_and_per_worker_grant_are_encrypted_and_closed_marker_is_durable(self):
        with self.owner() as owner:
            folder,digest=self.request(owner)
            self.assertNotIn(owner.record['nonce'].encode(),(owner.folder/'owner.dpapi').read_bytes())
            self.assertNotIn(owner.cap_hash.encode(),(folder/'owner_grant.dpapi').read_bytes())
        self.assertEqual('closed',session.read(owner.folder/'owner.json')['phase'])
        self.assertFalse(owner.active)

    def test_pid_reuse_with_different_native_birth_is_rejected(self):
        with self.owner() as owner:
            folder,digest=self.request(owner)
            changed=dict(owner.record['native'],birth_ticks='1')
            with self.assertRaises(session.OwnershipError):
                self.check(folder,digest,identity=lambda _:changed)

    def test_source_change_or_foreign_operation_rejected_before_any_sdk(self):
        with self.owner() as owner:
            folder,digest=self.request(owner)
            with self.assertRaises(session.OwnershipError): self.check(folder,'0'*64)
            (self.folder/'sincronizar_vigencias.py').write_text('# modified fixture')
            with self.assertRaises(session.OwnershipError): self.check(folder,digest)
            with self.assertRaises(session.OwnershipError): owner.guard()

    def test_closed_worker_or_foreign_directory_cannot_reuse_grant(self):
        with self.owner() as owner:
            folder,digest=self.request(owner)
            (folder/'closed.json').write_text('{}')
            with self.assertRaises(session.OwnershipError): self.check(folder,digest)
            with self.assertRaises(session.OwnershipError): owner.grant(self.folder/'foreign','0'*64)

    def test_expired_or_future_connection_grant_is_not_date_authorization(self):
        with self.owner() as owner:
            folder,digest=self.request(owner)
            now=dt.datetime.now(dt.timezone.utc)
            for offset in (-5,181):
                with self.assertRaises(session.OwnershipError):
                    self.check(folder,digest,utc=lambda:(now+dt.timedelta(seconds=offset)).isoformat())
            self.assertEqual('sdk_owner',self.check(folder,digest)['purpose'])
            self.assertNotIn('api_end',self.check(folder,digest))

    def test_missing_held_lock_is_rejected_even_when_parent_is_alive(self):
        with self.owner() as owner:
            folder,digest=self.request(owner)
            # Probar el verificador con un lock separado que esta libre.
            free=self.folder/'free.lock';free.write_bytes(b'0')
            with self.assertRaises(session.OwnershipError):
                self.check(folder,digest,locked=lambda _:session.require_locked(free))

    def test_startup_guard_failure_never_creates_session_or_takes_over_lock(self):
        self.startup.side_effect=RuntimeError('fixture maintenance')
        with self.assertRaises(RuntimeError):
            with self.owner(): pass
        self.assertFalse((self.folder/'acceso-datos').exists())
        with session.sync_lock(self.folder/'sync.lock'): pass

    def test_maintenance_request_does_not_invalidate_an_inflight_date_transaction(self):
        with self.owner() as owner:
            self.startup.side_effect=RuntimeError('fixture task disabled during maintenance')
            owner.guard()  # Solo comprobar identidad/exclusion; el coordinador para entre planes.
            folder,digest=self.request(owner)
            self.assertEqual(owner.run_id,self.check(folder,digest)['run_id'])


if __name__=='__main__': unittest.main()
