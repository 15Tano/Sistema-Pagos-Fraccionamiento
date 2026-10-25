param([Parameter(Mandatory=$true)][ValidateSet('pausar','reanudar')][string]$Operacion)
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'verificar_enlace.ps1')
. (Join-Path $PSScriptRoot 'enlace_funciones.ps1')
$enPython='C:\Users\Dell\Python32\python.exe'
$enRoot=$PSScriptRoot
$enMaintenance='C:\SanIsidro\GestionTags\mantenimiento.ps1'
$enPrecheck={param($action)
    $enLines=@(& $enPython -B (Join-Path $enRoot 'enlace_candidato.py') $action 2>&1)
    [pscustomobject]@{exit_code=[int]$LASTEXITCODE;output=($enLines -join [Environment]::NewLine)}
}
$enVerifyHash={
    (Get-FileHash -LiteralPath $enMaintenance -Algorithm SHA256).Hash -eq '840c500933e644fb9545c88091a287416a018b7c3e16434d634138531b97b4f4'
}
$enDelegate={param($operation)
    $enLines=@(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $enMaintenance -Operacion $operation 2>&1)
    [pscustomobject]@{exit_code=[int]$LASTEXITCODE;output=($enLines -join [Environment]::NewLine)}
}
$enResult=Invoke-EnMaintenanceLock -Path (Join-Path $PSScriptRoot 'mantenimiento_enlace.lock') -Work {
    Invoke-EnMaintenanceCore -Operacion $Operacion -Precheck $enPrecheck -VerifyHash $enVerifyHash -Delegate $enDelegate
}
Write-Output $enResult.pre_output
Write-Output $enResult.delegate_output
if($Operacion -eq 'reanudar'){
    Write-Output 'Se delego la reanudacion a r2. Comprobar dos ciclos nuevos; este mensaje no acredita lock adquirido ni ciclo correcto.'
}
exit 0
