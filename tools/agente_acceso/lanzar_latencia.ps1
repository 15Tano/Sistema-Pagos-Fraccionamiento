param([ValidateRange(20,150)][int]$Seconds=150)
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'verificar_latencia.ps1')
$latPython='C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe'
& $latPython -B (Join-Path $PSScriptRoot 'latencia_dell.py') --preflight
if ($LASTEXITCODE -ne 0) { exit 1 }
$latSecure=$null
$latPointer=[IntPtr]::Zero
$latExit=1
try {
    $latSecure=ConvertTo-SecureString -String ((Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\access-password.dpapi' -Raw).Trim())
    $latPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($latSecure)
    $env:SANISIDRO_ACCESS_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($latPointer)
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    $latTokenFile='C:\SanIsidro\ZKSync\api-token.dpapi'
    if (Test-Path -LiteralPath $latTokenFile) {
        $latTokenSecure=ConvertTo-SecureString -String ((Get-Content -LiteralPath $latTokenFile -Raw).Trim())
        $latTokenPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($latTokenSecure)
        try { $env:SANISIDRO_API_TOKEN=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($latTokenPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($latTokenPointer);$latTokenSecure.Dispose() }
    }
    & $latPython -B (Join-Path $PSScriptRoot 'latencia_dell.py') --mantenimiento --seconds $Seconds
    $latExit=$LASTEXITCODE
}
catch { Write-Output ('ENSAYO NO INICIADO/INTERRUMPIDO: '+$_.Exception.GetType().Name+'. Conservar evidencia; no compartir credenciales.') }
finally {
    Remove-Item Env:\SANISIDRO_ACCESS_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    if ($latPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($latPointer) }
    if ($null -ne $latSecure) { $latSecure.Dispose() }
}
& $latPython -B (Join-Path $PSScriptRoot 'latencia_dell.py') --verificar-cierre
if ($LASTEXITCODE -ne 0) {
    Write-Output 'CIERRE NO CONFIRMADO. Mantener mantenimiento y evidencia; no quitar marcas manualmente.'
    exit 1
}
exit $latExit
