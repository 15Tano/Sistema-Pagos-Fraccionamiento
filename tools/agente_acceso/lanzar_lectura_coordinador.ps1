param(
    [Parameter(Mandatory=$true)][Guid]$Agente,
    [ValidateRange(5,180)][int]$Seconds = 150
)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'verificar_coordinador.ps1')
$coorPython = 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe'
$coorSecret = 'C:\SanIsidro\ZKSync\access-password.dpapi'
$coorPointer = [IntPtr]::Zero
$coorSecure = $null
$coorExit = 1
try {
    $coorSecure = ConvertTo-SecureString -String ((Get-Content -LiteralPath $coorSecret -Raw).Trim())
    $coorPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($coorSecure)
    $env:SANISIDRO_ACCESS_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($coorPointer)
    # Credencial en entorno del hijo x64, nunca argumentos o archivo de texto.
    & $coorPython -B (Join-Path $PSScriptRoot 'ensayo_coordinador.py') --mantenimiento --agente $Agente.ToString() --seconds $Seconds
    $coorExit = $LASTEXITCODE
}
catch {
    Write-Output ('ENSAYO NO INICIADO/INTERRUMPIDO. Tipo: ' + $_.Exception.GetType().Name + '. No compartir credenciales.')
}
finally {
    Remove-Item Env:\SANISIDRO_ACCESS_PASSWORD -ErrorAction SilentlyContinue
    if ($coorPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($coorPointer) }
    if ($null -ne $coorSecure) { $coorSecure.Dispose() }
}
exit $coorExit
