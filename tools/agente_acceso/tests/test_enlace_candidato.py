"""Controles sobre estados, SQLite y procesos ficticios; sin SDK ni tareas reales."""
import contextlib
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import enlace_candidato as link
ORIGINAL_INVENTORY = link.inventory

NOW = dt.datetime(2026, 10, 25, 7, 10, tzinfo=dt.timezone.utc)
RUN = '60000000-0000-4000-8000-000000000001'
OTHER = '60000000-0000-4000-8000-000000000002'


def at(seconds=0):
    return (NOW + dt.timedelta(seconds=seconds)).isoformat()


def state(**changes):
    return {'scope': 'ensayo_coordinador_sin_escrituras_sdk', 'adapter_version': '2026.10.24-1',
            'pid': 42, 'run_id': RUN, 'phase': 'stopped', 'stop_reason': 'limit',
            'started_utc': at(-150), 'heartbeat_utc': at(-1),
            'sdk_gate': {'fault': False, 'active': None},
            'cycle_probe': {'completed': 1, 'total_errors': 0},
            'reader_error': None, 'storage_error': None} | changes


class Fixture(unittest.TestCase):
    def setUp(self):
        self.scratch = ROOT / 'datos' / 'pruebas_enlace'
        self.scratch.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=self.scratch)
        self.folder = Path(self.temp.name)
        self.sync, self.gestor, self.data = [self.folder / name for name in ('sync', 'gestor', 'data')]
        self.close = self.folder / 'cierres_fuentes'
        for folder in (self.sync, self.gestor, self.data, self.close, self.sync / 'registros'):
            folder.mkdir(exist_ok=True)
        (self.sync / 'sync.lock').write_bytes(b'0')
        (self.gestor / 'mantenimiento.ps1').write_bytes(b'gestor_ficticio_no_ejecutable')
        self.digest = hashlib.sha256((self.gestor / 'mantenimiento.ps1').read_bytes()).hexdigest()
        self.module = types.SimpleNamespace(check_ledger=Mock(return_value=1))
        self.inv = {'tasks': [{'name': 'SanIsidro-Vigencias', 'state': 'Disabled', 'enabled': False}], 'processes': []}
        for name, value in {'SYNC': self.sync, 'GESTOR': self.gestor, 'DATA': self.data,
                            'STATE': self.data / 'estado_cierres.json', 'CLOSE': self.close,
                            'MAINTENANCE_HASH': self.digest}.items():
            self.enterContext(patch.object(link, name, value))
        self.enterContext(patch.object(link, 'now', return_value=NOW))
        self.inventory = self.enterContext(patch.object(link, 'inventory', side_effect=lambda: copy.deepcopy(self.inv)))
        self.enterContext(patch.object(link, 'closure_module', return_value=self.module))
        self.write(link.STATE, state())
        self.write(self.gestor / 'mantenimiento.json', {'active': True, 'wasEnabled': True})
        self.receipt()

    def tearDown(self):
        if not self.folder.resolve().is_relative_to(self.scratch.resolve()):
            raise RuntimeError('Temporal ajeno al ensayo.')
        self.temp.cleanup()

    def write(self, path, value):
        path.write_text(json.dumps(value), encoding='utf-8')

    def receipt(self, run=RUN):
        folder = self.data / 'cierres' / '60000000-0000-4000-8000-000000000003'
        folder.mkdir(parents=True, exist_ok=True)
        self.write(folder / 'request.json', {'run_id': run, 'role': 'vigencias'})
        return folder

    def running(self):
        value = state(phase='waiting', stop_reason=None)
        self.write(link.STATE, value)
        self.inv['processes'] = [{'pid': 42, 'role': 'trial', 'created_utc': at(-151)}]
        return value

    def database(self, agent='c8d7ccdc-991f-497c-8383-92fb52921f8a'):
        with contextlib.closing(sqlite3.connect(self.data / 'outbox.sqlite')) as db, db:
            db.execute('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT)')
            db.executemany('INSERT INTO meta VALUES(?,?)', [('agent_id', agent), ('device_serial', 'CO2K225060027'), ('paused', '')])
            db.execute('CREATE TABLE messages(id TEXT PRIMARY KEY,state TEXT)')
            db.execute('CREATE TABLE responses(id TEXT PRIMARY KEY,message_id TEXT)')
            db.execute("INSERT INTO messages VALUES('m1','acked')")
            db.execute("INSERT INTO responses VALUES('r1','m1')")

    def healthy(self):
        self.database()
        self.inv = {'tasks': [{'name': 'SanIsidro-Vigencias', 'state': 'Running', 'enabled': True}],
                    'processes': [{'pid': 77, 'role': 'polling'}]}
        self.write(self.sync / 'registros' / 'estado.json', {'protocol': 2, 'pid': 77, 'phase': 'idle',
            'last_ok_utc': at(-60), 'heartbeat_utc': at(-1), 'consecutive_errors': 0})
        self.write(self.sync / 'registros' / 'vigilancia.json', {'enabled_since_utc': at(-600)})
        self.write(self.sync / 'vigilancia-config.json', {'minutes': 5, 'repeat_minutes': 15, 'popup': True})
        self.write(self.gestor / 'mantenimiento.json', {'active': False})


class StopTests(Fixture):
    def test_stop_bound_to_pid_and_run(self):
        self.running()
        result = link.request_stop()
        self.assertEqual(result['status'], 'parada_solicitada')
        self.assertEqual(link.read(self.data / 'detener_cierres.json'), {'pid': 42, 'run_id': RUN})
        self.assertNotIn('cierre_confirmado', json.dumps(result))

    def test_pid_mismatch_and_reuse_block_stop(self):
        self.running()
        self.inv['processes'][0]['created_utc'] = at(-149)
        with self.assertRaises(RuntimeError): link.request_stop()
        self.inv['processes'][0] |= {'pid': 43, 'created_utc': at(-151)}
        with self.assertRaises(RuntimeError): link.request_stop()
        self.assertFalse((self.data / 'detener_cierres.json').exists())

    def test_multiple_trials_and_no_process_block(self):
        self.running()
        self.inv['processes'] *= 2
        with self.assertRaises(RuntimeError): link.request_stop()
        self.inv['processes'] = []
        with self.assertRaises(RuntimeError): link.request_stop()

    def test_stopped_fault_bad_identity_block(self):
        for changes in ({'phase': 'stopped'}, {'phase': 'fault'}, {'pid': True}, {'run_id': 'bad'}):
            with self.subTest(changes=changes):
                self.running()
                self.write(link.STATE, state(phase='waiting') | changes)
                with self.assertRaises((RuntimeError, ValueError)): link.request_stop()

    def test_changed_execution_during_inventory_does_not_write(self):
        self.running()
        def change():
            self.write(link.STATE, state(phase='waiting', run_id=OTHER))
            return copy.deepcopy(self.inv)
        self.inventory.side_effect = change
        with self.assertRaises(RuntimeError): link.request_stop()
        self.assertFalse((self.data / 'detener_cierres.json').exists())

    def test_started_in_future_blocked(self):
        self.running()
        self.write(link.STATE, state(phase='waiting', started_utc=at(10)))
        self.inv['processes'][0]['created_utc'] = at(9)
        with self.assertRaises(RuntimeError): link.request_stop()


class ClosureTests(Fixture):
    def test_clean_close_requires_ledger_and_existing_lock(self):
        result = link.stopped_check()
        self.assertEqual(result['status'], 'cierre_confirmado')
        self.module.check_ledger.assert_called_once_with(self.data / 'cierres')
        self.assertEqual((self.sync / 'sync.lock').read_bytes(), b'0')

    def test_live_pid_even_reused_by_native_process_blocks(self):
        self.inv['processes'] = [{'pid': 42, 'role': 'external'}]
        with self.assertRaises(RuntimeError): link.stopped_check()
        self.module.check_ledger.assert_not_called()

    def test_other_sdk_or_unknown_python_blocks(self):
        for role in ('trial', 'polling', 'zkaccess', 'other_sanisidro', 'unclassified_python'):
            with self.subTest(role=role):
                self.inv['processes'] = [{'pid': 55, 'role': role}]
                with self.assertRaises(RuntimeError): link.stopped_check()

    def test_revision_and_sdk_fault_block(self):
        path = self.gestor / 'revision_pendiente.json'
        self.write(path, {'pending': True})
        with self.assertRaises(RuntimeError): link.stopped_check()
        path.unlink()
        self.write(link.STATE, state(sdk_gate={'fault': True, 'active': None}))
        with self.assertRaises(RuntimeError): link.stopped_check()

    def test_unclean_stop_and_active_worker_block(self):
        for changes in ({'stop_reason': 'KeyboardInterrupt'}, {'phase': 'waiting'},
                        {'sdk_gate': {'fault': False, 'active': 'rt'}}):
            with self.subTest(changes=changes):
                self.write(link.STATE, state(**changes))
                with self.assertRaises(RuntimeError): link.stopped_check()

    def test_missing_or_occupied_lock_block_without_deleting(self):
        path = self.sync / 'sync.lock'
        with link.existing_lock():
            with self.assertRaises(OSError): link.stopped_check()
        self.assertEqual(path.read_bytes(), b'0')
        path.unlink()
        with self.assertRaises(OSError): link.stopped_check()
        self.assertFalse(path.exists())

    def test_bad_ledger_blocks(self):
        self.module.check_ledger.side_effect = RuntimeError('recibo ficticio incompleto')
        with self.assertRaises(RuntimeError): link.stopped_check()

    def test_changed_gate_during_proof_blocks(self):
        def change(_):
            self.write(link.STATE, state(sdk_gate={'fault': True, 'active': None}))
            return 1
        self.module.check_ledger.side_effect = change
        with self.assertRaises(RuntimeError): link.stopped_check()

    def test_only_previous_run_receipts_do_not_prove_current_cycles(self):
        self.receipt(OTHER)
        with self.assertRaises(RuntimeError): link.stopped_check()

    def test_empty_ledger_does_not_prove_completed_cycle(self):
        (self.receipt() / 'request.json').unlink()
        self.module.check_ledger.return_value = 0
        with self.assertRaises(RuntimeError): link.stopped_check()


class PauseHealthTests(Fixture):
    def test_pause_keeps_active_polling_until_legacy_delegate(self):
        self.inv['processes'] = [{'pid': 77, 'role': 'polling'}]
        self.assertEqual(link.prepare_check()['status'], 'precondiciones_pausa_verificadas')

    def test_pause_rejects_changed_installed_script(self):
        (self.gestor / 'mantenimiento.ps1').write_bytes(b'otra version ficticia')
        with self.assertRaises(ValueError): link.prepare_check()

    def test_pause_rejects_trial_running(self):
        self.running()
        with self.assertRaises(RuntimeError): link.prepare_check()

    def test_readonly_database_preserved_and_identity_required(self):
        self.database()
        path = self.data / 'outbox.sqlite'
        before = hashlib.sha256(path.read_bytes()).digest()
        result = link.outbox_health()
        self.assertEqual(result['responses'], 1)
        self.assertEqual(result['pending_count'], 0)
        self.assertEqual(before, hashlib.sha256(path.read_bytes()).digest())
        with contextlib.closing(sqlite3.connect(path)) as db, db:
            db.execute("UPDATE meta SET value='otro-agente' WHERE key='agent_id'")
        with self.assertRaises(ValueError): link.outbox_health()

    def test_missing_database_not_initialized(self):
        with self.assertRaises(sqlite3.Error): link.outbox_health()
        self.assertFalse((self.data / 'outbox.sqlite').exists())

    def test_health_keeps_readonly_separate_from_operational(self):
        self.healthy()
        result = link.health()
        self.assertEqual(result['vigencias']['status'], 'correcto')
        self.assertEqual(result['ensayo']['status'], 'detenido_sin_verificar_cierre')
        self.assertEqual(result['read_errors'], [])
        self.module.check_ledger.assert_not_called()
        self.assertFalse(result['installed_watchdog_replaced'])

    def test_successful_readonly_does_not_hide_stale_vigencias(self):
        self.healthy()
        path = self.sync / 'registros' / 'estado.json'
        self.write(path, link.read(path) | {'last_ok_utc': at(-400)})
        result = link.health()
        self.assertEqual(result['vigencias']['status'], 'alerta')
        self.assertEqual(result['vigencias']['reason'], 'no_recent_successful_cycle')

    def test_invalid_config_is_unknown(self):
        self.healthy()
        self.write(self.sync / 'vigilancia-config.json', {'minutes': True})
        self.assertEqual(link.health()['vigencias']['status'], 'desconocido')

    def test_invalid_state_is_not_healthy(self):
        self.healthy()
        self.write(link.STATE, {'phase': 'stopped'})
        result = link.health()
        self.assertEqual(result['ensayo']['status'], 'desconocido')
        self.assertIn('identidad_ensayo', [item['source'] for item in result['read_errors']])

    def test_future_heartbeat_does_not_look_active(self):
        self.healthy()
        self.write(link.STATE, state(phase='waiting', heartbeat_utc=at(30)))
        self.inv['processes'].append({'pid': 42, 'role': 'trial', 'created_utc': at(-151)})
        self.assertEqual(link.health()['ensayo']['status'], 'sin_actividad_confirmada')


class InventoryTests(Fixture):
    def query(self, rows):
        result = subprocess.CompletedProcess([], 0, json.dumps({'tasks': [], 'processes': rows}).encode(), b'')
        with patch.object(link.subprocess, 'run', return_value=result) as run:
            output = ORIGINAL_INVENTORY()
            self.last_call = run.call_args
            return output

    def row(self, command, pid=50, name='python.exe'):
        return {'pid': pid, 'name': name, 'command': command, 'created_utc': at(-151)}

    def test_exact_polling_and_trial_paths(self):
        rows = self.query([
            self.row(f'python.exe -B "{self.sync / "sincronizar_vigencias.py"}" --aplicar --continuo'),
            self.row(f'python.exe -B "{self.close / "ensayo_cierres.py"}" --mantenimiento --seconds 150', pid=51)])
        self.assertEqual([r['role'] for r in rows['processes']], ['polling', 'trial'])

    def test_incidental_path_is_not_an_entrypoint(self):
        rows = self.query([self.row(f'python.exe -c "{self.close / "ensayo_cierres.py"}" --mantenimiento')])
        self.assertNotEqual(rows['processes'][0]['role'], 'trial')

    def test_quoted_path_with_spaces_uses_windows_parser(self):
        args = link.argv_windows('python.exe -B "C:\\ruta con espacios\\lectura.py" --seconds 150')
        self.assertEqual(args[2], r'C:\ruta con espacios\lectura.py')

    def test_missing_command_is_unclassified(self):
        rows = self.query([self.row(None)])
        self.assertEqual(rows['processes'][0]['role'], 'unclassified_python')

    def test_other_native_pid_retained_for_reuse_detection(self):
        rows = self.query([self.row(None, pid=42, name='notepad.exe'), self.row(None, pid=0, name='System Idle Process')])
        self.assertEqual([r['pid'] for r in rows['processes']], [42, 0])

    def test_different_script_never_trial(self):
        rows = self.query([self.row(f'python.exe -B "{self.close / "otro.py"}" --mantenimiento')])
        self.assertNotEqual(rows['processes'][0]['role'], 'trial')

    def test_inventory_child_environment_filtered_and_hidden(self):
        with patch.dict(os.environ, {'SANISIDRO_FIXTURE': 'dato_ficticio'}):
            self.query([])
        self.assertNotIn('SANISIDRO_FIXTURE', self.last_call.kwargs['env'])
        self.assertEqual(self.last_call.kwargs['creationflags'], subprocess.CREATE_NO_WINDOW)

    def test_failed_inventory_and_timeout_fail_closed(self):
        with patch.object(link.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, b'', b'')):
            with self.assertRaises(RuntimeError): ORIGINAL_INVENTORY()
        with patch.object(link.subprocess, 'run', side_effect=subprocess.TimeoutExpired('ficticio', 25)):
            with self.assertRaises(subprocess.TimeoutExpired): ORIGINAL_INVENTORY()


class DispatchTests(Fixture):
    def test_resume_precondition_requires_clean_close(self):
        self.assertEqual(link.dispatch('previo_reanudar')['status'], 'cierre_confirmado')

    def test_resume_without_active_maintenance_blocked(self):
        self.write(self.gestor / 'mantenimiento.json', {'active': False})
        with self.assertRaises(RuntimeError): link.dispatch('previo_reanudar')

    def test_resume_with_changed_installed_hash_blocked(self):
        (self.gestor / 'mantenimiento.ps1').write_bytes(b'otra version')
        with self.assertRaises(ValueError): link.dispatch('previo_reanudar')

    def test_resume_with_pending_revision_blocked(self):
        self.write(self.gestor / 'revision_pendiente.json', {'pending': True})
        with self.assertRaises(RuntimeError): link.dispatch('previo_reanudar')

    def test_stop_route_is_not_resume(self):
        self.running()
        self.assertEqual(link.dispatch('detener')['status'], 'parada_solicitada')
        self.module.check_ledger.assert_not_called()

    def test_unknown_action_does_not_fall_back_to_resume(self):
        with self.assertRaises(ValueError): link.dispatch('aplicar')
        self.module.check_ledger.assert_not_called()


class PowerShellTests(Fixture):
    def test_shared_control_functions_with_fictitious_delegates(self):
        process = subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
            str(ROOT / 'tests' / 'enlace_ficticio.ps1'), '-Scratch', str(self.folder / 'ps'), '-Python', sys.executable],
            capture_output=True, timeout=45, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
            env={k: v for k, v in os.environ.items() if not k.upper().startswith('SANISIDRO_')})
        # Este script solo usa callbacks ficticios, locks temporales y un hijo Python propio.
        text = process.stdout.decode('utf-8-sig', errors='replace').strip()
        self.assertEqual(process.returncode, 0, text + process.stderr.decode(errors='replace'))
        report = json.loads(text)
        self.assertEqual(report['checks'], 14)
        self.assertEqual(report['failures'], 0, report)


if __name__ == '__main__':
    unittest.main()
