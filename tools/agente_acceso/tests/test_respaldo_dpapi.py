"""DPAPI nativa del usuario local, solo perfiles ficticios; sin SDK ni red."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import respaldo_protegido as protected
import test_respaldo_protegido as fixtures


@unittest.skipUnless(os.name=='nt','DPAPI requiere Windows.')
class NativeDPAPITests(unittest.TestCase):
    def setUp(self):
        self.root=ROOT/'datos'/'pruebas_respaldo_dpapi';self.root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=self.root);self.folder=Path(self.temp.name)
        self.store=protected.Store(self.folder/'protected')

    def tearDown(self):
        if not self.folder.resolve().is_relative_to(self.root.resolve()): raise RuntimeError('Temporal ajeno.')
        self.temp.cleanup()

    def test_native_cipher_is_nondeterministic_and_roundtrips(self):
        raw=b'private_fixture_DPAPI_only'
        first=protected.dpapi(raw);second=protected.dpapi(raw)
        self.assertNotEqual(first,second);self.assertNotIn(raw,first)
        self.assertEqual(raw,protected.dpapi(first,decrypt=True))

    def test_native_snapshot_reopens_in_new_process_of_same_user(self):
        meta=self.store.seal(fixtures.plan(),fixtures.USER,fixtures.PERMITS)
        code=('import sys; import respaldo_protegido as p; '
              'v=p.Store(sys.argv[1]).open(sys.argv[2]); '
              'assert v["user"]["Password"]=="private_fixture"; print("reopened")')
        result=subprocess.run([sys.executable,'-B','-c',code,str(self.store.root),meta['snapshot_id']],
            cwd=ROOT,capture_output=True,text=True,timeout=20)
        self.assertEqual(0,result.returncode,'DPAPI no confirmado en proceso separado.')
        self.assertEqual('reopened',result.stdout.strip())
        for path in self.store.root.rglob('*'):
            if path.is_file(): self.assertNotIn(b'private_fixture',path.read_bytes())

    def test_native_cipher_corruption_is_rejected_even_with_new_public_hash(self):
        meta=self.store.seal(fixtures.plan(),fixtures.USER,fixtures.PERMITS)
        folder=self.store.root/meta['snapshot_id'];cipher=folder/'snapshot.dpapi'
        raw=bytearray(cipher.read_bytes());raw[len(raw)//2]^=1;cipher.write_bytes(raw)
        (folder/'manifest.json').write_text(json.dumps(meta|{'cipher_sha256':hashlib.sha256(raw).hexdigest()}))
        with self.assertRaises(protected.ProtectedBackupError): self.store.open(meta['snapshot_id'])


if __name__=='__main__': unittest.main()
