param([ValidateRange(5,150)][int]$Seconds=150)
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'verificar_conjunto.ps1')
$jcPython='C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe'
$jcSecure=$null
$jcPointer=[IntPtr]::Zero
$jcExit=1
try{
    $jcSecure=ConvertTo-SecureString -String ((Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\access-password.dpapi' -Raw).Trim())
    $jcPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($jcSecure)
    $env:SANISIDRO_ACCESS_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($jcPointer)
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    $jcTokenFile='C:\SanIsidro\ZKSync\api-token.dpapi'
    if(Test-Path -LiteralPath $jcTokenFile){
        $jcTokenSecure=ConvertTo-SecureString -String ((Get-Content -LiteralPath $jcTokenFile -Raw).Trim())
        $jcTokenPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($jcTokenSecure)
        try{$env:SANISIDRO_API_TOKEN=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($jcTokenPointer)}
        finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($jcTokenPointer);$jcTokenSecure.Dispose()}
    }
    & $jcPython -B (Join-Path $PSScriptRoot 'lector_conjunto.py') --mantenimiento --seconds $Seconds
    $jcExit=$LASTEXITCODE
}catch{
    Write-Output ('LECTOR CONJUNTO INTERRUMPIDO: '+$_.Exception.GetType().Name+'. No compartir credenciales.')
}finally{
    Remove-Item Env:\SANISIDRO_ACCESS_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\SANISIDRO_API_TOKEN -ErrorAction SilentlyContinue
    if($jcPointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($jcPointer)}
    if($null -ne $jcSecure){$jcSecure.Dispose()}
}
exit $jcExit
