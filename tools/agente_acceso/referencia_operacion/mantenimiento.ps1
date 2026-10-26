param([ValidateSet('pausar','reanudar')][string]$Operacion)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$syncRoot='C:\SanIsidro\ZKSync'
$record=Join-Path $root 'mantenimiento.json'
$review=Join-Path $root 'revision_pendiente.json'
function Procesos-Sync {
    @(Get-CimInstance Win32_Process | Where-Object {
        $_.Name -in @('python.exe','pythonw.exe') -and
        $_.CommandLine -like "*$syncRoot\sincronizar_vigencias.py*" -and
        $_.CommandLine -like '*--continuo*'
    })
}
if($Operacion -eq 'reanudar') {
    if(Test-Path $review){throw 'Hay una operacion pendiente de revision; no se reanudo el polling.'}
    if(-not(Test-Path $record)){throw 'No hay mantenimiento registrado por esta herramienta.'}
    $previous=Get-Content $record -Raw -Encoding UTF8 | ConvertFrom-Json
    if($previous.wasEnabled){
        Enable-ScheduledTask -TaskName 'SanIsidro-Vigencias' | Out-Null
        if((Procesos-Sync).Count -eq 0){Start-ScheduledTask -TaskName 'SanIsidro-Vigencias'}
        $limit=(Get-Date).AddSeconds(25)
        while((Procesos-Sync).Count -eq 0 -and (Get-Date) -lt $limit){Start-Sleep -Seconds 1}
        if((Procesos-Sync).Count -eq 0){throw 'Se habilito la tarea pero no se confirmo un proceso activo. Revisa launcher.log; el mantenimiento sigue abierto.'}
    }
    $previous.active=$false
    $previous | ConvertTo-Json | Set-Content $record -Encoding UTF8
    if($previous.wasEnabled){Write-Output 'Mantenimiento terminado; polling reanudado y proceso confirmado.'}
    else{Write-Output 'Mantenimiento terminado. La tarea ya estaba desactivada y permanece asi.'}
    exit 0
}
$task=Get-ScheduledTask -TaskName 'SanIsidro-Vigencias'
$previous=if(Test-Path $record){Get-Content $record -Raw -Encoding UTF8 | ConvertFrom-Json}else{$null}
if($null -eq $previous -or -not $previous.active){
    $previous=@{active=$true;wasEnabled=[bool]$task.Settings.Enabled;started=(Get-Date).ToString('o')}
    $previous | ConvertTo-Json | Set-Content $record -Encoding UTF8
}
$processes=Procesos-Sync
if($processes.Count -gt 1){throw 'Hay varias copias de sincronizacion. No se forzo una parada.'}
if($processes.Count -eq 0){
    Disable-ScheduledTask -TaskName 'SanIsidro-Vigencias' | Out-Null
    Write-Output 'Polling pausado; no habia proceso activo.'
    exit 0
}
$stateFile=Join-Path $syncRoot 'registros\estado.json'
$state=if(Test-Path $stateFile){Get-Content $stateFile -Raw | ConvertFrom-Json}else{$null}
if($null -ne $state -and $state.protocol -eq 2 -and $state.pid -eq $processes[0].ProcessId){
    Disable-ScheduledTask -TaskName 'SanIsidro-Vigencias' | Out-Null
    @{pid=[int]$state.pid}|ConvertTo-Json|Set-Content (Join-Path $syncRoot 'detener.sync.json') -Encoding UTF8
    $limit=(Get-Date).AddSeconds(360)
    while((Procesos-Sync).Count -gt 0 -and (Get-Date) -lt $limit){Start-Sleep -Seconds 1}
    if((Procesos-Sync).Count -gt 0){throw 'La parada sigue pendiente. No se mato el proceso.'}
} else {
    # V1 no acepta parada cooperativa. Esperar una pausa documentada reciente.
    $limit=(Get-Date).AddSeconds(120);$safe=$false
    while((Get-Date) -lt $limit){
        $line=Get-Content (Join-Path $syncRoot 'registros\sync.log') -Tail 1
        if($line -match '^(.{23}) (?:ERROR Ciclo no completado:|INFO API=\d+; cambios Access=0; cambios C3=0;)'){
            $date=[datetime]::ParseExact($Matches[1],'yyyy-MM-dd HH:mm:ss,fff',[Globalization.CultureInfo]::InvariantCulture)
            $age=((Get-Date)-$date).TotalSeconds
            if($age -ge 0 -and $age -lt 10){$safe=$true;break}
        }
        Start-Sleep -Milliseconds 500
    }
    if(-not $safe){throw 'No se encontro una pausa segura. No se interrumpio el polling.'}
    Start-Sleep -Seconds 1
    Disable-ScheduledTask -TaskName 'SanIsidro-Vigencias' | Out-Null
    $processes=Procesos-Sync
    Stop-ScheduledTask -TaskName 'SanIsidro-Vigencias'
    $processes|ForEach-Object {Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue}
}
if((Procesos-Sync).Count -gt 0){throw 'Todavia hay un proceso. No ejecutar altas.'}
Write-Output 'Polling pausado entre ciclos. Se puede consultar o aplicar un tag.'
