$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskPython = 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\pythonw.exe'
$taskSecretFile = Join-Path $taskRoot 'access-password.dpapi'
$taskLauncherLog = Join-Path $taskRoot 'registros\launcher.log'
$taskPointer = [IntPtr]::Zero
$taskStage = 'leer credencial protegida'

try {
    $taskCipher = (Get-Content -LiteralPath $taskSecretFile -Raw).Trim()
    $taskSecure = ConvertTo-SecureString -String $taskCipher
    $taskStage = 'descifrar credencial con usuario de Windows'
    $taskPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecure)
    $env:SANISIDRO_ACCESS_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer)
    $tokenFile = Join-Path $taskRoot 'api-token.dpapi'
    if (Test-Path $tokenFile) {
        $tokenSecure = ConvertTo-SecureString -String ((Get-Content $tokenFile -Raw).Trim())
        $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenSecure)
        try { $env:SANISIDRO_API_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer); $tokenSecure.Dispose() }
    }
    $taskArguments = '"' + (Join-Path $taskRoot 'sincronizar_vigencias.py') + '" --aplicar --continuo'
    $taskStage = 'iniciar Python oculto'
    $taskProcess = Start-Process -FilePath $taskPython -ArgumentList $taskArguments -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru
    Remove-Item Env:\SANISIDRO_ACCESS_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)
    $taskPointer = [IntPtr]::Zero
    $taskStage = 'esperar resultado de Python'
    $taskProcess.WaitForExit()
    $taskProcess.Refresh()
    $taskExitCode = $taskProcess.ExitCode
    if ($null -eq $taskExitCode) { throw 'No se pudo obtener el codigo de salida de Python.' }
    if ($taskExitCode -ne 0) {
        Add-Content -LiteralPath $taskLauncherLog -Value ((Get-Date -Format s) + ' Python termino con codigo ' + $taskExitCode + '. Consultar sync.log.')
    }
    exit $taskExitCode
}
catch {
    # No escribir credenciales ni detalles del valor protegido.
    Add-Content -LiteralPath $taskLauncherLog -Value ((Get-Date -Format s) + ' Error en etapa: ' + $taskStage + '. Tipo: ' + $_.Exception.GetType().FullName + '. HRESULT: ' + $_.Exception.HResult)
    exit 1
}
finally {
    Remove-Item Env:\SANISIDRO_ACCESS_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    if ($taskPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)
    }
}
