"""Unir el ciclo a los aplicadores existentes; sin SDK/API/MDB de caseta."""
import copy
import json
from pathlib import Path
import sys
import types
import unittest
import uuid
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import ciclo_operativo as cycle
import respaldo_ciclo as checkpoint
import test_aplicador_integrado as base
import test_aplicacion_vigencias as f


class CycleTests(unittest.TestCase):
    def setUp(self):
        self.h = base.IntegratedTests('runTest')
        self.h.setUp()
        self.addCleanup(self.h.tearDown)
        self.sdk = types.SimpleNamespace(gate=self.h.gate, ledger=self.h.ledger, store=self.h.store,
            read_child=self.h.read_child, apply_child=self.h.apply_child,
            capture_profile=Mock(side_effect=self.profile))
        self.copy = Mock(side_effect=self.h.copy_mdb)
        self.validate = Mock(side_effect=lambda path, password, plan: {
            'access_before_sha256': f.app.digest(plan['access_before'])})
        self.preparer = Mock(side_effect=self.prepare)

    def profile(self, plan, run):
        user = dict(f.USER, CardNo=plan['card'], Pin=plan['c3_before']['Pin'])
        permits = [dict(row, Pin=user['Pin']) for row in base.p.PERMITS]
        meta = self.sdk.store.seal(plan, user, permits)
        return {'snapshot_id': meta['snapshot_id']}

    def prepare(self, plans, run):
        return checkpoint.prepare(plans, self.h.source, self.h.mdb_root, 'fixture', self.sdk,
            run, self.h.folder/'cycle_bundles', guard=self.h.guard, copy=self.copy, validate=self.validate)

    def inventory(self):
        value = self.h.access_before
        return [(value['userid'], value['card'], f.app.parse_date(value['start']),
                 f.app.parse_date(value['end']), value['valid_raw'])]

    def make(self, applying=False, **kwargs):
        import contextlib
        @contextlib.contextmanager
        def access():
            yield self.h.access
        return cycle.Cycle(lambda: copy.deepcopy(self.h.api), self.inventory, self.sdk,
            guard=self.h.guard, access_factory=access if applying else None,
            prepare=self.preparer if applying else None, authorize=f.approval if applying else None,
            evidence=self.h.evidence, **kwargs)

    def test_readonly_concrete_inventory_has_no_approval_or_writes(self):
        result = self.make()()
        self.assertEqual('compared', result['status'])
        self.assertEqual(1, result['access_changes'])
        self.assertEqual(1, result['c3_changes'])
        self.h.access.update.assert_not_called()
        self.preparer.assert_not_called()

    def test_complete_protected_cycle_applies_c3_then_access_and_checks_every_closure(self):
        result = self.make(applying=True)()
        self.assertEqual('verified', result['status'])
        self.assertEqual(1, result['verified'])
        self.assertEqual('20261105', self.h.user['EndTime'])
        self.assertEqual('2026-11-05 23:59:59', self.h.access_before['end'])
        self.assertEqual(f.USER['Password'], self.h.user['Password'])
        self.assertIsNone(self.h.gate.active)
        self.copy.assert_called_once()
        self.assertEqual(3, base.integrated.core.check_operations(self.h.ledger))

    def test_equal_dates_are_noop_without_backup_or_set(self):
        self.h.access_before['end'] = f.API[0]['expiration']
        self.h.user['EndTime'] = '20261105'
        result = self.make(applying=True)()
        self.assertEqual(0, result['verified'])
        self.preparer.assert_not_called()
        self.h.access.update.assert_not_called()

    def test_expired_api_date_stays_expired(self):
        self.h.api[0]['expiration'] = '2024-01-05 23:59:59'
        self.make(applying=True)()
        self.assertEqual('20240105', self.h.user['EndTime'])
        self.assertEqual('2024-01-05 23:59:59', self.h.access_before['end'])

    def test_absent_api_and_missing_existing_record_do_not_create_or_change(self):
        self.h.api = [{'card_no': '99999999', 'expiration': f.API[0]['expiration']}]
        result = self.make(applying=True)()
        self.assertEqual(1, result['not_found'])
        self.assertEqual(1, result['absent_api_unchanged'])
        self.preparer.assert_not_called()
        self.h.access.update.assert_not_called()

    def test_duplicate_access_blocks_before_sdk(self):
        run = self.make()
        run.inventory = lambda: self.inventory()*2
        read = Mock()
        self.sdk.read_child = read
        with self.assertRaises(RuntimeError):
            run()
        read.assert_not_called()

    def test_stop_between_backup_and_approval_starts_no_write(self):
        stopped = [False]
        def prepare(plans, run):
            result = self.prepare(plans, run)
            stopped[0] = True
            return result
        run = self.make(applying=True, stop=lambda: stopped[0])
        run.prepare = prepare
        with self.assertRaises(cycle.CycleInterrupted):
            run()
        self.h.access.update.assert_not_called()
        self.assertNotIn('apply_child', self.h.events)

    def test_partial_access_failure_blocks_next_cycle_and_preserves_c3_result(self):
        self.h.fail_access = True
        run = self.make(applying=True)
        with self.assertRaises(base.integrated.core.ReviewRequired):
            run()
        self.assertEqual('20261105', self.h.user['EndTime'])
        events = list(self.h.events)
        with self.assertRaises(base.integrated.core.ReviewRequired):
            run()
        self.assertEqual(events, self.h.events)

    def test_two_tags_share_one_physical_mdb_with_separate_encrypted_profiles(self):
        one = f.plan()
        two = f.app.make_plan('22345678', [{'card_no':'22345678', 'expiration': f.API[0]['expiration']}],
            dict(f.ACCESS, card='22345678', userid=43), dict(f.C3, CardNo='22345678', Pin='43'))
        result = self.prepare([one, two], str(uuid.uuid4()))
        self.copy.assert_called_once()
        self.validate.assert_called_once()
        self.assertEqual(2, self.sdk.capture_profile.call_count)
        meta1, _ = result[one['card']].check(one)
        meta2, _ = result[two['card']].check(two)
        self.assertEqual(meta1['mdb_backup_id'], meta2['mdb_backup_id'])
        self.assertNotEqual(meta1['snapshot_id'], meta2['snapshot_id'])
        # No archivo adicional en directorio MDB: admitir otro respaldo sigue siendo compatible.
        folder = self.h.mdb_root / meta1['mdb_backup_id']
        self.assertEqual({'Database_PRO_antes.mdb', 'manifest.json'}, {p.name for p in folder.iterdir()})
        checkpoint.mdb.admit(self.h.mdb_root, self.h.source.stat().st_size)

    def test_shared_mdb_corruption_prevents_any_application(self):
        bundles = self.prepare([f.plan()], str(uuid.uuid4()))
        bundle = bundles[f.CARD]
        meta, _ = bundle.check(f.plan())
        (self.h.mdb_root/meta['mdb_backup_id']/'Database_PRO_antes.mdb').write_bytes(b'corrupt')
        with self.assertRaises(f.app.ScopeRejected):
            bundle.check(f.plan())

    def test_foreign_plan_or_index_corruption_is_rejected(self):
        bundle = self.prepare([f.plan()], str(uuid.uuid4()))[f.CARD]
        meta, _ = bundle.check(f.plan())
        index = bundle.path.parent.parent/'indices'/(meta['mdb_backup_id']+'.json')
        value = json.loads(index.read_bytes())
        value['plans'][f.app.digest(f.plan())] = '0'*64
        index.write_text(json.dumps(value))
        with self.assertRaises(f.app.ScopeRejected):
            bundle.check(f.plan())


if __name__ == '__main__':
    unittest.main()
