"""Control del ensayo de cierres y lectura de salud; no aplica fechas ni usa SDK."""
import argparse
import contextlib
import ctypes
from ctypes import wintypes
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import uuid

from control_operativo import stamp
from salud_operativa import assess_vigencias

ROOT = Path(__file__).resolve().parent
SYNC = Path(r'C:\SanIsidro\ZKSync')
GESTOR = Path(r'C:\SanIsidro\GestionTags')
CLOSE = Path(r'C:\SanIsidro\CierresCoordinador_20261024')
DATA = Path(r'C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento')
STATE = DATA / 'estado_cierres.json'
RELEASE = '2026.10.25-2'
MAINTENANCE_HASH = '840c500933e644fb9545c88091a287416a018b7c3e16434d634138531b97b4f4'
FILES = {'enlace_candidato.py', 'panel_coordinador.ps1', 'mantenimiento_candidato.ps1',
         'control_operativo.py', 'salud_operativa.py', 'verificar_enlace.ps1', 'LEEME_ENLACE.md',
         'cierres_manifest_referencia.json', 'enlace_funciones.ps1', 'simular_enlace.py',
         'tests/test_enlace_candidato.py', 'tests/enlace_ficticio.ps1'}


def now():
    return dt.datetime.now(dt.timezone.utc)


def read(path, limit=131072):
    path = Path(path)
    if path.stat().st_size > limit:
        raise ValueError('Estado excede limite.')
    value = json.loads(path.read_text(encoding='utf-8-sig'))
    if not isinstance(value, dict):
        raise ValueError('Objeto requerido.')
    return value


def save(path, value):
    path = Path(path)
    temp = path.with_name(path.name + '.' + str(uuid.uuid4()) + '.tmp')
    with temp.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)


def verify_package():
    manifest = read(ROOT / 'ENLACE_SHA256SUMS.json')
    rows = manifest['files']
    if manifest['release'] != RELEASE or len(rows) != len(FILES) or {r['name'] for r in rows} != FILES:
        raise ValueError('Manifiesto inesperado.')
    for row in rows:
        if hashlib.sha256((ROOT / row['name']).read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Fuente distinta del paquete.')


def closure_module():
    # Comparar con lista congelada incluida, no confiar en un manifiesto remoto modificado.
    reference = read(ROOT / 'cierres_manifest_referencia.json')
    if read(CLOSE / 'CIERRES_SHA256SUMS.json') != reference:
        raise ValueError('Paquete de cierres distinto de referencia.')
    for row in reference['files']:
        if hashlib.sha256((CLOSE / row['name']).read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Fuente de cierres alterada.')
    sys.path.insert(0, str(CLOSE))
    try:
        import adaptadores_cierre
        return adaptadores_cierre
    finally:
        sys.path.pop(0)


def argv_windows(command):
    if not isinstance(command, str) or not command:
        raise ValueError('Linea de proceso ausente.')
    shell = ctypes.WinDLL('shell32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    shell.CommandLineToArgvW.argtypes = [wintypes.LPCWSTR, ctypes.POINTER(ctypes.c_int)]
    shell.CommandLineToArgvW.restype = ctypes.POINTER(wintypes.LPWSTR)
    kernel.LocalFree.argtypes = [wintypes.HLOCAL]
    kernel.LocalFree.restype = wintypes.HLOCAL
    count = ctypes.c_int()
    pointer = shell.CommandLineToArgvW(command, ctypes.byref(count))
    if not pointer:
        raise ValueError('No se pudo analizar proceso.')
    try:
        return [pointer[i] for i in range(count.value)]
    finally:
        kernel.LocalFree(ctypes.cast(pointer, wintypes.HLOCAL))


def inventory():
    # Lineas de comando solo para validar internamente; nunca se imprimen ni persisten.
    source = r'''$ErrorActionPreference='Stop'
$enTasks = foreach($enName in @('SanIsidro-Vigencias','SanIsidro-Vigilancia')) {
    $enTask=Get-ScheduledTask -TaskName $enName -ErrorAction SilentlyContinue
    if($null -eq $enTask){[pscustomobject]@{name=$enName;state='Missing';enabled=$null}}
    else{[pscustomobject]@{name=$enName;state=$enTask.State.ToString();enabled=[bool]$enTask.Settings.Enabled}}
}
$enProcesses=@(Get-CimInstance Win32_Process | ForEach-Object {
    $enCommand=$null
    if($_.Name -in @('python.exe','pythonw.exe')){$enCommand=$_.CommandLine}
    [pscustomobject]@{pid=[int]$_.ProcessId;name=$_.Name;command=$enCommand;
        created_utc=if($null -ne $_.CreationDate){$_.CreationDate.ToUniversalTime().ToString('o')}else{$null}}
})
[pscustomobject]@{tasks=@($enTasks);processes=$enProcesses} | ConvertTo-Json -Depth 5 -Compress
'''
    process = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', source],
        capture_output=True, timeout=25,
        env={key: val for key, val in os.environ.items() if not key.upper().startswith('SANISIDRO_')},
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if process.returncode:
        raise RuntimeError('Inventario de tareas/procesos no confirmado.')
    value = json.loads(process.stdout.decode('utf-8-sig'))
    if not isinstance(value.get('tasks'), list) or not isinstance(value.get('processes'), list):
        raise ValueError('Inventario invalido.')
    for row in value['processes']:
        if type(row.get('pid')) is not int or row['pid'] < 0:
            raise ValueError('PID invalido.')
        row['role'] = 'external'
        if row['pid'] == os.getpid():
            row['role'] = 'control'
        elif row['name'].lower() in ('access.exe', 'zkaccess.exe', 'zkaccess3.5.exe'):
            row['role'] = 'zkaccess'
        elif row['name'].lower() in ('python.exe', 'pythonw.exe'):
            try:
                args = argv_windows(row['command'])
            except ValueError:
                row['role'] = 'unclassified_python'
                continue
            scripts = [Path(arg) for arg in args[1:] if arg.lower().endswith('.py')]
            script_positions = [i for i, arg in enumerate(args[1:], 1) if arg.lower().endswith('.py')]
            if len(scripts) != 1 or any(arg not in ('-B', '-u', '-E', '-s') for arg in args[1:script_positions[0]]):
                # No certificar cierre con otro Python sin script identificable.
                row['role'] = 'unclassified_python'
                continue
            script = scripts[0].resolve()
            if script == (SYNC / 'sincronizar_vigencias.py').resolve() and '--continuo' in args:
                row['role'] = 'polling'
            elif script == (CLOSE / 'ensayo_cierres.py').resolve() and '--mantenimiento' in args:
                row['role'] = 'trial'
            elif script.is_relative_to(Path(r'C:\SanIsidro').resolve()):
                # Emisor/inspector conocido no abre SDK; otras herramientas bloquean por precaucion.
                safe = {Path(r'C:\SanIsidro\EntregaCoordinador_20261024\entregar_coordinador.py').resolve()}
                row['role'] = 'sender' if script in safe else 'other_sanisidro'
    return value


def trial_identity(state):
    if (state.get('scope') != 'ensayo_coordinador_sin_escrituras_sdk' or
            state.get('adapter_version') != '2026.10.24-1' or type(state.get('pid')) is not int or
            state['pid'] < 1 or state.get('phase') not in ('starting', 'cycle_probe', 'reading', 'waiting', 'stopped', 'fault') or
            not isinstance(state.get('run_id'), str) or str(uuid.UUID(state['run_id'])) != state['run_id']):
        raise ValueError('Identidad de ensayo invalida.')
    stamp(state['started_utc'])
    return {key: state[key] for key in ('pid', 'run_id')}


@contextlib.contextmanager
def existing_lock():
    import msvcrt
    with (SYNC / 'sync.lock').open('r+b') as stream:
        stream.seek(0)
        msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        try:
            yield
        finally:
            stream.seek(0)
            msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)


def require_stopped(state):
    ident = trial_identity(state)
    if state['phase'] != 'stopped' or state.get('stop_reason') not in ('limit', 'requested'):
        raise RuntimeError('Ensayo no detenido limpiamente; conservar mantenimiento.')
    gate = state.get('sdk_gate')
    if not isinstance(gate, dict) or gate.get('fault') is not False or gate.get('active') is not None:
        raise RuntimeError('Cierre SDK no confirmado.')
    completed = state.get('cycle_probe', {}).get('completed')
    if type(completed) is not int or completed < 0:
        raise ValueError('Comparaciones completadas no confirmadas.')
    return ident


def require_no_readers(snapshot, target_pid):
    # Un PID reutilizado para otro programa tambien impide confirmar su salida.
    if any(row['pid'] == target_pid or row['role'] not in ('control', 'sender', 'external')
           for row in snapshot['processes']):
        raise RuntimeError('Proceso presente o sin clasificar; no acreditar cierre.')


def stopped_check():
    state = read(STATE)
    ident = require_stopped(state)
    if (GESTOR / 'revision_pendiente.json').exists():
        raise RuntimeError('Revision del gestor pendiente.')
    require_no_readers(inventory(), ident['pid'])
    module = closure_module()
    with existing_lock():
        count = module.check_ledger(DATA / 'cierres')
        current_requests = [read(path, limit=8192) for path in (DATA / 'cierres').glob('*/request.json')]
        current_requests = [request for request in current_requests if request.get('run_id') == ident['run_id']]
        inventories = sum(request.get('role') == 'vigencias' for request in current_requests)
        if inventories < state['cycle_probe']['completed']:
            raise RuntimeError('Faltan recibos de comparaciones de esta ejecucion.')
        require_no_readers(inventory(), ident['pid'])
        final = read(STATE)
        if require_stopped(final) != ident or final != state:
            raise RuntimeError('Cambio de ejecucion durante comprobacion.')
    return {'status': 'cierre_confirmado', 'identity': ident, 'closures_acknowledged_total': count,
            'closures_for_current_run': len(current_requests),
            'lock_free_at_check': True, 'checked_utc': now().isoformat(),
            'note': 'Comprobacion puntual; mantener otros lectores cerrados hasta reanudar por gestor.'}


def request_stop():
    state = read(STATE)
    ident = trial_identity(state)
    if state['phase'] in ('stopped', 'fault'):
        raise RuntimeError('Ensayo detenido o pendiente de revision; usar verificar_cierre.')
    rows = [row for row in inventory()['processes'] if row['role'] == 'trial']
    if len(rows) != 1 or rows[0]['pid'] != ident['pid']:
        raise RuntimeError('Proceso del ensayo no confirmado.')
    age = (stamp(state['started_utc']) - stamp(rows[0]['created_utc'])).total_seconds()
    started, heartbeat, moment = stamp(state['started_utc']), stamp(state['heartbeat_utc']), now()
    if not 0 <= age <= 300 or not started <= heartbeat <= moment:
        raise RuntimeError('Identidad temporal del proceso no confirmada.')
    latest = read(STATE)
    if (trial_identity(latest) != ident or latest['started_utc'] != state['started_utc'] or
            latest['phase'] in ('stopped', 'fault')):
        raise RuntimeError('Cambio de ejecucion durante solicitud de parada.')
    # La peticion antigua no detiene otra ejecucion: el padre exige PID y UUID.
    save(DATA / 'detener_cierres.json', ident)
    return {'status': 'parada_solicitada', 'identity': ident,
            'note': 'Esperar salida y verificar_cierre; no habilita consultas ni reanudacion.'}


def prepare_check():
    # Precondicion del boton candidato; la pausa r2 la realiza el gestor instalado.
    if hashlib.sha256((GESTOR / 'mantenimiento.ps1').read_bytes()).hexdigest() != MAINTENANCE_HASH:
        raise ValueError('Mantenimiento instalado distinto de referencia.')
    if STATE.exists():
        state = read(STATE)
        trial_identity(state)
        if state['phase'] != 'stopped' or state.get('sdk_gate') != {'fault': False, 'active': None}:
            raise RuntimeError('Detener/verificar el ensayo antes de preparar mantenimiento.')
    closure_module().check_ledger(DATA / 'cierres')
    blockers = [r for r in inventory()['processes'] if r['role'] not in ('control', 'polling', 'sender', 'external')]
    if blockers:
        raise RuntimeError('Cerrar otras herramientas antes de preparar mantenimiento.')
    return {'status': 'precondiciones_pausa_verificadas', 'installed_maintenance_hash_matches': True}


def outbox_health():
    # Solo SELECT sobre la base existente. No inicializa, agrupa, envia ni toma leases.
    db = sqlite3.connect((DATA / 'outbox.sqlite').resolve().as_uri() + '?mode=ro', uri=True, timeout=2)
    try:
        db.execute('PRAGMA query_only=ON')
        db.execute('BEGIN')
        meta = dict(db.execute('SELECT key,value FROM meta'))
        if (meta.get('agent_id') != 'c8d7ccdc-991f-497c-8383-92fb52921f8a' or
                meta.get('device_serial') != 'CO2K225060027'):
            raise ValueError('Cola de otro agente/controlador.')
        counts = dict(db.execute('SELECT state,COUNT(*) FROM messages GROUP BY state'))
        unbatched = db.execute('SELECT COUNT(*) FROM responses WHERE message_id IS NULL').fetchone()[0]
        responses = db.execute('SELECT COUNT(*) FROM responses').fetchone()[0]
        return {'scope': 'cola_local_sin_acreditar_salud_de_transporte', 'messages': counts,
                'responses': responses, 'unbatched': unbatched, 'paused': bool(meta.get('paused')),
                'pending_count': counts.get('pending', 0) + counts.get('blocked', 0) + unbatched}
    finally:
        db.close()


def health():
    errors = []
    def optional(path, label):
        try:
            return read(path)
        except (OSError, ValueError) as exc:
            errors.append({'source': label, 'error_type': type(exc).__name__})
            return {}
    inv = inventory()
    state = optional(SYNC / 'registros' / 'estado.json', 'vigencias')
    watch = optional(SYNC / 'registros' / 'vigilancia.json', 'vigilancia')
    config = optional(SYNC / 'vigilancia-config.json', 'config')
    maintenance = optional(GESTOR / 'mantenimiento.json', 'mantenimiento')
    trial = optional(STATE, 'ensayo')
    tasks = {r['name']: r for r in inv['tasks']}
    pids = [r['pid'] for r in inv['processes'] if r['role'] == 'polling']
    moment = now()
    valid_config = (type(config.get('minutes')) is int and 3 <= config['minutes'] <= 60 and
                    type(config.get('repeat_minutes')) is int and config['repeat_minutes'] >= 5 and
                    type(config.get('popup')) is bool)
    vigencias = assess_vigencias(state or None, watch.get('enabled_since_utc'), moment,
        minutes=config['minutes'] if valid_config else 5,
        task_state=tasks.get('SanIsidro-Vigencias', {}).get('state', 'Unknown'),
        maintenance_active=maintenance.get('active'), process_pid=pids[0] if len(pids) == 1 else None)
    if not valid_config:
        vigencias = {'status': 'desconocido', 'reason': 'invalid_monitor_config'}
    trial_report = {'scope': 'ensayo_readonly_no_equivale_a_vigencias', 'status': 'desconocido'}
    try:
        ident = trial_identity(trial)
        live = [r for r in inv['processes'] if r['role'] == 'trial' and r['pid'] == ident['pid']]
        age = (moment - stamp(trial['heartbeat_utc'])).total_seconds()
        if trial['phase'] == 'fault' or trial.get('sdk_gate', {}).get('fault') is not False:
            status = 'revision_pendiente'
        elif trial['phase'] == 'stopped':
            status = 'detenido_sin_verificar_cierre'  # Solo verificar_cierre acredita ledger/lock/salida.
        elif len(live) == 1 and 0 <= age <= 30:
            delta = (stamp(trial['started_utc']) - stamp(live[0]['created_utc'])).total_seconds()
            status = 'activo' if 0 <= delta <= 300 else 'identidad_no_confirmada'
        else:
            status = 'sin_actividad_confirmada'
        trial_report |= {'status': status, 'identity': ident, 'phase': trial['phase'],
                         'heartbeat_age_seconds': age,
                         'reader_has_error': trial.get('reader_error') is not None,
                         'storage_has_error': trial.get('storage_error') is not None}
    except (ValueError, KeyError, TypeError, AttributeError, OverflowError):
        errors.append({'source': 'identidad_ensayo', 'error_type': 'ValueError'})
    try:
        queue = outbox_health()
    except (OSError, ValueError, sqlite3.Error) as exc:
        queue = {'status': 'desconocido'}
        errors.append({'source': 'outbox', 'error_type': type(exc).__name__})
    return {'scope': 'vigilancia_candidata_manual_sin_sdk_ni_alertas_instaladas',
            'checked_utc': moment.isoformat(), 'vigencias': vigencias, 'ensayo': trial_report,
            'cola': queue, 'tasks': inv['tasks'], 'read_errors': errors,
            'installed_watchdog_replaced': False}


def dispatch(action):
    if action == 'salud':
        return health()
    if action == 'detener':
        return request_stop()
    if action == 'previo_pausa':
        return prepare_check()
    if action not in ('verificar_cierre', 'previo_reanudar'):
        raise ValueError('Accion no permitida.')
    report = stopped_check()
    if action == 'previo_reanudar':
        if hashlib.sha256((GESTOR / 'mantenimiento.ps1').read_bytes()).hexdigest() != MAINTENANCE_HASH:
            raise ValueError('Mantenimiento instalado distinto de referencia.')
        if read(GESTOR / 'mantenimiento.json').get('active') is not True:
            raise RuntimeError('No hay mantenimiento activo.')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('salud', 'detener', 'verificar_cierre', 'previo_pausa', 'previo_reanudar'))
    args = parser.parse_args()
    try:
        verify_package()
        if os.name != 'nt' or ROOT.is_relative_to(SYNC.resolve()) or ROOT.is_relative_to(GESTOR.resolve()):
            raise RuntimeError('Usar Windows y carpeta separada.')
        ROOT.joinpath('registros').mkdir(exist_ok=True)
        # Serializar botones/CLI propios. No sustituye el sync.lock que usa SDK.
        import msvcrt
        with ROOT.joinpath('control_enlace.lock').open('a+b') as guard:
            if guard.tell() == 0:
                guard.write(b'0')
                guard.flush()
            guard.seek(0)
            msvcrt.locking(guard.fileno(), msvcrt.LK_NBLCK, 1)
            try:
                report = dispatch(args.action)
                save(ROOT / 'registros' / (args.action + '_' + moment_name() + '.json'), report)
                print(json.dumps(report, indent=2))
            finally:
                guard.seek(0)
                msvcrt.locking(guard.fileno(), msvcrt.LK_UNLCK, 1)
        return 0
    except (Exception, KeyboardInterrupt) as exc:
        # Sin commandlines, inventarios SDK, traceback o secretos en consola.
        print('ENLACE NO CONFIRMADO: ' + type(exc).__name__ + '. Conservar mantenimiento/evidencia y revisar.')
        return 1


def moment_name():
    return now().strftime('%Y%m%d_%H%M%S_%f')


if __name__ == '__main__':
    raise SystemExit(main())
