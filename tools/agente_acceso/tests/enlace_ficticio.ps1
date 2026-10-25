param([Parameter(Mandatory=$true)][string]$Scratch,[Parameter(Mandatory=$true)][string]$Python)
$ErrorActionPreference='Stop'
$enRoot=Split-Path $PSScriptRoot -Parent
. (Join-Path $enRoot 'enlace_funciones.ps1')
$enAllowed=[IO.Path]::GetFullPath((Join-Path $enRoot 'datos\pruebas_enlace'))+[IO.Path]::DirectorySeparatorChar
$enScratch=[IO.Path]::GetFullPath($Scratch)
if(-not $enScratch.StartsWith($enAllowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Ruta ficticia fuera del ensayo.'}
[void][IO.Directory]::CreateDirectory($enScratch)
$script:enResults=New-Object System.Collections.ArrayList
function Assert-En([bool]$Condition){if(-not $Condition){throw 'Asercion ficticia no cumplida.'}}
function Case-En([string]$Name,[scriptblock]$Body){
    try{& $Body;[void]$script:enResults.Add(@{name=$Name;ok=$true})}
    catch{[void]$script:enResults.Add(@{name=$Name;ok=$false;error_type=$_.Exception.GetType().Name})}
}
function Throws-En([scriptblock]$Body){
    $enRaised=$false
    try{& $Body | Out-Null}catch{$enRaised=$true}
    Assert-En $enRaised
}
$enOkPre={param($action) [pscustomobject]@{exit_code=0;output='ficticio'}}
$enOkDelegate={param($operation) [pscustomobject]@{exit_code=0;output='delegado_ficticio'}}
$enGoodHash={$true}

Case-En 'pausa_orden_y_argumentos' {
    $script:enTrace=New-Object System.Collections.ArrayList
    $enResult=Invoke-EnMaintenanceCore -Operacion pausar -Precheck {
        param($action) [void]$script:enTrace.Add($action); [pscustomobject]@{exit_code=0;output='pre'}
    } -VerifyHash {[void]$script:enTrace.Add('hash');$true} -Delegate {
        param($operation) [void]$script:enTrace.Add($operation); [pscustomobject]@{exit_code=0;output='delegate'}
    }
    Assert-En (($script:enTrace -join ',') -eq 'previo_pausa,hash,pausar')
    Assert-En ($enResult.operation -eq 'pausar')
}
Case-En 'reanudar_argumento_cierre_obligatorio' {
    $script:enTrace=New-Object System.Collections.ArrayList
    [void](Invoke-EnMaintenanceCore -Operacion reanudar -Precheck {
        param($action) [void]$script:enTrace.Add($action); [pscustomobject]@{exit_code=0;output='pre'}
    } -VerifyHash $enGoodHash -Delegate {
        param($operation) [void]$script:enTrace.Add($operation); [pscustomobject]@{exit_code=0;output='delegate'}
    })
    Assert-En (($script:enTrace -join ',') -eq 'previo_reanudar,reanudar')
}
Case-En 'precheck_fallido_no_delega' {
    $script:enDelegated=$false
    Throws-En {Invoke-EnMaintenanceCore -Operacion reanudar -Precheck {
        [pscustomobject]@{exit_code=1;output='cierre no confirmado ficticio'}
    } -VerifyHash $enGoodHash -Delegate {$script:enDelegated=$true}}
    Assert-En (-not $script:enDelegated)
}
Case-En 'codigo_precheck_no_tipado_rechazado' {
    Throws-En {Invoke-EnMaintenanceCore -Operacion pausar -Precheck {
        [pscustomobject]@{exit_code='0';output='ficticio'}
    } -VerifyHash $enGoodHash -Delegate $enOkDelegate}
}
Case-En 'hash_distinto_no_delega' {
    $script:enDelegated=$false
    Throws-En {Invoke-EnMaintenanceCore -Operacion reanudar -Precheck $enOkPre -VerifyHash {$false} -Delegate {$script:enDelegated=$true}}
    Assert-En (-not $script:enDelegated)
}
Case-En 'hash_no_booleano_rechazado' {
    Throws-En {Invoke-EnMaintenanceCore -Operacion pausar -Precheck $enOkPre -VerifyHash {'True'} -Delegate $enOkDelegate}
}
Case-En 'error_delegado_no_anuncia_exito' {
    Throws-En {Invoke-EnMaintenanceCore -Operacion reanudar -Precheck $enOkPre -VerifyHash $enGoodHash -Delegate {
        [pscustomobject]@{exit_code=9;output='falla ficticia'}
    }}
}
Case-En 'timeout_precheck_no_delega' {
    $script:enDelegated=$false
    Throws-En {Invoke-EnMaintenanceCore -Operacion reanudar -Precheck {throw [TimeoutException]::new('ficticio')} -VerifyHash $enGoodHash -Delegate {$script:enDelegated=$true}}
    Assert-En (-not $script:enDelegated)
}
Case-En 'lock_cubre_trabajo_y_rechaza_segunda_operacion' {
    $enLock=Join-Path $enScratch 'serial.lock'
    $script:enSecondEntered=$false
    Invoke-EnMaintenanceLock -Path $enLock -Work {
        Throws-En {Invoke-EnMaintenanceLock -Path $enLock -Work {$script:enSecondEntered=$true}}
    }
    Assert-En (-not $script:enSecondEntered)
    Assert-En ([IO.File]::ReadAllText($enLock) -eq '0')
}
Case-En 'lock_liberado_tras_excepcion' {
    $enLock=Join-Path $enScratch 'exception.lock'
    Throws-En {Invoke-EnMaintenanceLock -Path $enLock -Work {throw 'ficticio'}}
    $enValue=Invoke-EnMaintenanceLock -Path $enLock -Work {'libre'}
    Assert-En ($enValue -eq 'libre')
}
Case-En 'mapa_de_cinco_botones' {
    $enActions=@(Get-EnControlActions)
    Assert-En ($enActions.Count -eq 5)
    Assert-En (($enActions.action -join ',') -eq 'pausar,detener,verificar_cierre,reanudar,salud')
}
Case-En 'comandos_ocultos_rutas_y_salida_redirigida' {
    foreach($enAction in @('pausar','detener','verificar_cierre','reanudar','salud')){
        $enInfo=New-EnControlStartInfo -Root $enRoot -Action $enAction
        Assert-En ($enInfo.CreateNoWindow -and -not $enInfo.UseShellExecute -and $enInfo.RedirectStandardOutput -and $enInfo.RedirectStandardError)
        Assert-En ($enInfo.Arguments.EndsWith($enAction))
        Assert-En ($enInfo.Arguments.Contains('"'+$enRoot))
    }
}
Case-En 'entorno_sin_sanisidro' {
    $enPrevious=[Environment]::GetEnvironmentVariable('SANISIDRO_FIXTURE')
    try{
        [Environment]::SetEnvironmentVariable('SANISIDRO_FIXTURE','dato_ficticio')
        $enInfo=New-EnControlStartInfo -Root $enRoot -Action salud
        Assert-En (-not $enInfo.EnvironmentVariables.ContainsKey('SANISIDRO_FIXTURE'))
    }finally{[Environment]::SetEnvironmentVariable('SANISIDRO_FIXTURE',$enPrevious)}
}
Case-En 'hijo_ficticio_pipes_y_salida' {
    $enInfo=New-EnControlStartInfo -Root $enRoot -Action salud
    $enInfo.FileName=$Python
    $enInfo.Arguments='-B -c "import sys; print(''ficticio''); sys.exit(0)"'
    $enChild=New-Object System.Diagnostics.Process
    $enChild.StartInfo=$enInfo
    try{
        Assert-En ($enChild.Start())
        $enOut=$enChild.StandardOutput.ReadToEndAsync()
        $enErr=$enChild.StandardError.ReadToEndAsync()
        Assert-En ($enChild.WaitForExit(5000))
        Assert-En ($enOut.Wait(5000) -and $enErr.Wait(5000))
        Assert-En ($enChild.ExitCode -eq 0 -and $enOut.Result.Trim() -eq 'ficticio')
    }finally{
        if(-not $enChild.HasExited){$enChild.Kill();$enChild.WaitForExit()}
        $enChild.Dispose()
    }
}
$enFailures=@($script:enResults | Where-Object {-not $_.ok})
[pscustomobject]@{checks=$script:enResults.Count;failures=$enFailures.Count;results=@($script:enResults)} | ConvertTo-Json -Depth 5 -Compress
if($enFailures.Count){exit 1}
