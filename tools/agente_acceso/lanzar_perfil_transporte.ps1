$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'verificar_transporte_aplicador.ps1')
$perfilPython = 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe'
$perfilRun = [guid]::NewGuid().ToString()
& $perfilPython -B (Join-Path $PSScriptRoot 'transporte_aplicador.py') --capturar-readonly --run-id $perfilRun
$perfilExit = $LASTEXITCODE
& $perfilPython -B (Join-Path $PSScriptRoot 'transporte_aplicador.py') --verificar-cierre --run-id $perfilRun
if ($LASTEXITCODE -ne 0) {
    Write-Output 'CIERRE NO CONFIRMADO. Conservar mantenimiento y evidencia.'
    exit 1
}
exit $perfilExit
