"""Configuracion privada con token ficticio y HTTPS simulado; nunca C3 o red."""
from datetime import datetime,timezone,timedelta
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock,patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import produccion_config as config
import produccion_dell as cli

TOKEN='sica_'+'f'*64
INPUT='agent_id: '+config.AGENT+'\nCredencial mostrada una sola vez.\ntoken: '+TOKEN+'\n'


class ProductionProvisionTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_produccion';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base)
        self.secret=Path(self.temp.name)/'privado'/'secret.dpapi'
        self.target=patch.object(cli,'SECRET',self.secret);self.target.start()
    def tearDown(self): self.target.stop();self.temp.cleanup()

    def configure(self,status=422):
        transport=Mock();transport.send.return_value=(status,None,None)
        with patch.object(cli,'HttpTransport',return_value=transport): result=cli.configure(INPUT)
        return result,transport

    def test_native_dpapi_and_private_acl_with_fake_token_then_idempotent_reconfigure(self):
        result,transport=self.configure()
        self.assertEqual('production_credential_and_https_verified',result['status'])
        transport.send.assert_called_once_with('estado',b'{}')
        self.assertNotIn(TOKEN.encode(),self.secret.read_bytes())
        original=self.secret.read_bytes()
        self.assertEqual(422,cli.https_proof()['http_status'])
        self.configure();self.assertEqual(original,self.secret.read_bytes())

    def test_unauthorized_probe_never_authorizes_installation(self):
        with self.assertRaises(PermissionError): self.configure(401)
        with self.assertRaises((PermissionError,ValueError)): cli.https_proof()
        self.assertTrue(self.secret.exists())  # Evidencia preservada; no reetiquetada como exito.

    def test_failed_new_probe_invalidates_an_earlier_success(self):
        self.configure()
        with self.assertRaises(PermissionError): self.configure(503)
        with self.assertRaises((PermissionError,ValueError)): cli.https_proof()

    def test_modified_encrypted_credential_invalidates_proof(self):
        self.configure();self.secret.write_bytes(b'fixture_changed_cipher')
        with self.assertRaises(PermissionError): cli.https_proof()

    def test_old_proof_is_not_reused_as_fresh_authentication(self):
        self.configure();p=self.secret.parent/'https.json';value=json.loads(p.read_bytes())
        value['checked_utc']=(datetime.now(timezone.utc)-timedelta(hours=2)).isoformat();p.write_text(json.dumps(value))
        with self.assertRaises(PermissionError): cli.https_proof()

    def test_laboratory_identity_or_duplicate_tokens_are_rejected_before_storage(self):
        for raw in (INPUT.replace(config.AGENT,'c8d7ccdc-991f-497c-8383-92fb52921f8a'),INPUT+'token: '+TOKEN+'\n'):
            with self.assertRaises(ValueError): cli.configure(raw)
            self.assertFalse(self.secret.parent.exists())


if __name__=='__main__': unittest.main(verbosity=2)
