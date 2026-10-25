"""Contratos candidatos con datos e hijos ficticios; sin SDK, tareas ni red."""
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import control_operativo as control
import revisar_operacion as inspector
from salud_operativa import assess_components, assess_vigencias
from trabajador_controlado import ClosedWorker, SDKGate, UnsafeSDKClosure, run_closed_worker

NOW = dt.datetime(2026, 10, 25, 4, 40, tzinfo=dt.timezone.utc)
RUN = '50000000-0000-4000-8000-000000000001'
OLD = '50000000-0000-4000-8000-000000000002'


def at(seconds=0):
    return (NOW + dt.timedelta(seconds=seconds)).isoformat()


def state(**changes):
    return {'protocol': 2, 'pid': 42, 'run_id': RUN, 'phase': 'idle',
            'heartbeat_utc': at(-1), 'last_ok_utc': at(-60), 'consecutive_errors': 0} | changes


def runtime(**changes):
    return {'pid': 42, 'run_id': RUN, 'mode': 'operativo', 'lock_acquired': True,
            'sdk_closure': 'clean', 'heartbeat_utc': at(-1)} | changes


def components():
    return {'pid': 42, 'run_id': RUN, 'mode': 'operativo', 'heartbeat_utc': at(-1),
            'reader': {'state': 'status_observed', 'checked_at_utc': at(-1), 'error': None},
            'sender': {'pending_count': 0, 'oldest_pending_utc': None, 'paused': '', 'checked_at_utc': at(-1)}}


class Scratch(unittest.TestCase):
    def setUp(self):
        self.scratch = ROOT / 'datos' / 'pruebas_operacion'
        self.scratch.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=self.scratch)
        self.folder = Path(self.temp.name)
        self.children = []

    def tearDown(self):
        for child in self.children:
            if child.poll() is None:
                child.kill()  # Solo hijos creados por esta prueba.
            child.communicate(timeout=10)
        if not self.folder.resolve().is_relative_to(self.scratch.resolve()):
            raise RuntimeError('Temporal ajeno al ensayo.')
        self.temp.cleanup()


class MaintenanceTests(Scratch):
    def test_stop_is_bound_to_pid_and_run_and_rejects_boolean_pid(self):
        request = control.make_stop_request(state())
        self.assertTrue(control.matches_stop(state(), request))
        for other in ({'pid': 43, 'run_id': RUN}, {'pid': 42, 'run_id': OLD}, {'pid': 42},
                      {'pid': True, 'run_id': RUN}, request | {'extra': True}):
            self.assertFalse(control.matches_stop(state(), other))

    def test_r2_legacy_is_explicit_and_not_a_valid_operational_resume(self):
        legacy = state()
        legacy.pop('run_id')
        with self.assertRaises(ValueError):
            control.make_stop_request(legacy)
        self.assertEqual({'pid': 42}, control.make_stop_request(legacy, allow_legacy=True))
        self.assertFalse(control.matches_stop(legacy, {'pid': 42}))
        self.assertTrue(control.matches_stop(legacy, {'pid': 42}, allow_legacy=True))
        self.assertEqual('invalid_or_legacy_state', control.resume_check(legacy, runtime(), {'pid': 41}, 42, NOW))

    def test_stop_write_is_atomic_and_old_requests_do_not_match_next_run(self):
        control.write_stop(self.folder, state())
        request = json.loads((self.folder / 'detener.sync.json').read_text())
        self.assertEqual(control.identity(state()), request)
        self.assertFalse(control.matches_stop(state(run_id=OLD), request))
        self.assertEqual(['detener.sync.json'], [p.name for p in self.folder.iterdir()])

    def test_stopped_fault_and_malformed_state_cannot_receive_stop(self):
        for item in (state(phase='stopped'), state(phase='fault'), state(pid=True),
                     state(protocol=2.0), state(run_id='bad'), None):
            with self.subTest(item=item), self.assertRaises((ValueError, TypeError)):
                control.make_stop_request(item)

    def test_resume_requires_new_run_even_if_pid_changes(self):
        self.assertEqual('ready', control.resume_check(state(), runtime(), {'pid': 41, 'run_id': OLD}, 42, NOW))
        self.assertNotEqual('ready', control.resume_check(state(), runtime(), {'pid': 41, 'run_id': RUN}, 42, NOW))
        self.assertNotEqual('ready', control.resume_check(state(), runtime(), None, 42, NOW))

    def test_resume_requires_live_identity_fresh_state_and_operational_lock(self):
        for observed, detail, pid in (
            (state(), runtime(), 41), (state(), runtime(), True),
            (state(), runtime(mode='readonly'), 42), (state(), runtime(lock_acquired=False), 42),
            (state(), runtime(sdk_closure='unknown'), 42), (state(), runtime(run_id=OLD), 42),
            (state(heartbeat_utc=at(-16)), runtime(), 42), (state(), runtime(heartbeat_utc=at(1)), 42),
            (state(phase='stopped'), runtime(), 42), (state(), runtime(pid=True), 42)):
            with self.subTest(observed=observed, detail=detail, pid=pid):
                self.assertNotEqual('ready', control.resume_check(observed, detail, {'pid': 41, 'run_id': OLD}, pid, NOW))

    def test_transition_from_legacy_previous_identity_must_be_explicit(self):
        self.assertNotEqual('ready', control.resume_check(state(), runtime(), {'pid': 41}, 42, NOW))
        self.assertEqual('ready', control.resume_check(state(), runtime(), {'pid': 41}, 42, NOW, allow_legacy_previous=True))

    def test_invalid_previous_identity_or_freshness_cannot_approve_resume(self):
        for previous in (None, {}, {'pid': True, 'run_id': OLD}, {'pid': 41, 'run_id': 'bad'},
                         {'pid': 41, 'run_id': OLD, 'extra': True}):
            self.assertNotEqual('ready', control.resume_check(state(), runtime(), previous, 42, NOW))
        for age in (float('nan'), float('inf'), True, -1, '15'):
            self.assertNotEqual('ready', control.resume_check(state(), runtime(), {'pid': 41, 'run_id': OLD}, 42, NOW, max_age=age))

    def test_pause_requires_target_identity_exit_clean_sdk_and_free_lock(self):
        stopped = state(phase='stopped')
        params = dict(process_present=False, lock_free=True, sdk_closure='clean', revision_pending=False)
        self.assertEqual('ready', control.pause_check(stopped, control.identity(stopped), **params))
        for change in ({'process_present': True}, {'process_present': None}, {'lock_free': False},
                       {'lock_free': None}, {'sdk_closure': 'unknown'}, {'revision_pending': True}):
            self.assertNotEqual('ready', control.pause_check(stopped, control.identity(stopped), **(params | change)))
        self.assertNotEqual('ready', control.pause_check(stopped, {'pid': 42, 'run_id': OLD}, **params))
        self.assertNotEqual('ready', control.pause_check(state(), control.identity(state()), **params))


class HealthTests(unittest.TestCase):
    def health(self, current=None, **kwargs):
        return assess_vigencias(state() if current is None else current, at(-1200), NOW,
            task_state='Running', process_pid=42, **kwargs)

    def test_recent_cycle_and_activity_are_healthy_without_mutating_inputs(self):
        current, detail = state(), components()
        before = copy.deepcopy((current, detail))
        self.assertEqual('correcto', self.health(current)['status'])
        self.assertEqual('correcto', assess_components(current, detail, NOW)['reader']['status'])
        self.assertEqual('sin_pendientes', assess_components(current, detail, NOW)['sender']['status'])
        self.assertEqual(before, (current, detail))

    def test_rt_success_does_not_hide_failed_vigencias(self):
        current = state(last_ok_utc=at(-301), consecutive_errors=2, heartbeat_utc=at(-1))
        self.assertEqual('alerta', self.health(current)['status'])
        self.assertEqual('correcto', assess_components(current, components(), NOW)['reader']['status'])

    def test_heartbeat_stale_future_missing_and_malformed_are_not_healthy(self):
        for heartbeat in (at(-301), at(1), None, 'bad', '2026-10-25T04:39:59'):
            with self.subTest(heartbeat=heartbeat):
                self.assertNotEqual('correcto', self.health(state(heartbeat_utc=heartbeat))['status'])
        # A fresh startup baseline must not turn a missing heartbeat into success.
        value = assess_vigencias(state(heartbeat_utc=None), at(-1), NOW, task_state='Running', process_pid=42)
        self.assertNotEqual('correcto', value['status'])

    def test_restarting_does_not_restart_success_timeout(self):
        self.assertEqual('alerta', self.health(state(run_id=OLD, last_ok_utc=None))['status'])
        value = assess_vigencias(state(last_ok_utc=None), at(-1), NOW, task_state='Running', process_pid=42)
        self.assertEqual('iniciando', value['status'])
        value = assess_vigencias(state(last_ok_utc=None, consecutive_errors=1), at(-1), NOW, task_state='Running', process_pid=42)
        self.assertEqual('degradado', value['status'])

    def test_maintenance_requires_disabled_task_and_active_record(self):
        good = assess_vigencias(None, at(-1200), NOW, task_state='Disabled', maintenance_active=True)
        self.assertEqual('mantenimiento', good['status'])
        for task, active in (('Disabled', False), ('Running', True), ('Missing', False)):
            value = assess_vigencias(state(), at(-1200), NOW, task_state=task, maintenance_active=active, process_pid=42)
            self.assertEqual('desconocido', value['status'])

    def test_no_state_wrong_process_unexpected_stop_and_invalid_errors(self):
        self.assertEqual('alerta', assess_vigencias(None, at(-301), NOW, task_state='Running')['status'])
        self.assertEqual('desconocido', assess_vigencias(state(), at(-1200), NOW, task_state='Running', process_pid=43)['status'])
        for current in (state(phase='stopped'), state(phase='fault'), state(consecutive_errors='0')):
            self.assertNotEqual('correcto', self.health(current)['status'])

    def test_absent_legacy_and_malformed_components_have_distinct_reasons(self):
        self.assertEqual('components_absent', assess_components(state(), None, NOW)['reader']['reason'])
        legacy = state()
        legacy.pop('run_id')
        self.assertEqual('legacy_run_without_components_identity', assess_components(legacy, components(), NOW)['reader']['reason'])
        bad = components()
        bad.pop('heartbeat_utc')
        self.assertEqual('invalid_components', assess_components(state(), bad, NOW)['reader']['reason'])

    def test_other_execution_readonly_future_or_stale_components_are_not_healthy(self):
        for change in ({'run_id': OLD}, {'pid': 43}, {'mode': 'readonly'},
                       {'heartbeat_utc': at(1)}, {'heartbeat_utc': at(-301)}):
            detail = components() | change
            self.assertEqual('desconocido', assess_components(state(), detail, NOW)['reader']['status'])

    def test_expected_reader_pause_is_separate_from_sender_backlog(self):
        detail = components()
        detail['reader']['state'] = 'paused'
        detail['sender'].update(pending_count=5, oldest_pending_utc=at(-60))
        report = assess_components(state(phase='cycle'), detail, NOW)
        self.assertEqual('pausado', report['reader']['status'])
        self.assertEqual('pendiente', report['sender']['status'])
        detail['sender']['oldest_pending_utc'] = at(-301)
        self.assertEqual('degradado', assess_components(state(), detail, NOW)['sender']['status'])

    def test_malformed_sender_does_not_hide_reader_error_and_vice_versa(self):
        detail = components()
        detail['reader']['error'] = 'disk_full_fixture'
        detail['sender']['pending_count'] = 'bad'
        report = assess_components(state(), detail, NOW)
        self.assertEqual('degradado', report['reader']['status'])
        self.assertEqual('desconocido', report['sender']['status'])
        detail = components()
        detail['reader']['checked_at_utc'] = 'bad'
        self.assertEqual('sin_pendientes', assess_components(state(), detail, NOW)['sender']['status'])

    def test_sender_pause_stale_or_inconsistent_pending_is_not_success(self):
        for change in ({'paused': 'fixture'}, {'checked_at_utc': at(-301)},
                       {'oldest_pending_utc': at(-1)}, {'pending_count': True}):
            detail = components()
            detail['sender'].update(change)
            self.assertNotEqual('sin_pendientes', assess_components(state(), detail, NOW)['sender']['status'])


class WorkerTests(Scratch):
    def fake_command(self, source):
        path = self.folder / 'fake_worker.py'
        path.write_text(source, encoding='utf-8')
        return [sys.executable, '-B', str(path)]

    def invoke(self, gate, command, **kwargs):
        actual = subprocess.Popen
        def launch(*args, **options):
            child = actual(*args, **options)
            self.children.append(child)
            return child
        with patch('trabajador_controlado.subprocess.Popen', side_effect=launch):
            return run_closed_worker(gate, 'vigencias', command, **kwargs)

    def test_gate_denies_overlapping_turns_and_latches_unclean_close(self):
        gate = SDKGate()
        gate.acquire('rt')
        with self.assertRaises(RuntimeError):
            gate.acquire('vigencias')
        gate.release('rt', clean=False)
        self.assertTrue(gate.fault)
        with self.assertRaises(UnsafeSDKClosure):
            gate.acquire('vigencias')

    def test_wrong_owner_cannot_release_another_turn(self):
        gate = SDKGate()
        gate.acquire('rt')
        with self.assertRaises(UnsafeSDKClosure):
            gate.release('vigencias', clean=True)
        with self.assertRaises(UnsafeSDKClosure):
            gate.acquire('rt')

    def test_threads_cannot_acquire_two_sdk_turns(self):
        gate, barrier, answers = SDKGate(), threading.Barrier(3), []
        def acquire(role):
            barrier.wait(timeout=5)
            try:
                gate.acquire(role)
                answers.append(role)
            except RuntimeError:
                answers.append('denied')
        threads = [threading.Thread(target=acquire, args=(role,)) for role in ('rt', 'vigencias')]
        for thread in threads:
            thread.start()
        barrier.wait(timeout=5)
        for thread in threads:
            thread.join(timeout=5)
        self.assertEqual(1, answers.count('denied'))
        gate.release(gate.active, clean=True)

    def test_real_fake_worker_exit_and_receipt_are_required_and_secrets_not_inherited(self):
        command = self.fake_command("import json, os\nprint(json.dumps({'closed':True,'pid':os.getpid(),'secret':any(k.upper().startswith('SANISIDRO_') for k in os.environ)}))\n")
        gate = SDKGate()
        def verify(worker):
            receipt = json.loads(worker.stdout)
            return receipt == {'closed': True, 'pid': worker.pid, 'secret': False}
        with patch.dict(os.environ, {'SANISIDRO_ACCESS_PASSWORD': 'fixture_only', 'SANISIDRO_API_TOKEN': 'fixture_only'}):
            closed = self.invoke(gate, command, verify_closed=verify, timeout=10)
        self.assertEqual(0, closed.returncode)
        self.assertIsNone(gate.active)
        self.assertFalse(gate.fault)
        self.assertNotIn('closed', repr(closed))
        gate.acquire('rt')
        gate.release('rt', clean=True)

    def test_zero_exit_without_receipt_blocks_next_sdk_turn(self):
        gate = SDKGate()
        with self.assertRaises(UnsafeSDKClosure):
            self.invoke(gate, self.fake_command("print('no receipt')\n"), verify_closed=lambda worker: False, timeout=10)
        with self.assertRaises(UnsafeSDKClosure):
            gate.acquire('rt')

    def test_nonzero_exit_blocks_sdk_even_if_receipt_callback_accepts(self):
        gate = SDKGate()
        with self.assertRaises(UnsafeSDKClosure):
            self.invoke(gate, self.fake_command('raise SystemExit(7)\n'), verify_closed=lambda worker: True, timeout=10)
        self.assertTrue(gate.fault)

    def test_timeout_kills_only_owned_fake_child_and_blocks_sdk(self):
        gate = SDKGate()
        with self.assertRaises(UnsafeSDKClosure):
            self.invoke(gate, self.fake_command('import time\ntime.sleep(30)\n'), verify_closed=lambda worker: True, timeout=.3)
        self.assertEqual(1, len(self.children))
        self.assertIsNotNone(self.children[0].poll())
        self.assertTrue(gate.fault)

    def test_verifier_exception_blocks_sdk_and_excludes_sensitive_output_from_error(self):
        gate = SDKGate()
        with self.assertRaises(UnsafeSDKClosure) as caught:
            self.invoke(gate, self.fake_command("print('private_fixture')\n"),
                        verify_closed=Mock(side_effect=ValueError('private_fixture')), timeout=10)
        self.assertNotIn('private_fixture', str(caught.exception))
        self.assertTrue(gate.fault)

    def test_failure_before_child_creation_releases_turn_without_fault(self):
        gate = SDKGate()
        with patch('trabajador_controlado.subprocess.Popen', side_effect=FileNotFoundError('fixture')):
            with self.assertRaises(FileNotFoundError):
                run_closed_worker(gate, 'vigencias', ['fake_executable'], verify_closed=lambda worker: True)
        self.assertFalse(gate.fault)
        self.assertIsNone(gate.active)


class InspectorTests(Scratch):
    def test_fixture_inspection_uses_no_sdk_tasks_network_or_private_files(self):
        sync, gestor = self.folder / 'sync', self.folder / 'gestor'
        (sync / 'registros').mkdir(parents=True)
        gestor.mkdir()
        instant = dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=1)
        fixture = state(last_ok_utc=instant.isoformat(), heartbeat_utc=instant.isoformat())
        fixture.pop('run_id')
        fixture['unexpected_private_field'] = 'not_for_output'
        files = {
            sync / 'registros' / 'estado.json': fixture,
            sync / 'registros' / 'vigilancia.json': {'checked_utc': instant.isoformat(), 'status': 'correcto',
                'enabled_since_utc': (instant - dt.timedelta(minutes=2)).isoformat()},
            sync / 'vigilancia-config.json': {'minutes': 5, 'repeat_minutes': 15, 'popup': True},
            gestor / 'mantenimiento.json': {'active': False},
        }
        for path, value in files.items():
            path.write_text(json.dumps(value), encoding='utf-8')
        marker = sync / 'fixture_source.py'
        marker.write_bytes(b'fixture')
        expected = {'fixture_source': (marker, hashlib.sha256(b'fixture').hexdigest())}
        inventory = {'tasks': [{'name': 'SanIsidro-Vigencias', 'state': 'Running', 'enabled': True}], 'polling_pids': [42]}
        with patch.object(inspector, 'ROOT', self.folder), patch.object(inspector, 'SYNC', sync), \
             patch.object(inspector, 'GESTOR', gestor), patch.object(inspector, 'EXPECTED', expected), \
             patch.object(inspector, 'verify_package'), patch.object(inspector, 'task_inventory', return_value=inventory), \
             patch('subprocess.Popen', side_effect=AssertionError('No real processes in fixture inspection')):
            report = inspector.inspect()
        self.assertEqual('correcto', report['vigencias_evaluadas']['status'])
        self.assertTrue(report['installed_hashes']['fixture_source']['matches_reference'])
        self.assertFalse(report['candidate_linked'])
        self.assertEqual([], report['read_errors'])
        self.assertNotIn('not_for_output', json.dumps(report))
        self.assertEqual('components_absent', report['componentes_evaluados']['reader']['reason'])


if __name__ == '__main__':
    unittest.main()
