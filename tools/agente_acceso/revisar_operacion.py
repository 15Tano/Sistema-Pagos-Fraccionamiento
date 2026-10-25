"""Inspeccion readonly de r2 instalado; no aplica el contrato candidato ni usa SDK."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
SYNC = Path(r'C:\SanIsidro\ZKSync')
GESTOR = Path(r'C:\SanIsidro\GestionTags')
RELEASE = '2026.10.24-2'
FILES = {'control_operativo.py', 'salud_operativa.py', 'trabajador_controlado.py',
         'revisar_operacion.py', 'verificar_operacion.ps1', 'LEEME_OPERACION.md'}
EXPECTED = {
    'monitor': (SYNC / 'vigilar_sync.py', '204fc781b9d632c0decc7e11122ebcf6b9d1729191467e26d3ce67ebfcc4c1cd'),
    'lanzador': (SYNC / 'iniciar_oculto.ps1', 'd63567bfc5259d78505f8ffcc9e1a07c5b46b32c84ea6c49444409d08bdbbc92'),
    'mantenimiento': (GESTOR / 'mantenimiento.ps1', '840c500933e644fb9545c88091a287416a018b7c3e16434d634138531b97b4f4'),
}


def verify_package():
    manifest = json.loads((ROOT / 'OPERACION_SHA256SUMS.json').read_text(encoding='utf-8-sig'))
    entries = manifest['files']
    if (manifest['release'] != RELEASE or len(entries) != len(FILES) or
            {entry['name'] for entry in entries} != FILES):
        raise ValueError('Manifiesto inesperado.')
    for entry in entries:
        if hashlib.sha256((ROOT / entry['name']).read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError('Fuente distinta del paquete verificado.')


def read_json(path, label, errors):
    try:
        if path.stat().st_size > 131072:
            raise ValueError('Archivo de estado demasiado grande.')
        value = json.loads(path.read_text(encoding='utf-8-sig'))
        if not isinstance(value, dict):
            raise ValueError('Objeto esperado.')
        return value
    except (OSError, ValueError, UnicodeError) as exc:
        errors.append({'source': label, 'error_type': type(exc).__name__})
        return None


def task_inventory():
    # Lista cerrada. No imprime acciones, argumentos de procesos ni credenciales.
    command = r'''$ErrorActionPreference='Stop'
$opsTasks = foreach ($opsName in @('SanIsidro-Vigencias','SanIsidro-Vigilancia')) {
    $opsTask = Get-ScheduledTask -TaskName $opsName -ErrorAction SilentlyContinue
    if ($null -eq $opsTask) {
        [pscustomobject]@{name=$opsName;state='Missing';enabled=$null}
    } else {
        [pscustomobject]@{name=$opsName;state=$opsTask.State.ToString();enabled=[bool]$opsTask.Settings.Enabled}
    }
}
$opsProcesses = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -in @('python.exe','pythonw.exe') -and
    $_.CommandLine -like '*C:\SanIsidro\ZKSync\sincronizar_vigencias.py*' -and
    $_.CommandLine -like '*--continuo*'
} | ForEach-Object { [int]$_.ProcessId })
[pscustomobject]@{tasks=@($opsTasks);polling_pids=$opsProcesses} | ConvertTo-Json -Depth 4 -Compress
'''
    process = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if process.returncode:
        raise RuntimeError('No se pudo leer inventario de tareas/procesos.')
    value = json.loads(process.stdout.decode('utf-8-sig'))
    if (not isinstance(value, dict) or not isinstance(value.get('tasks'), list) or
            not isinstance(value.get('polling_pids'), list) or
            any(type(pid) is not int or pid < 1 for pid in value['polling_pids'])):
        raise ValueError('Inventario invalido.')
    return value


def inspect():
    if os.name != 'nt' or ROOT.is_relative_to(SYNC.resolve()) or ROOT.is_relative_to(GESTOR.resolve()):
        raise RuntimeError('Usar Windows y carpeta separada de ZKSync/GestionTags.')
    verify_package()
    # Importar candidatos solo tras verificar sus fuentes; no importan SDK.
    from salud_operativa import assess_vigencias, assess_components
    from control_operativo import stamp
    errors = []
    try:
        inventory = task_inventory()
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as exc:
        errors.append({'source': 'tasks', 'error_type': type(exc).__name__})
        inventory = {'tasks': [], 'polling_pids': []}
    tasks = {task['name']: task for task in inventory['tasks']}
    state = read_json(SYNC / 'registros' / 'estado.json', 'vigencias', errors)
    watch = read_json(SYNC / 'registros' / 'vigilancia.json', 'vigilancia', errors)
    config = read_json(SYNC / 'vigilancia-config.json', 'config', errors)
    maintenance = read_json(GESTOR / 'mantenimiento.json', 'mantenimiento', errors)
    # Ausencia normal en r2: componentes candidatos todavia no enlazados.
    component_path = SYNC / 'registros' / 'coordinador.estado.json'
    components = read_json(component_path, 'componentes', errors) if component_path.exists() else None
    config_ok = (isinstance(config, dict) and type(config.get('minutes')) is int and
                 3 <= config['minutes'] <= 60 and type(config.get('repeat_minutes')) is int and
                 config['repeat_minutes'] >= 5 and type(config.get('popup')) is bool)
    minutes = config['minutes'] if config_ok else 5
    pids = inventory['polling_pids']
    task = tasks.get('SanIsidro-Vigencias', {})
    # Comparar despues de leer: el polling puede actualizar sus fechas durante CIM.
    now = dt.datetime.now(dt.timezone.utc)
    health = assess_vigencias(state, (watch or {}).get('enabled_since_utc'), now,
        minutes=minutes, task_state=task.get('state', 'Unknown'),
        maintenance_active=(maintenance or {}).get('active'), process_pid=pids[0] if len(pids) == 1 else None)
    if not config_ok:
        health = {'status': 'desconocido', 'reason': 'invalid_monitor_config'}
    hashes = {}
    for name, (path, expected) in EXPECTED.items():
        try:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            hashes[name] = {'sha256': digest, 'matches_reference': digest == expected}
        except OSError as exc:
            errors.append({'source': name, 'error_type': type(exc).__name__})
            hashes[name] = {'matches_reference': False}
    checked, watch_age = None, None
    if watch:
        try:
            checked = stamp(watch['checked_utc']).isoformat()
            watch_age = (now - stamp(watch['checked_utc'])).total_seconds()
        except (ValueError, TypeError, KeyError, OverflowError):
            errors.append({'source': 'vigilancia_timestamp', 'error_type': 'ValueError'})
    # No copiar mensajes arbitrarios ni snapshots/payloads completos.
    safe_state = {}
    for key in ('pid', 'consecutive_errors'):
        value = (state or {}).get(key)
        if type(value) is int:
            safe_state[key] = value
    for key in ('last_ok_utc', 'heartbeat_utc'):
        try:
            safe_state[key] = stamp((state or {}).get(key)).isoformat()
        except (ValueError, TypeError, OverflowError):
            safe_state[key] = None
    safe_state['phase'] = (state or {}).get('phase') if (state or {}).get('phase') in ('starting', 'cycle', 'idle', 'stopped', 'fault') else 'unknown'
    return {
        'scope': 'revision_operativa_readonly_sin_sdk_red_access_ni_cambios_de_tareas',
        'release': RELEASE, 'checked_utc': now.isoformat(), 'tasks': inventory['tasks'],
        'polling_pids': pids, 'vigencias': safe_state, 'vigencias_evaluadas': health,
        'watchdog_observado': {
            'status': (watch or {}).get('status') if (watch or {}).get('status') in ('correcto', 'alerta', 'mantenimiento') else 'unknown',
            'checked_utc': checked, 'age_seconds': watch_age,
            'sample_recent': watch_age is not None and 0 <= watch_age <= 120,
        },
        'configuracion': {key: config[key] for key in ('minutes', 'repeat_minutes', 'popup')} if config_ok else None,
        'componentes_evaluados': assess_components(state, components, now, minutes=minutes),
        'candidate_linked': False, 'installed_hashes': hashes, 'read_errors': errors,
    }


def main():
    try:
        report = inspect()
        folder = ROOT / 'registros'
        folder.mkdir(exist_ok=True)
        path = folder / ('revision_' + dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f') + '.json')
        with path.open('x', encoding='utf-8') as stream:
            json.dump(report, stream, indent=2)
        print(json.dumps(report, indent=2))
        print('Evidencia: ' + str(path))
        return 0
    except Exception as exc:
        print('REVISION INTERRUMPIDA: ' + type(exc).__name__ + '. Conservar evidencia; no compartir secretos.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
