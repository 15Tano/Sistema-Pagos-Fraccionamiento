"""Lecturas Windows del contrato instalado. No habilita/deshabilita/inicia tareas."""
import base64
import json
import os
from pathlib import Path
import subprocess

from emisor_servicio import read

SYNC=Path(r'C:\SanIsidro\ZKSync')


def inventory(root=SYNC):
    if os.name!='nt': raise RuntimeError('Inventario Windows requerido.')
    escaped=str(Path(root).resolve()).replace("'","''")
    source=r'''
$ErrorActionPreference='Stop'
$opRoot='ROOT_PLACEHOLDER'
$opIdentity=[Security.Principal.WindowsIdentity]::GetCurrent()
$opTasks=@()
foreach($opName in @('SanIsidro-Vigencias','SanIsidro-Vigilancia')) {
    $opTask=Get-ScheduledTask -TaskName $opName
    $opActions=@($opTask.Actions)
    $opValid=$opActions.Count -eq 1
    if($opValid) {
        $opAction=$opActions[0]
        if($opName -eq 'SanIsidro-Vigencias') {
            $opExpected='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $opRoot 'iniciar_oculto.ps1')+'"'
            $opValid=([IO.Path]::GetFileName($opAction.Execute) -ieq 'powershell.exe') -and $opAction.Arguments -ieq $opExpected
        } else {
            $opExpected='"'+(Join-Path $opRoot 'vigilar_sync.py')+'"'
            $opValid=$opAction.Execute -ieq 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\pythonw.exe' -and $opAction.Arguments -ieq $opExpected
        }
        $opValid=$opValid -and $opAction.WorkingDirectory -ieq $opRoot
    }
    $opUser=$opTask.Principal.UserId
    try {
        if($opUser -match '^S-1-') { $opSid=$opUser }
        else { $opSid=(New-Object Security.Principal.NTAccount($opUser)).Translate([Security.Principal.SecurityIdentifier]).Value }
        $opSame=$opSid -eq $opIdentity.User.Value
    } catch { $opSame=$false }
    $opTasks += [pscustomobject]@{name=$opName;state=$opTask.State.ToString();enabled=[bool]$opTask.Settings.Enabled;actions_verified=[bool]$opValid;same_user=[bool]$opSame;highest=($opTask.Principal.RunLevel.ToString() -eq 'Highest');interactive=($opTask.Principal.LogonType.ToString() -eq 'Interactive')}
}
[pscustomobject]@{tasks=$opTasks;windows_user=$opIdentity.Name}|ConvertTo-Json -Depth 5 -Compress
'''.replace('ROOT_PLACEHOLDER',escaped)
    encoded=base64.b64encode(source.encode('utf-16le')).decode('ascii')
    result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-EncodedCommand',encoded],
        capture_output=True,text=True,timeout=30,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),
        env={key:value for key,value in os.environ.items() if not key.upper().startswith('SANISIDRO_')})
    if result.returncode or len(result.stdout)>32768: raise RuntimeError('Inventario operativo no confirmado.')
    value=json.loads(result.stdout)
    if not isinstance(value,dict) or not isinstance(value.get('tasks'),list) or len(value['tasks'])!=2:
        raise RuntimeError('Inventario incompleto.')
    return value


def task_contract(value, *, maintenance):
    rows={row['name']:row for row in value['tasks']}
    if set(rows)!={'SanIsidro-Vigencias','SanIsidro-Vigilancia'}: raise PermissionError('Tareas distintas.')
    if not all(row.get(key) is True for row in rows.values() for key in ('actions_verified','same_user','highest','interactive')):
        raise PermissionError('Accion/principal de tareas difiere de referencia.')
    watcher=rows['SanIsidro-Vigilancia']
    if watcher.get('enabled') is not True or watcher.get('state') not in ('Ready','Running'):
        raise PermissionError('Conservar vigilancia instalada habilitada.')
    task=rows['SanIsidro-Vigencias']
    if maintenance:
        if task.get('enabled') is not False or task.get('state')!='Disabled':
            raise PermissionError('Preparar mantenimiento con gestor instalado.')
    elif task.get('enabled') is not True or task.get('state')!='Running':
        raise PermissionError('La tarea operativa no esta ejecutandose como se espera.')
    return rows


def stop_requested(root,pid,birth_unix,run_id=None):
    path=Path(root)/'detener.sync.json'
    try:
        value=read(path)
        # Compatibilidad con gestor PID-only, sin aceptar una solicitud vieja tras reutilizacion del PID.
        return (type(value.get('pid')) is int and value['pid']==pid and path.stat().st_mtime>=birth_unix and
                (set(value)=={'pid'} or (set(value)=={'pid','run_id'} and value['run_id']==run_id)))
    except (OSError,ValueError,AttributeError):
        return False


def maintenance_guard(root=SYNC, *, inspect=inventory):
    root=Path(root)
    task_contract(inspect(root),maintenance=True)
    flag=read(root.parent/'GestionTags'/'mantenimiento.json')
    state=read(root/'registros'/'estado.json')
    if (flag.get('active') is not True or state.get('protocol')!=2 or state.get('phase')!='stopped' or
            (root.parent/'GestionTags'/'revision_pendiente.json').exists()):
        raise PermissionError('Mantenimiento/estado/revision no confirmados.')
    from guardia_gestor_operativo import require_closed
    require_closed(root,allow_partial_review=False)
