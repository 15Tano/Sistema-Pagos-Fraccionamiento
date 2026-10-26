param([Parameter(Mandatory=$true)][ValidatePattern('^[0-9]{1,32}$')][string]$Tag)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'verificar_aplicador.ps1')
$preparePython = 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe'
$preparePointer = [IntPtr]::Zero
$prepareSecure = $null
$prepareExit = 1
try {
    $prepareSecure = ConvertTo-SecureString -String ((Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\access-password.dpapi' -Raw).Trim())
    $preparePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($prepareSecure)
    $env:SANISIDRO_ACCESS_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($preparePointer)
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    $prepareTokenFile = 'C:\SanIsidro\ZKSync\api-token.dpapi'
    if (Test-Path -LiteralPath $prepareTokenFile) {
        $prepareTokenSecure = ConvertTo-SecureString -String ((Get-Content -LiteralPath $prepareTokenFile -Raw).Trim())
        $prepareTokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($prepareTokenSecure)
        try { $env:SANISIDRO_API_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($prepareTokenPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($prepareTokenPointer); $prepareTokenSecure.Dispose() }
    }
    & $preparePython -B (Join-Path $PSScriptRoot 'preparar_aplicacion.py') --preparar --tag $Tag
    $prepareExit = $LASTEXITCODE
}
catch {
    Write-Output ('PREPARACION NO INICIADA/INTERRUMPIDA. Tipo: ' + $_.Exception.GetType().Name + '. No compartir credenciales.')
}
finally {
    Remove-Item Env:\SANISIDRO_ACCESS_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    if ($preparePointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($preparePointer) }
    if ($null -ne $prepareSecure) { $prepareSecure.Dispose() }
}
exit $prepareExit
