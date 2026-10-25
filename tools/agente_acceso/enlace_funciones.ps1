# Funciones sin acciones al cargar. El entrypoint fija rutas/callbacks de produccion.
function Get-EnControlActions {
    @(
        @{label='Preparar mantenimiento';action='pausar'},
        @{label='Solicitar parada ensayo';action='detener'},
        @{label='Verificar cierre';action='verificar_cierre'},
        @{label='Terminar y reanudar';action='reanudar'},
        @{label='Consultar salud';action='salud'}
    )
}

function New-EnControlStartInfo {
    param([string]$Root,[ValidateSet('pausar','detener','verificar_cierre','reanudar','salud')][string]$Action)
    $enInfo=New-Object System.Diagnostics.ProcessStartInfo
    $enInfo.UseShellExecute=$false
    $enInfo.CreateNoWindow=$true
    $enInfo.RedirectStandardOutput=$true
    $enInfo.RedirectStandardError=$true
    if($Action -in @('pausar','reanudar')){
        $enInfo.FileName='powershell.exe'
        $enInfo.Arguments='-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $Root 'mantenimiento_candidato.ps1')+'" -Operacion '+$Action
    }else{
        $enInfo.FileName='C:\Users\Dell\Python32\python.exe'
        $enInfo.Arguments='-B "'+(Join-Path $Root 'enlace_candidato.py')+'" '+$Action
    }
    foreach($enKey in @($enInfo.EnvironmentVariables.Keys)){
        if($enKey.StartsWith('SANISIDRO_',[StringComparison]::OrdinalIgnoreCase)){$enInfo.EnvironmentVariables.Remove($enKey)}
    }
    return $enInfo
}

function Invoke-EnMaintenanceCore {
    param([ValidateSet('pausar','reanudar')][string]$Operacion,
          [scriptblock]$Precheck,[scriptblock]$VerifyHash,[scriptblock]$Delegate)
    $enAction=if($Operacion -eq 'pausar'){'previo_pausa'}else{'previo_reanudar'}
    $enPre=& $Precheck $enAction
    if($null -eq $enPre -or $enPre.exit_code -isnot [int] -or $enPre.exit_code -ne 0){
        throw 'Precondiciones no confirmadas. No se invoco el mantenimiento instalado.'
    }
    $enHash=& $VerifyHash
    if($enHash -isnot [bool] -or -not $enHash){throw 'Mantenimiento instalado distinto de referencia.'}
    $enResult=& $Delegate $Operacion
    if($null -eq $enResult -or $enResult.exit_code -isnot [int] -or $enResult.exit_code -ne 0){
        throw 'El gestor no confirmo la operacion. Mantener revision abierta.'
    }
    [pscustomobject]@{pre_output=$enPre.output;delegate_output=$enResult.output;operation=$Operacion}
}

function Invoke-EnMaintenanceLock {
    param([string]$Path,[scriptblock]$Work)
    # Mantener exclusion propia durante precheck Y delegacion, no solo durante CLI Python.
    $enStream=[IO.File]::Open($Path,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::ReadWrite)
    $enLocked=$false
    try{
        if($enStream.Length -eq 0){$enStream.WriteByte(48);$enStream.Flush()}
        $enStream.Lock(0,1)
        $enLocked=$true
        & $Work
    }finally{
        if($enLocked){$enStream.Unlock(0,1)}
        $enStream.Dispose()
    }
}
