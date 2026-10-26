"""Compresion, ACK y cortes de archivo con SQLite real y transporte ficticio."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
import uuid
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import almacen_operativo as storage
import test_agente as fixture


class StorageTests(unittest.TestCase):
    def setUp(self):
        root=ROOT/'datos'/'pruebas_almacen_operativo';root.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=root);self.folder=Path(self.temp.name)
        self.raw=storage.Originals(self.folder/'originals.sqlite',fixture.AGENT,fixture.SERIAL)
        self.box=storage.HotOutbox(self.folder/'outbox.sqlite',fixture.AGENT,fixture.SERIAL)
        self.archives=storage.Archives(self.folder/'ack',self.raw)

    def tearDown(self):
        self.raw.close();self.box.close();self.temp.cleanup()

    def capture(self,raw=fixture.RAW,code=1,*,response_id=None):
        buffer=(raw+b'\0').ljust(65536,b'\0')
        key=self.raw.put(buffer,code,fixture.START,fixture.END,response_id=response_id)
        storage.capture(self.box,self.raw.receipt(key))
        return key,buffer

    def ack(self):
        self.box.build_batch()
        return fixture.Sender(self.box,fixture.FakeTransport()).once()

    def test_full_64k_buffer_round_trip_and_binary_errors_are_preserved(self):
        for payload,code in ((fixture.RAW,1),(b'\xff\xfeerror',-2),(b'',0)):
            key,buffer=self.capture(payload,code)
            receipt=self.raw.receipt(key)
            self.assertEqual(buffer,receipt['buffer']);self.assertEqual(payload,receipt['raw'])
            self.assertEqual(code,receipt['sdk_return_code'])
        self.assertLess(self.raw.db.execute('SELECT SUM(length(buffer_z)) FROM originals').fetchone()[0],1000)

    def test_incompressible_and_unterminated_buffer_is_preserved_without_bomb_expansion(self):
        import os
        buffer=os.urandom(65536).replace(b'\0',b'1')
        key=self.raw.put(buffer,-2,fixture.START,fixture.END)
        value=self.raw.receipt(key)
        self.assertFalse(value['terminated']);self.assertEqual(buffer,value['raw'])
        with self.assertRaises(ValueError): storage.expand(storage.zlib.compress(b'x'*65537),65536)

    def test_uuid_is_idempotent_and_cannot_change_original(self):
        key,buffer=self.capture()
        self.assertEqual(key,self.raw.put(buffer,1,fixture.START,fixture.END,response_id=key))
        with self.assertRaises(ValueError): self.raw.put(b'changed\0',1,fixture.START,fixture.END,response_id=key)

    def test_reopening_has_exact_same_originals_and_recovery_is_idempotent(self):
        key,buffer=self.capture()
        self.raw.close();self.raw=storage.Originals(self.folder/'originals.sqlite')
        self.archives=storage.Archives(self.folder/'ack',self.raw)
        self.assertEqual(buffer,self.raw.receipt(key)['buffer'])
        self.assertEqual(1,self.raw.recover(self.box,self.archives))
        self.assertEqual(1,self.raw.recover(self.box,self.archives))
        self.assertEqual(1,self.box.health()['responses'])

    def test_ack_archiving_preserves_every_byte_and_does_not_requeue_after_restart(self):
        keys=[self.capture()[0] for _ in range(3)]
        self.assertEqual('acked',self.ack())
        before=dict(self.box.db.execute('SELECT * FROM messages').fetchone())
        self.assertTrue(self.archives.archive_one(self.box))
        self.assertEqual(0,self.box.health()['responses'])
        data,message,_=self.archives.decode(self.archives.path(before['id']))
        self.assertEqual(before,message)
        self.assertEqual(keys,[row['id'] for row in data['responses']])
        self.assertEqual(0,self.raw.recover(self.box,self.archives))
        self.assertEqual(3,self.raw.db.execute('SELECT COUNT(*) FROM originals').fetchone()[0])
        self.assertFalse(self.archives.archive_one(self.box))

    def test_never_archives_pending_or_unbatched_messages(self):
        self.capture();self.assertFalse(self.archives.archive_one(self.box))
        self.box.build_batch();self.assertFalse(self.archives.archive_one(self.box))
        self.assertEqual(1,self.box.health()['responses']);self.assertEqual(1,self.box.health()['pending_count'])

    def test_sequence_checkpoints_prevent_reuse_after_hot_rows_are_archived(self):
        for n in range(3):
            self.capture();self.assertEqual('acked',self.ack())
            row=self.box.db.execute('SELECT sequence FROM messages').fetchone()
            self.assertEqual(n,row[0]);self.assertTrue(self.archives.archive_one(self.box))
        self.assertEqual(3,self.raw.db.execute('SELECT COUNT(*) FROM archives').fetchone()[0])
        self.box.close();self.box=storage.HotOutbox(self.folder/'outbox.sqlite')
        self.capture();self.box.build_batch()
        self.assertEqual(3,self.box.db.execute('SELECT sequence FROM messages').fetchone()[0])

    def test_state_sequence_is_separate_and_state_archive_needs_no_rt_rows(self):
        self.box.enqueue_state(fixture.snapshot())
        self.assertEqual('acked',fixture.Sender(self.box,fixture.FakeTransport()).once())
        self.assertTrue(self.archives.archive_one(self.box))
        self.box.enqueue_state(fixture.snapshot())
        self.assertEqual(1,self.box.db.execute('SELECT sequence FROM messages').fetchone()[0])
        self.capture();self.box.build_batch()
        self.assertEqual(0,self.box.db.execute("SELECT sequence FROM messages WHERE endpoint='lotes'").fetchone()[0])

    def test_cut_after_archive_mark_keeps_hot_copy_and_retry_is_identical(self):
        self.capture();self.ack()
        before=dict(self.box.db.execute('SELECT * FROM messages').fetchone())
        def cut(): raise OSError('fixture power loss after mark')
        with self.assertRaises(OSError): self.archives.archive_one(self.box,after_mark=cut)
        self.assertEqual(before,dict(self.box.db.execute('SELECT * FROM messages').fetchone()))
        file=self.archives.path(before['id']);raw=file.read_bytes()
        self.assertTrue(self.archives.archive_one(self.box));self.assertEqual(raw,file.read_bytes())
        self.assertEqual(0,self.raw.recover(self.box,self.archives))

    def test_corrupt_archive_or_invalid_ack_never_removes_hot_originals(self):
        self.capture();self.ack()
        row=dict(self.box.db.execute('SELECT * FROM messages').fetchone())
        self.archives.path(row['id']).parent.mkdir();self.archives.path(row['id']).write_bytes(b'corrupt')
        with self.assertRaises(Exception): self.archives.archive_one(self.box)
        self.assertEqual(1,self.box.health()['responses'])
        self.assertEqual('acked',self.box.db.execute('SELECT state FROM messages').fetchone()[0])

    def test_capacity_failure_leaves_ack_and_original_in_hot_outbox(self):
        self.capture();self.ack();self.archives.max_bytes=1
        with self.assertRaises(OSError): self.archives.archive_one(self.box)
        self.assertEqual(1,self.box.health()['responses'])
        self.assertEqual(0,self.raw.db.execute('SELECT COUNT(*) FROM archives').fetchone()[0])

    def test_missing_archive_after_hot_removal_blocks_recovery_without_consuming_sdk(self):
        self.capture();self.ack();self.archives.archive_one(self.box)
        path=next((self.folder/'ack').iterdir());path.unlink()  # Unicamente temporal de prueba.
        with self.assertRaises(Exception): self.raw.recover(self.box,self.archives)
        self.assertEqual(0,self.box.health()['responses'])

    def test_identity_cannot_be_relabelled_or_mixed_with_another_outbox(self):
        with self.assertRaises(ValueError): storage.Originals(self.folder/'originals.sqlite',fixture.AGENT,'OTHER')
        other=storage.HotOutbox(self.folder/'other.sqlite',str(uuid.uuid4()),'OTHER')
        try:
            with self.assertRaises(ValueError): self.archives.archive_one(other)
        finally: other.close()


if __name__=='__main__': unittest.main()
