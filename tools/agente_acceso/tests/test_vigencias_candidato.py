"""Contrato apply, proceso ficticio y ciclo r2 real con API/ODBC/C3 sustituidos."""
import copy
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import vigencias_candidato as candidate
import adaptadores_cierre as closures
from captura_rt import UnsafeClosure
from trabajador_controlado import SDKGate

RUN = '70000000-0000-4000-8000-000000000001'
ROW = {'CardNo': '12345678', 'Pin': '42', 'StartTime': '20200101', 'EndTime': '20261001',
       'Password': 'private_fixture', 'Group': '9', 'SuperAuthorize': '0'}


def change(card='12345678', end='20261105'):
    row = dict(ROW, CardNo=card)
    return {'card': card, 'end': end, 'before': {k: row[k] for k in candidate.FIELDS}}


class FakePanel:
    sdk_sha256 = closures.SDK_HASH

    def __init__(self, fault=None, rows=None):
        self.fault, self.rows = fault, copy.deepcopy(rows or [ROW])
        self.events, self.writes = [], []

    def open(self):
        self.events.append('open')
        if self.fault == 'open':
            raise RuntimeError('private_fixture')

    def serial(self):
        return 'WRONG' if self.fault == 'serial' else candidate.SERIAL

    def inventory(self):
        if self.fault == 'read':
            raise ValueError('private_fixture')
        return copy.deepcopy(self.rows)

    def user(self, card):
        return copy.deepcopy(next(row for row in self.rows if row['CardNo'] == card))

    def permissions(self, pin):
        return [{'Pin': pin, 'AuthorizeTimezoneId': '9' if self.fault == 'permission' and self.writes else '1'}]

    def write_dates(self, values):
        if set(values) != candidate.FIELDS:
            raise AssertionError('Campos privados enviados')
        self.writes.append(copy.deepcopy(values))
        row = next(row for row in self.rows if row['CardNo'] == values['CardNo'])
        row.update(values)
        if self.fault == 'write':
            raise RuntimeError('private_fixture after write')
        if self.fault == 'after':
            row['Group'] = 'CHANGED'

    def disconnect(self):
        self.events.append('disconnect')
        if self.fault == 'disconnect':
            raise RuntimeError('private_fixture')

    def close_library(self):
        self.events.append('library_close')
        if self.fault == 'library':
            raise RuntimeError('private_fixture')


class CandidateTests(unittest.TestCase):
    def setUp(self):
        self.scratch = ROOT / 'datos' / 'pruebas_vigencias_candidato'
        self.scratch.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=self.scratch)
        self.folder = Path(self.temp.name)
        self.base = self.folder / 'cierres'

    def tearDown(self):
        if not self.folder.resolve().is_relative_to(self.scratch.resolve()):
            raise RuntimeError('Temporal ajeno.')
        self.temp.cleanup()

    def session(self, payload):
        folder = closures.new_session(self.base, RUN, 'vigencias')
        raw = candidate.encoded(payload)
        candidate.durable(folder / 'operation.json', raw)
        return folder, hashlib.sha256(raw).hexdigest()

    def test_rejects_whole_malformed_batch_before_open_or_write(self):
        invalid = [None, {'mode': 'delete'}, {'mode': 'read', 'changes': []},
                   {'mode': 'apply', 'changes': []}, {'mode': 'apply', 'changes': [change(), change()]},
                   {'mode': 'apply', 'changes': [change(end='20260230')]},
                   {'mode': 'apply', 'changes': [change(end='20191231')]}]
        for field, value in [('card', '1\t2'), ('before', {'Password': 'secret'}), ('end', True)]:
            invalid.append({'mode': 'apply', 'changes': [change() | {field: value}]})
        for payload in invalid:
            with self.subTest(payload=payload):
                folder, digest = self.session(payload)
                factory = Mock()
                with self.assertRaises((ValueError, TypeError)):
                    candidate.worker(folder, digest, factory)
                factory.assert_not_called()

    def test_operation_hash_tampering_never_constructs_panel(self):
        folder, digest = self.session({'mode': 'read'})
        (folder / 'operation.json').write_bytes(b'{"mode":"apply"}')
        factory = Mock()
        with self.assertRaises(ValueError):
            candidate.worker(folder, digest, factory)
        factory.assert_not_called()

    def test_inventory_excludes_private_fields_and_closes_before_receipt(self):
        folder, digest = self.session({'mode': 'read'})
        panel = FakePanel()
        close = panel.close_library
        def checked_close():
            self.assertFalse((folder / 'closed.json').exists())
            close()
        panel.close_library = checked_close
        self.assertEqual(0, candidate.worker(folder, digest, lambda: panel))
        self.assertEqual(['open', 'disconnect', 'library_close'], panel.events)
        raw = (folder / 'response.json').read_bytes()
        self.assertNotIn(b'private_fixture', raw)
        self.assertNotIn(b'Password', raw)
        self.assertTrue(closures.verified_closure(folder, os.getpid())['operation_ok'])
        self.assertEqual([], panel.writes)

    def test_wrong_serial_prevents_reads_and_writes(self):
        folder, digest = self.session({'mode': 'apply', 'changes': [change()]})
        panel = FakePanel('serial')
        self.assertEqual(0, candidate.worker(folder, digest, lambda: panel))
        self.assertEqual([], panel.writes)
        self.assertEqual('ControllerIdentityError', closures.verified_closure(folder, os.getpid())['error_type'])

    def test_apply_only_dates_preserves_private_fields_and_permissions(self):
        folder, digest = self.session({'mode': 'apply', 'changes': [change()]})
        panel = FakePanel()
        self.assertEqual(0, candidate.worker(folder, digest, lambda: panel))
        self.assertEqual(dict(ROW, EndTime='20261105'), panel.rows[0])
        self.assertEqual({'12345678': {'ok': True}}, json.loads((folder / 'response.json').read_bytes())['data'])
        self.assertEqual([{'CardNo': ROW['CardNo'], 'Pin': ROW['Pin'], 'StartTime': '20200101', 'EndTime': '20261105'}], panel.writes)

    def test_concurrent_user_change_prevents_write_without_review_flag(self):
        panel = FakePanel(rows=[dict(ROW, Pin='99')])
        result = candidate.apply_dates(panel, [change()])
        self.assertFalse(result[ROW['CardNo']]['ok'])
        self.assertFalse(result[ROW['CardNo']]['requires_review'])
        self.assertEqual([], panel.writes)

    def test_postwrite_failures_stop_remaining_tags_and_require_review(self):
        for fault in ('write', 'after', 'permission'):
            with self.subTest(fault=fault):
                panel = FakePanel(fault, [ROW, dict(ROW, CardNo='22345678')])
                result = candidate.apply_dates(panel, [change(), change('22345678')])
                self.assertTrue(result['12345678']['requires_review'])
                self.assertEqual(1, len(panel.writes))
                self.assertEqual('20261001', panel.rows[1]['EndTime'])
                self.assertNotIn('private_fixture', json.dumps(result))

    def test_partial_batch_retains_success_then_failure_without_silent_success(self):
        panel = FakePanel(rows=[ROW, dict(ROW, CardNo='22345678', Pin='99')])
        payload = {'mode': 'apply', 'changes': [change(), change('22345678')]}
        result = candidate.apply_dates(panel, payload['changes'])
        self.assertTrue(result['12345678']['ok'])
        self.assertFalse(result['22345678']['ok'])
        candidate.validate_result(payload, result)

    def test_nonclean_disconnect_or_library_never_verifies_as_closed(self):
        for fault in ('disconnect', 'library'):
            folder, digest = self.session({'mode': 'read'})
            panel = FakePanel(fault)
            self.assertEqual(1, candidate.worker(folder, digest, lambda: panel))
            self.assertEqual('library_close', panel.events[-1])
            with self.assertRaises(ValueError):
                closures.verified_closure(folder, os.getpid())

    def test_open_failure_still_attempts_both_resource_closures(self):
        folder, digest = self.session({'mode': 'read'})
        panel = FakePanel('open')
        candidate.worker(folder, digest, lambda: panel)
        self.assertEqual(['open', 'disconnect', 'library_close'], panel.events)
        self.assertNotIn(b'private_fixture', (folder / 'closed.json').read_bytes())
        self.assertFalse((folder / 'response.json').exists())

    def test_invalid_inventory_or_response_does_not_accept_incomplete_data(self):
        for rows in ([], [ROW, ROW], [dict(ROW, Pin=None)]):
            with self.assertRaises(ValueError):
                candidate.inventory(rows)
        payload = {'mode': 'apply', 'changes': [change(), change('22345678')]}
        for data in ({}, {'12345678': {'ok': 1}}, {'12345678': {'ok': True}},
                     {'999': {'ok': True}}, {'12345678': {'ok': False, 'error': 'precondition_failed', 'requires_review': False}, '22345678': {'ok': True}}):
            with self.assertRaises(ValueError):
                candidate.validate_result(payload, data)

    def test_apply_result_order_is_bound_to_request_not_json_key_order(self):
        payload = {'mode': 'apply', 'changes': [change('22345678'), change()]}
        data = json.loads(candidate.encoded({'22345678': {'ok': True}, '12345678': {'ok': True}}))
        candidate.validate_result(payload, data)

    def command_factory(self, fault=None):
        script = self.folder / ('fake_' + str(fault) + '.py')
        script.write_text('''import hashlib,json,os,pathlib,sys,time
sys.path.insert(0,sys.argv[1])
sys.path.insert(0,str(pathlib.Path(sys.argv[1])/'tests'))
import vigencias_candidato as c
from test_vigencias_candidato import FakePanel
folder,digest,fault=pathlib.Path(sys.argv[2]),sys.argv[3],sys.argv[4]
if any(k.upper().startswith('SANISIDRO_') for k in os.environ): raise SystemExit(8)
if fault=='timeout': time.sleep(30)
if fault=='exit': raise SystemExit(7)
code=c.worker(folder,digest,lambda:FakePanel(None if fault=='ok' else fault))
if fault=='wrong_operation':
    path=folder/'response.json'
    value=json.loads(path.read_bytes());value['operation_sha256']='0'*64
    raw=c.encoded(value);path.write_bytes(raw)
    path=folder/'closed.json';v=json.loads(path.read_bytes())
    v['response_bytes']=len(raw);v['response_sha256']=hashlib.sha256(raw).hexdigest();path.write_text(json.dumps(v))
raise SystemExit(code)
''', encoding='utf-8')
        return lambda folder, digest: [sys.executable, '-B', str(script), str(ROOT), str(folder), digest, fault or 'ok']

    def exchange(self, fault=None, timeout=10):
        return candidate.Exchange(SDKGate(), self.base, RUN, self.command_factory(fault), timeout=timeout)

    def test_fake_child_read_and_apply_acknowledge_matching_closed_operations(self):
        exchange = self.exchange()
        with patch.dict(os.environ, {'SANISIDRO_ACCESS_PASSWORD': 'private_fixture'}):
            self.assertEqual('42', exchange({'mode': 'read'})['12345678']['Pin'])
            self.assertEqual({'12345678': {'ok': True}}, exchange({'mode': 'apply', 'changes': [change()]}))
        self.assertEqual(2, closures.check_ledger(self.base))
        self.assertFalse(exchange.gate.fault)
        self.assertIsNone(exchange.gate.active)

    def test_fake_child_clean_read_error_is_retryable_with_durable_receipt(self):
        exchange = self.exchange('read')
        with self.assertRaises(RuntimeError):
            exchange({'mode': 'read'})
        self.assertEqual(1, closures.check_ledger(self.base))
        self.assertFalse(exchange.gate.fault)
        self.assertFalse(exchange.review.exists())

    def test_fake_child_write_error_has_clean_sdk_but_persistent_review_blocks_retry(self):
        exchange = self.exchange('write')
        result = exchange({'mode': 'apply', 'changes': [change()]})
        self.assertTrue(result['12345678']['requires_review'])
        self.assertTrue(exchange.review.exists())
        self.assertEqual(1, closures.check_ledger(self.base))
        self.assertFalse(exchange.gate.fault)
        with self.assertRaises(candidate.ReviewRequired):
            exchange({'mode': 'read'})
        self.assertEqual(1, len(list(self.base.iterdir())))

    def test_wrong_controller_requires_revision_after_confirmed_close(self):
        exchange = self.exchange('serial')
        with self.assertRaises(candidate.ReviewRequired):
            exchange({'mode': 'read'})
        self.assertTrue(exchange.review.exists())
        self.assertEqual(1, closures.check_ledger(self.base))

    def test_wrong_operation_receipt_exit_and_timeout_block_future_sdk(self):
        for fault in ('wrong_operation', 'exit', 'timeout'):
            with self.subTest(fault=fault):
                base = self.folder / fault / 'cierres'
                exchange = candidate.Exchange(SDKGate(), base, RUN, self.command_factory(fault), timeout=.4 if fault=='timeout' else 10)
                with self.assertRaises(UnsafeClosure):
                    exchange({'mode': 'read'})
                self.assertTrue(exchange.gate.fault)
                self.assertTrue((base.parent / 'cierre_inseguro.json').exists())

    def test_review_persistence_failure_also_latches_gate(self):
        exchange = self.exchange('write')
        original = closures.atomic_json
        def save(path, data):
            if Path(path) == exchange.review:
                raise OSError('disk full')
            return original(path, data)
        with patch.object(closures, 'atomic_json', side_effect=save):
            with self.assertRaises(UnsafeClosure):
                exchange({'mode': 'apply', 'changes': [change()]})
        self.assertTrue(exchange.gate.fault)

    def test_parent_ack_is_persisted_before_releasing_sdk_gate(self):
        exchange=self.exchange()
        release=exchange.gate.release
        def checked_release(role, *, clean):
            if clean:
                self.assertEqual(1,closures.check_ledger(self.base))
            return release(role,clean=clean)
        with patch.object(exchange.gate,'release',side_effect=checked_release):
            exchange({'mode':'read'})

    def test_ack_failure_never_releases_clean_turn_or_allows_new_sdk(self):
        exchange=self.exchange()
        with patch.object(closures,'acknowledge',side_effect=OSError('disk full')):
            with self.assertRaises(UnsafeClosure): exchange({'mode':'read'})
        self.assertTrue(exchange.gate.fault)
        with self.assertRaises(UnsafeClosure): closures.check_ledger(self.base)

    def test_review_reconstructed_from_receipt_even_if_marker_is_missing(self):
        exchange=self.exchange('write')
        # Simula corte/fallo de persistencia de la marca adicional; recibos quedan.
        with patch.object(exchange,'mark_review'):
            exchange({'mode':'apply','changes':[change()]})
        self.assertFalse(exchange.review.exists())
        self.assertEqual(1,closures.check_ledger(self.base))
        with self.assertRaises(candidate.ReviewRequired): candidate.check_operations(self.base)
        restarted=self.exchange()
        with self.assertRaises(candidate.ReviewRequired): restarted({'mode':'read'})
        self.assertEqual(1,len(list(self.base.iterdir())))

    def test_completed_operation_tampering_blocks_restart(self):
        exchange=self.exchange();exchange({'mode':'read'})
        path=next(self.base.glob('*/operation.json'))
        path.write_bytes(b'{"mode": "read"}')  # Mismo valor, otros bytes: hash original no coincide.
        with self.assertRaises(UnsafeClosure): candidate.check_operations(self.base)

    def test_existing_rt_turn_blocks_creation_of_another_sdk_child(self):
        exchange=self.exchange();exchange.gate.acquire('rt')
        with patch('subprocess.Popen') as launch:
            with self.assertRaises(UnsafeClosure): exchange({'mode':'read'})
        launch.assert_not_called();self.assertTrue(exchange.gate.fault)


class FakeConnection:
    def __init__(self, records, *, fail_update=False):
        self.committed = copy.deepcopy(records)
        self.records = copy.deepcopy(records)
        self.fail_update = fail_update
        self.events = []
        self.answer = None
    def cursor(self): return self
    def execute(self, sql, *args):
        if sql.startswith('SELECT USERID'):
            self.answer = list(self.records.values())
        elif sql.startswith('SELECT acc_startdate'):
            row = self.records[args[1]]
            self.answer = tuple(row[2:5]) if row[0] == args[0] else None
        elif sql.startswith('UPDATE USERINFO SET acc_startdate'):
            self.events.append('update')
            if self.fail_update: raise RuntimeError('private fixture ODBC')
            row = self.records[args[4]]
            row[2:5] = list(args[:3])
        else:
            raise AssertionError('SQL inesperado')
        return self
    def fetchall(self): return self.answer
    def fetchone(self): return self.answer
    def commit(self):
        self.events.append('commit')
        self.committed = copy.deepcopy(self.records)
    def rollback(self):
        self.events.append('rollback')
        self.records = copy.deepcopy(self.committed)
    def close(self): self.events.append('close')


class ParityTests(unittest.TestCase):
    def setUp(self):
        self.scratch = ROOT / 'datos' / 'pruebas_vigencias_candidato'
        self.scratch.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=self.scratch)
        self.folder = Path(self.temp.name)
    def tearDown(self):
        if not self.folder.resolve().is_relative_to(self.scratch.resolve()): raise RuntimeError('Temporal ajeno')
        self.temp.cleanup()
    def run_cycle(self, *, apply=False, access_failure=False, c3_failure=False, extra=None):
        old = dt.datetime(2026, 10, 1, 23, 59, 59)
        records = {'12345678': [42, '12345678', dt.datetime(2020,1,1), old, True],
                   '99999999': [99, '99999999', dt.datetime(2020,1,1), old, True]}
        conn = FakeConnection(records, fail_update=access_failure)
        panel = FakePanel('write' if c3_failure else None)
        payloads = []
        review = self.folder / 'revision_vigencias.json'
        def dispatch(payload):
            candidate.validate(payload)
            payloads.append(copy.deepcopy(payload))
            if payload['mode'] == 'read': return candidate.inventory(panel.inventory())
            result = candidate.apply_dates(panel, payload['changes'])
            if any(i.get('requires_review') for i in result.values()): review.write_text('{}')
            return result
        exchange = Mock(side_effect=dispatch)
        exchange.review = review
        cycle = candidate.ReferenceCycle('private_fixture', exchange, self.folder / 'new', apply=apply)
        rows = [{'card_no':'12345678','expiration':'2026-11-05 23:59:59'}]
        if extra: rows += extra
        response = io.BytesIO(json.dumps(rows).encode())
        with patch.dict(sys.modules, {'pyodbc':types.SimpleNamespace(connect=Mock(return_value=conn))}), \
             patch.object(cycle.module.urllib.request, 'urlopen', return_value=response), \
             patch.object(candidate.logging, 'error') as errors:
            error = None
            try: cycle()
            except Exception as exc: error = exc
            self.assertNotIn('private',str(errors.call_args_list))
        return cycle, conn, panel, payloads, error, records

    def test_reference_readonly_uses_real_r2_plan_without_writes(self):
        cycle, conn, panel, payloads, error, original = self.run_cycle()
        self.assertIsNone(error)
        self.assertEqual([{'mode':'read'}], payloads)
        self.assertEqual([], panel.writes)
        self.assertEqual(original, conn.committed)
        plan = next((cycle.module.ROOT/'registros').glob('plan_*.csv')).read_text(encoding='utf-8-sig')
        self.assertIn('12345678,2026-11-05 23:59:59,EXISTENTE,True,True', plan)

    def test_reference_apply_requeries_api_preserves_absent_api_and_applies_only_existing(self):
        cycle, conn, panel, payloads, error, original = self.run_cycle(apply=True,
            extra=[{'card_no':'22345678','expiration':'2026-11-05 23:59:59'}])
        self.assertIsNone(error)
        self.assertEqual(['read','apply'], [p['mode'] for p in payloads])
        self.assertEqual(['12345678'], [c['card'] for c in payloads[1]['changes']])
        self.assertEqual(dt.datetime(2026,11,5,23,59,59),conn.committed['12345678'][3])
        self.assertEqual(original['99999999'],conn.committed['99999999'])
        self.assertEqual(dict(ROW,EndTime='20261105'),panel.rows[0])
        self.assertEqual(1,len(list((cycle.module.ROOT/'respaldos').glob('fechas_*.json'))))

    def test_access_failure_keeps_c3_change_and_raises_cycle_error_with_backup(self):
        cycle, conn, panel, payloads, error, original = self.run_cycle(apply=True,access_failure=True)
        self.assertIsInstance(error,RuntimeError)
        self.assertEqual(original,conn.committed)
        self.assertEqual('20261105',panel.rows[0]['EndTime'])
        self.assertIn('rollback',conn.events)
        self.assertTrue(list((cycle.module.ROOT/'respaldos').glob('fechas_*.json')))

    def test_c3_postwrite_failure_prevents_access_commit_and_latches_review(self):
        cycle,conn,panel,payloads,error,original=self.run_cycle(apply=True,c3_failure=True)
        self.assertIsInstance(error,candidate.ReviewRequired)
        self.assertTrue(cycle.exchange.review.exists())
        self.assertEqual(original,conn.committed)
        self.assertNotIn('update',conn.events)
        self.assertEqual('20261105',panel.rows[0]['EndTime'])

    def test_readonly_bridge_rejects_write_even_if_called_directly(self):
        exchange=Mock();exchange.review=self.folder/'absent'
        cycle=candidate.ReferenceCycle('fixture',exchange,self.folder,apply=False)
        with self.assertRaises(ValueError): cycle.dispatch({'mode':'apply','changes':[change()]})
        exchange.assert_not_called()

    def test_preexisting_review_blocks_api_access_and_sdk(self):
        exchange=Mock();exchange.review=self.folder/'revision.json';exchange.review.write_text('{}')
        cycle=candidate.ReferenceCycle('fixture',exchange,self.folder,apply=True)
        with patch.object(cycle.module,'cycle') as call:
            with self.assertRaises(candidate.ReviewRequired): cycle()
        call.assert_not_called();exchange.assert_not_called()

    def test_every_cycle_reads_fresh_api_and_does_not_reuse_previous_expiration(self):
        old=dt.datetime(2026,10,1,23,59,59)
        conn=FakeConnection({'12345678':[42,'12345678',dt.datetime(2020,1,1),old,True]})
        panel=FakePanel();exchange=Mock();exchange.review=self.folder/'absent'
        def dispatch(payload):
            return candidate.inventory(panel.inventory()) if payload['mode']=='read' else candidate.apply_dates(panel,payload['changes'])
        exchange.side_effect=dispatch
        cycle=candidate.ReferenceCycle('fixture',exchange,self.folder,apply=True)
        def response(day): return io.BytesIO(json.dumps([{'card_no':'12345678','expiration':day+' 23:59:59'}]).encode())
        with patch.dict(sys.modules,{'pyodbc':types.SimpleNamespace(connect=Mock(return_value=conn))}), \
             patch.object(cycle.module.urllib.request,'urlopen',side_effect=[response('2026-11-05'),response('2026-12-05')]) as api:
            cycle();cycle()
        self.assertEqual(2,api.call_count)
        self.assertEqual(['20261105','20261205'],[row['EndTime'] for row in panel.writes])
        self.assertEqual(dt.datetime(2026,12,5,23,59,59),conn.committed['12345678'][3])

    def test_invalid_api_never_opens_access_or_sdk(self):
        exchange=Mock();exchange.review=self.folder/'absent'
        cycle=candidate.ReferenceCycle('fixture',exchange,self.folder,apply=True)
        connect=Mock()
        with patch.dict(sys.modules,{'pyodbc':types.SimpleNamespace(connect=connect)}), \
             patch.object(cycle.module.urllib.request,'urlopen',return_value=io.BytesIO(b'[]')):
            with self.assertRaises(ValueError): cycle()
        connect.assert_not_called();exchange.assert_not_called()


if __name__ == '__main__':
    unittest.main()
