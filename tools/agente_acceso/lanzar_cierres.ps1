param([ValidateRange(5,180)][int]$Seconds = 150)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'verificar_cierres.ps1')
$closePython = 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe'
$closePointer = [IntPtr]::Zero
$closeSecure = $null
$closeExit = 1
try {
    $closeSecure = ConvertTo-SecureString -String ((Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\access-password.dpapi' -Raw).Trim())
    $closePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($closeSecure)
    $env:SANISIDRO_ACCESS_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($closePointer)
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    $closeTokenFile = 'C:\SanIsidro\ZKSync\api-token.dpapi'
    if (Test-Path -LiteralPath $closeTokenFile) {
        $closeTokenSecure = ConvertTo-SecureString -String ((Get-Content -LiteralPath $closeTokenFile -Raw).Trim())
        $closeTokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($closeTokenSecure)
        try { $env:SANISIDRO_API_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($closeTokenPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($closeTokenPointer); $closeTokenSecure.Dispose() }
    }
    & $closePython -B (Join-Path $PSScriptRoot 'ensayo_cierres.py') --mantenimiento --seconds $Seconds
    $closeExit = $LASTEXITCODE
}
catch {
    Write-Output ('ENSAYO NO INICIADO/INTERRUMPIDO. Tipo: ' + $_.Exception.GetType().Name + '. No compartir credenciales.')
}
finally {
    Remove-Item Env:\SANISIDRO_ACCESS_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    if ($closePointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($closePointer) }
    if ($null -ne $closeSecure) { $closeSecure.Dispose() }
}
exit $closeExit
