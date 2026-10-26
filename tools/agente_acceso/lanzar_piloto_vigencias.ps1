param([Parameter(Mandatory=$true)][ValidatePattern('^[0-9]{1,32}$')][string]$Tag)
$ErrorActionPreference='Stop'
$pilotPrincipal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if(-not $pilotPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Abrir PowerShell como administrador: el piloto puede escribir fechas en la MDB de Program Files.'}
& (Join-Path $PSScriptRoot 'verificar_piloto.ps1')
$pilotPython='C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe'
$pilotEntry=Join-Path $PSScriptRoot 'piloto_vigencias_dell.py'
& $pilotPython -B $pilotEntry --preflight
if($LASTEXITCODE -ne 0){throw 'Preflight no confirmado; no se abrieron credenciales.'}
$pilotTask=Get-ScheduledTask -TaskName 'SanIsidro-Vigencias'
$pilotMaintenance=Get-Content -LiteralPath 'C:\SanIsidro\GestionTags\mantenimiento.json' -Raw | ConvertFrom-Json
$pilotState=Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\registros\estado.json' -Raw | ConvertFrom-Json
if($pilotTask.Settings.Enabled -or $pilotTask.State -ne 'Disabled' -or $pilotMaintenance.active -ne $true -or $pilotState.protocol -ne 2 -or $pilotState.phase -ne 'stopped'){
    throw 'Preparar mantenimiento por el gestor y comprobar parada antes del piloto.'
}
$pilotRun=[guid]::NewGuid().ToString()
$pilotSecrets=@()
$pilotExit=1
try {
    foreach($pilotCredential in @(@{File='access-password.dpapi';Variable='SANISIDRO_ACCESS_PASSWORD';Required=$true},@{File='api-token.dpapi';Variable='SANISIDRO_API_TOKEN';Required=$false})){
        [Environment]::SetEnvironmentVariable($pilotCredential.Variable,$null,'Process')
        $pilotCredentialPath=Join-Path 'C:\SanIsidro\ZKSync' $pilotCredential.File
        if(-not(Test-Path -LiteralPath $pilotCredentialPath)){
            if($pilotCredential.Required){throw 'Falta credencial DPAPI instalada.'};continue
        }
        $pilotSecure=ConvertTo-SecureString -String ((Get-Content -LiteralPath $pilotCredentialPath -Raw).Trim())
        $pilotSecrets+=$pilotSecure
        $pilotPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($pilotSecure)
        try {[Environment]::SetEnvironmentVariable($pilotCredential.Variable,[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pilotPointer),'Process')}
        finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pilotPointer)}
    }
    & $pilotPython -B $pilotEntry --piloto --tag $Tag --run-id $pilotRun
    $pilotExit=$LASTEXITCODE
} catch {
    Write-Output ('PILOTO INTERRUMPIDO. Tipo: '+$_.Exception.GetType().Name+'. Conservar evidencia.')
} finally {
    Remove-Item Env:\SANISIDRO_ACCESS_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    foreach($pilotSecure in $pilotSecrets){$pilotSecure.Dispose()}
}
Write-Output 'Python termino. Comprobando cierre de ESTE lanzamiento; aun no reanudar.'
& $pilotPython -B $pilotEntry --verificar-cierre --run-id $pilotRun
if($LASTEXITCODE -ne 0){throw 'Cierre piloto no confirmado. Conservar mantenimiento; no forzar ni borrar marcas.'}
exit $pilotExit
