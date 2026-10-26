"""Piloto de un tag con API/C3/MDB ficticios y el aplicador protegido real."""
import contextlib
import copy
import io
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock,patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import piloto_vigencias as pilot
import piloto_vigencias_dell as entry
import test_ciclo_operativo as base
import test_aplicacion_vigencias as f


class PilotTests(unittest.TestCase):
    def setUp(self):
        self.fixture=base.CycleTests('runTest');self.fixture.setUp();self.addCleanup(self.fixture.doCleanups)
        self.h=self.fixture.h;self.h.events.clear();self.api=Mock(side_effect=lambda:copy.deepcopy(self.h.api))
        self.confirm=Mock(return_value=True);self.publish=Mock();self.before=Mock();self.stop=Mock(return_value=False)
    def run_pilot(self):
        @contextlib.contextmanager
        def access():yield self.h.access
        return pilot.run(f.CARD,self.api,lambda card:copy.deepcopy(self.h.access_before),self.fixture.sdk,
            self.fixture.prepare,access,self.h.evidence,guard=self.h.guard,confirm=self.confirm,
            publish=self.publish,before_write=self.before,stop=self.stop)

    def test_complete_pilot_uses_api_dates_and_only_authorizes_after_backup_and_confirmation(self):
        result=self.run_pilot()
        self.assertEqual('verified',result['status']);self.assertTrue(result['dates_applied'])
        self.assertEqual('20261105',self.h.user['EndTime']);self.assertEqual(f.API[0]['expiration'],self.h.access_before['end'])
        self.assertEqual(f.USER['Password'],self.h.user['Password']);self.before.assert_called_once()
        plan,phrase=self.confirm.call_args.args;self.assertEqual(pilot.phrase(plan),phrase)
        self.assertTrue(self.publish.call_args.args[0]['backup_verified'])

    def test_coincident_dates_do_not_create_backup_ask_confirmation_or_write(self):
        self.h.user['EndTime']='20261105';self.h.access_before['end']=f.API[0]['expiration']
        result=self.run_pilot();self.assertEqual('no_changes',result['status'])
        self.assertFalse(result['approval_issued']);self.confirm.assert_not_called();self.before.assert_not_called()
        self.fixture.copy.assert_not_called();self.h.access.update.assert_not_called()

    def test_declining_keeps_backup_and_never_starts_application(self):
        self.confirm.return_value=False;result=self.run_pilot()
        self.assertEqual('declined',result['status']);self.assertTrue(result['backup_verified'])
        self.before.assert_not_called();self.h.access.update.assert_not_called();self.assertNotIn('apply_child',self.h.events)

    def test_truthy_string_is_not_consent(self):
        self.confirm.return_value='True';self.assertEqual('declined',self.run_pilot()['status'])
        self.before.assert_not_called()

    def test_api_change_during_human_wait_rejects_before_marker_or_set(self):
        def accept(*_):self.h.api[0]['expiration']='2026-12-05 23:59:59';return True
        self.confirm.side_effect=accept
        with self.assertRaises(f.app.ScopeRejected):self.run_pilot()
        self.before.assert_not_called();self.h.access.update.assert_not_called();self.assertNotIn('apply_child',self.h.events)

    def test_access_change_during_human_wait_rejects_without_overwriting(self):
        def accept(*_):self.h.access_before['end']='2026-12-05 23:59:59';return True
        self.confirm.side_effect=accept
        with self.assertRaises(f.app.ScopeRejected):self.run_pilot()
        self.before.assert_not_called();self.assertNotIn('apply_child',self.h.events)

    def test_c3_change_during_human_wait_rejects_without_set(self):
        def accept(*_):self.h.user['EndTime']='20261205';return True
        self.confirm.side_effect=accept
        with self.assertRaises(f.app.ScopeRejected):self.run_pilot()
        self.before.assert_not_called();self.h.access.update.assert_not_called()

    def test_backup_corruption_during_confirmation_prevents_approval(self):
        def accept(*_):
            for path in self.h.mdb_root.glob('*/Database_PRO_antes.mdb'):path.write_bytes(b'corrupt fixture')
            return True
        self.confirm.side_effect=accept
        with self.assertRaises(f.app.ScopeRejected):self.run_pilot()
        self.before.assert_not_called();self.h.access.update.assert_not_called()

    def test_absent_api_does_not_connect_c3_or_access(self):
        self.h.api=[{'card_no':'99999999','expiration':f.API[0]['expiration']}]
        with self.assertRaises(f.app.ScopeRejected):self.run_pilot()
        self.assertEqual([],self.h.events);self.confirm.assert_not_called()

    def test_stop_before_start_does_not_query_or_authorize(self):
        self.stop.return_value=True
        with self.assertRaises(f.app.ScopeRejected):self.run_pilot()
        self.api.assert_not_called();self.confirm.assert_not_called()

    def test_stop_during_backup_prevents_confirmation(self):
        previous=self.fixture.prepare
        def prepare(*args):value=previous(*args);self.stop.return_value=True;return value
        self.fixture.prepare=prepare
        with self.assertRaises(f.app.ScopeRejected):self.run_pilot()
        self.confirm.assert_not_called();self.before.assert_not_called()

    def test_stop_after_c3_finishes_current_access_transaction_consistently(self):
        previous=self.fixture.sdk.apply_child
        def apply(*args):value=previous(*args);self.stop.return_value=True;return value
        self.fixture.sdk.apply_child=apply
        self.assertEqual('verified',self.run_pilot()['status'])
        self.assertEqual(f.API[0]['expiration'],self.h.access_before['end'])

    def test_access_failure_after_c3_leaves_durable_partial_evidence(self):
        self.h.fail_access=True
        with self.assertRaises(f.app.core.ReviewRequired):self.run_pilot()
        self.assertEqual('20261105',self.h.user['EndTime'])
        with self.assertRaises(f.app.core.ReviewRequired):pilot.integrated.check_runs(self.h.evidence)

    def test_invalid_card_is_rejected_before_fetch(self):
        for card in ('0','1;DELETE','１２３',None):
            with self.assertRaises(f.app.ScopeRejected):
                pilot.run(card,self.api,Mock(),Mock(),Mock(),Mock(),self.h.evidence,
                    guard=Mock(),confirm=Mock(),publish=Mock(),before_write=Mock())
        self.api.assert_not_called()


class EntryControls(unittest.TestCase):
    def test_console_confirmation_requires_exact_phrase_and_can_cancel(self):
        with patch('sys.stdout',io.StringIO()):
            self.assertTrue(entry.confirmation({},'APLICAR 123 SHA',source=io.StringIO('APLICAR 123 SHA\n')))
            self.assertFalse(entry.confirmation({},'APLICAR 123 SHA',source=io.StringIO('\n')))
            self.assertFalse(entry.confirmation({},'APLICAR 123 SHA',source=io.StringIO('si\n')))

    def test_expired_console_wait_cannot_authorize(self):
        with patch('sys.stdout',io.StringIO()):
            self.assertFalse(entry.confirmation({},'x',seconds=0,source=io.StringIO('x\n')))

    def test_wrong_launcher_run_id_is_rejected_before_preflight(self):
        with patch.object(entry,'preflight') as preflight:
            with self.assertRaises(ValueError):entry.run_actual('123','wrong')
        preflight.assert_not_called()

    def test_access_factory_uses_explicit_transaction_and_closes_on_exception(self):
        connection=types.SimpleNamespace(autocommit=False,rollback=Mock(),close=Mock())
        connect=Mock(return_value=connection)
        with self.assertRaises(OSError):
            with entry.access_dates(Path('fixture.mdb'),'fixture',connect=connect):raise OSError('fixture')
        self.assertIs(False,connect.call_args.kwargs['readonly']);self.assertIs(False,connect.call_args.kwargs['autocommit'])
        connection.rollback.assert_called_once();connection.close.assert_called_once()

    def test_sdk_fault_retains_exclusion_even_when_output_fails(self):
        gate=entry.SDKGate();gate.fault=True
        with patch('builtins.print',side_effect=OSError('fixture')):
            with self.assertRaises(InterruptedError):entry.hold_uncertain(gate,sleep=Mock(side_effect=InterruptedError))


if __name__=='__main__':unittest.main()
