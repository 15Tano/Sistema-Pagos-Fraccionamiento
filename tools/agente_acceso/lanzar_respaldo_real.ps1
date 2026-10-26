$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'verificar_respaldo_real.ps1')
$respaldoPython = 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe'
$respaldoPointer = [IntPtr]::Zero
$respaldoSecure = $null
$respaldoExit = 1
$respaldoStarted = $false
$respaldoRun = [guid]::NewGuid().ToString()
try {
    $respaldoSecure = ConvertTo-SecureString -String ((Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\access-password.dpapi' -Raw).Trim())
    $respaldoPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($respaldoSecure)
    $env:SANISIDRO_ACCESS_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($respaldoPointer)
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    $respaldoStarted = $true
    & $respaldoPython -B (Join-Path $PSScriptRoot 'respaldo_real_mdb.py') --respaldar --run-id $respaldoRun
    $respaldoExit = $LASTEXITCODE
}
catch {
    Write-Output ('RESPALDO NO CONFIRMADO. Tipo: ' + $_.Exception.GetType().Name + '. No compartir credenciales.')
}
finally {
    Remove-Item Env:\SANISIDRO_ACCESS_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    if ($respaldoPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($respaldoPointer) }
    if ($null -ne $respaldoSecure) { $respaldoSecure.Dispose() }
}
if ($respaldoStarted) {
    try {
        & $respaldoPython -B (Join-Path $PSScriptRoot 'respaldo_real_mdb.py') --verificar-cierre --run-id $respaldoRun
        if ($LASTEXITCODE -ne 0) { throw 'Verificador no confirmado.' }
    }
    catch {
        Write-Output ('CIERRE NO CONFIRMADO. Tipo: ' + $_.Exception.GetType().Name + '. Conservar mantenimiento y evidencia.')
        exit 1
    }
}
exit $respaldoExit
