"""Consulta readonly de fixtures; no C3/red ni originales instalados."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
import uuid
import zlib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import revisar_boton_produccion as probe


class ReadonlyButtonTests(unittest.TestCase):
    def setUp(self):
        base = ROOT/'datos'/'pruebas_produccion'
        base.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=base)
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)/'originals.sqlite'
        self.db = sqlite3.connect(self.path)
        self.addCleanup(self.db.close)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA wal_autocheckpoint=0')
        self.db.execute('PRAGMA application_id='+str(probe.APP_ID))
        self.db.execute('CREATE TABLE identity(agent_id,serial)')
        self.db.execute('INSERT INTO identity VALUES (?,?)', probe.IDENTITY)
        self.db.execute('CREATE TABLE originals(id TEXT PRIMARY KEY,buffer_z BLOB,metadata BLOB)')
        self.db.commit()
        self.now = datetime(2026,10,30,22,0,0,tzinfo=timezone.utc)

    def put(self, line, *, ago=3, damaged=False):
        key = str(uuid.uuid4())
        raw = line.encode('utf-8')
        buffer = (raw+b'\0').ljust(65536,b'\0')
        meta = {'response_id':key,'sdk_return_code':0,
            'started_utc':(self.now-timedelta(seconds=ago+.1)).isoformat(),
            'ended_utc':(self.now-timedelta(seconds=ago)).isoformat(),
            'buffer_bytes':len(buffer),'terminated':True,
            'buffer_sha256':hashlib.sha256(buffer).hexdigest(),
            'payload_sha256':hashlib.sha256(raw).hexdigest()}
        if damaged: meta['payload_sha256']='0'*64
        self.db.execute('INSERT INTO originals VALUES (?,?,?)',(key,zlib.compress(buffer),json.dumps(meta)))
        self.db.commit()
        return key

    def test_live_wal_sees_button_without_card_and_masks_tag_and_pin(self):
        key=self.put('2026-10-30 15:59:57,0,0,1,201,0,0\n2026-10-30 15:59:58,88331,99000666,1,0,0,4')
        paths=[self.path,Path(str(self.path)+'-wal')]
        before={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
        value=probe.inspect(self.path,now=self.now)
        self.assertEqual(1,value['events_without_card'])
        self.assertEqual(['201','0'],[e['event_code_raw'] for e in value['events']])
        self.assertEqual(key,value['events'][0]['response_id'])
        self.assertNotIn('99000666',json.dumps(value))
        self.assertNotIn('88331',json.dumps(value))
        self.assertEqual(before,{p:hashlib.sha256(p.read_bytes()).hexdigest() for p in paths})

    def test_window_uses_capture_clock_not_stale_controller_clock(self):
        self.put('2020-01-01 00:00:00,0,0,2,202,1,0',ago=2)
        self.put('2026-10-30 15:59:59,0,0,1,203,0,0',ago=400)
        value=probe.inspect(self.path,now=self.now)
        self.assertEqual(['202'],[e['event_code_raw'] for e in value['events']])

    def test_status_only_does_not_become_button_or_tag(self):
        self.put('2026-10-30 15:59:59,0,0,0,255,0,0')
        value=probe.inspect(self.path,now=self.now)
        self.assertEqual(1,value['status255_rows']);self.assertEqual([],value['events'])

    def test_changed_original_is_rejected(self):
        self.put('2026-10-30 15:59:59,0,0,1,201,0,0',damaged=True)
        with self.assertRaises(ValueError): probe.inspect(self.path,now=self.now)

    def test_unknown_shape_is_visible_without_printing_raw_identifiers(self):
        self.put('private_fixture,unrecognized,99000999')
        value=probe.inspect(self.path,now=self.now)
        self.assertEqual(1,value['unparsed_rows'])
        self.assertNotIn('99000999',json.dumps(value))
        self.assertEqual('unknown_fields',value['events'][0]['parse'])

    def test_truncated_window_is_reported(self):
        for i in range(4): self.put('2026-10-30 15:59:59,0,0,0,255,0,0',ago=10-i)
        value=probe.inspect(self.path,now=self.now,limit=2)
        self.assertTrue(value['scan_truncated_in_window'])

    def test_foreign_identity_and_missing_database_are_not_adopted(self):
        self.db.execute('UPDATE identity SET agent_id=?',('other',));self.db.commit()
        with self.assertRaises(ValueError): probe.inspect(self.path,now=self.now)
        missing=self.path.with_name('missing.sqlite')
        with self.assertRaises(FileNotFoundError): probe.inspect(missing,now=self.now)
        self.assertFalse(missing.exists())


if __name__=='__main__': unittest.main(verbosity=2)
