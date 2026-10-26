"""Archivar recibos cerrados y recuperar retiradas interrumpidas; SDK ficticio."""
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import archivo_cierres as archive
import test_aplicador_integrado as fixture
import test_aplicacion_vigencias as f


class LedgerArchiveTests(unittest.TestCase):
    def setUp(self):
        self.h=fixture.IntegratedTests('runTest');self.h.setUp();self.addCleanup(self.h.tearDown)
        self.h.ledger=self.h.folder/'cierres'
        self.archive=archive.LedgerArchive(self.h.folder);self.addCleanup(self.archive.close)
        self.h.execute()

    def test_archive_requires_confirmed_disconnect_ack_and_verified_date_transaction(self):
        files={p.relative_to(self.h.ledger).as_posix():p.read_bytes() for p in self.h.ledger.rglob('*') if p.is_file()}
        self.assertTrue(self.archive.archive(self.h.gate,self.h.evidence,guard=self.h.guard))
        self.assertEqual([],list(self.h.ledger.iterdir()))
        row=self.archive.db.execute('SELECT * FROM snapshots').fetchone()
        value=self.archive.load(row['id'],row['sha256'])
        stored={worker+'/'+name:archive.base64.b64decode(raw) for worker,parts in value['workers'].items() for name,raw in parts.items()}
        self.assertEqual(files,stored);self.assertEqual(0,archive.core.check_operations(self.h.ledger))
        self.assertEqual('20261105',self.h.user['EndTime'])
        fixture.integrated.check_runs(self.h.evidence)

    def test_cut_during_hot_copy_removal_is_recoverable_without_new_sdk(self):
        def cut(): raise OSError('fixture power loss while pruning closed files')
        with self.assertRaises(OSError): self.archive.archive(self.h.gate,self.h.evidence,guard=self.h.guard,after_file=cut)
        # El primer directorio se retiro entero; otros trabajadores cerrados pueden seguir calientes.
        self.assertEqual(len(list(self.h.ledger.iterdir())),archive.core.check_operations(self.h.ledger))
        self.archive.recover()
        self.assertEqual(0,archive.core.check_operations(self.h.ledger))
        self.assertEqual(1,self.archive.db.execute('SELECT COUNT(*) FROM snapshots').fetchone()[0])

    def test_sdk_active_or_faulted_prevents_archiving_any_worker(self):
        self.h.gate.acquire('rt')
        with self.assertRaises(PermissionError): self.archive.archive(self.h.gate,self.h.evidence,guard=self.h.guard)
        self.h.gate.release('rt',clean=False)
        with self.assertRaises(PermissionError): self.archive.archive(self.h.gate,self.h.evidence,guard=self.h.guard)
        self.assertTrue(list(self.h.ledger.iterdir()))

    def test_missing_ack_or_partial_transaction_keeps_hot_evidence(self):
        marker=next(self.h.evidence.glob('*/transaction.json'));value=json.loads(marker.read_bytes())
        value['status']='requires_review';marker.write_text(json.dumps(value))
        with self.assertRaises(Exception): self.archive.archive(self.h.gate,self.h.evidence,guard=self.h.guard)
        self.assertTrue(list(self.h.ledger.iterdir()))

    def test_no_capacity_never_removes_hot_receipts(self):
        self.archive.max_bytes=1
        before={str(p):p.read_bytes() for p in self.h.ledger.rglob('*') if p.is_file()}
        with self.assertRaises(OSError): self.archive.archive(self.h.gate,self.h.evidence,guard=self.h.guard)
        self.assertTrue(all(Path(p).read_bytes()==raw for p,raw in before.items()))

    def test_missing_or_corrupt_archived_receipts_block_recovery(self):
        self.archive.archive(self.h.gate,self.h.evidence,guard=self.h.guard)
        row=self.archive.db.execute('SELECT * FROM snapshots').fetchone()
        self.archive.path(row['id']).write_bytes(b'altered')
        with self.assertRaises(ValueError): self.archive.recover()

    def test_modified_remaining_hot_file_is_preserved_for_review(self):
        def cut(): raise OSError('fixture cut')
        with self.assertRaises(OSError): self.archive.archive(self.h.gate,self.h.evidence,guard=self.h.guard,after_file=cut)
        path=next(p for p in (self.h.folder/'cierres_retirados').rglob('*') if p.is_file());path.write_bytes(b'foreign fixture')
        with self.assertRaises(ValueError): self.archive.recover()
        self.assertEqual(b'foreign fixture',path.read_bytes())


if __name__=='__main__': unittest.main()
