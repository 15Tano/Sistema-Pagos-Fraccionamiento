$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'verificar_puente_readonly.ps1')
$bridgePython = 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe'
$bridgePointer = [IntPtr]::Zero
$bridgeSecure = $null
$bridgeExit = 1
try {
    $bridgeSecure = ConvertTo-SecureString -String ((Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\access-password.dpapi' -Raw).Trim())
    $bridgePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($bridgeSecure)
    $env:SANISIDRO_ACCESS_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bridgePointer)
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    $bridgeTokenFile = 'C:\SanIsidro\ZKSync\api-token.dpapi'
    if (Test-Path -LiteralPath $bridgeTokenFile) {
        $bridgeTokenSecure = ConvertTo-SecureString -String ((Get-Content -LiteralPath $bridgeTokenFile -Raw).Trim())
        $bridgeTokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($bridgeTokenSecure)
        try { $env:SANISIDRO_API_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bridgeTokenPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bridgeTokenPointer); $bridgeTokenSecure.Dispose() }
    }
    & $bridgePython -B (Join-Path $PSScriptRoot 'ensayo_puente_readonly.py') --mantenimiento
    $bridgeExit = $LASTEXITCODE
}
catch {
    Write-Output ('PUENTE NO INICIADO/INTERRUMPIDO. Tipo: ' + $_.Exception.GetType().Name + '. No compartir credenciales.')
}
finally {
    Remove-Item Env:\SANISIDRO_ACCESS_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    if ($bridgePointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bridgePointer) }
    if ($null -ne $bridgeSecure) { $bridgeSecure.Dispose() }
}
exit $bridgeExit
