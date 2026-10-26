param([ValidateRange(5,150)][int]$Seconds = 150)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'verificar_servicio.ps1')
$servicePython = 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe'
$serviceRun = [guid]::NewGuid().ToString()
$servicePointer = [IntPtr]::Zero
$serviceSecure = $null
$serviceExit = 1
try {
    $serviceSecure = ConvertTo-SecureString -String ((Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\access-password.dpapi' -Raw).Trim())
    $servicePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($serviceSecure)
    $env:SANISIDRO_ACCESS_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($servicePointer)
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    $serviceTokenFile = 'C:\SanIsidro\ZKSync\api-token.dpapi'
    if (Test-Path -LiteralPath $serviceTokenFile) {
        $serviceTokenSecure = ConvertTo-SecureString -String ((Get-Content -LiteralPath $serviceTokenFile -Raw).Trim())
        $serviceTokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($serviceTokenSecure)
        try { $env:SANISIDRO_API_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($serviceTokenPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($serviceTokenPointer); $serviceTokenSecure.Dispose() }
    }
    & $servicePython -B (Join-Path $PSScriptRoot 'servicio_integrado_dell.py') --mantenimiento --seconds $Seconds --run-id $serviceRun
    $serviceExit = $LASTEXITCODE
}
catch { Write-Output ('SERVICIO INTERRUMPIDO/NO INICIADO. Tipo: ' + $_.Exception.GetType().Name + '. No compartir credenciales.') }
finally {
    Remove-Item Env:\SANISIDRO_ACCESS_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    if ($servicePointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($servicePointer) }
    if ($null -ne $serviceSecure) { $serviceSecure.Dispose() }
}
& $servicePython -B (Join-Path $PSScriptRoot 'servicio_integrado_dell.py') --verificar-cierre --run-id $serviceRun
if ($LASTEXITCODE -ne 0) {
    Write-Output 'CIERRE NO CONFIRMADO. Conservar mantenimiento y evidencia; no reanudar automaticamente.'
    exit 1
}
exit $serviceExit
