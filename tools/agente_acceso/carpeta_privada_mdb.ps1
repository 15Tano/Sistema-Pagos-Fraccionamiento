param([Parameter(Mandatory=$true)][string]$Ruta)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $Ruta) { throw 'El destino debe ser nuevo.' }
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$systemSid = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')
$security = New-Object System.Security.AccessControl.DirectorySecurity
$security.SetAccessRuleProtection($true, $false)
$security.SetOwner($sid)
$inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
foreach ($identity in @($sid, $systemSid) | Select-Object -Unique) {
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', $inherit, 'None', 'Allow')
    [void]$security.AddAccessRule($rule)
}
[void][System.IO.Directory]::CreateDirectory($Ruta, $security)
$actual = [System.IO.Directory]::GetAccessControl($Ruta)
if (-not $actual.AreAccessRulesProtected) { throw 'Herencia no protegida.' }
$allowed = @($sid.Value, $systemSid.Value) | Select-Object -Unique
$rules = @($actual.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
if ($rules.Count -ne $allowed.Count) { throw 'Cantidad de permisos diferente.' }
foreach ($rule in $rules) {
    if ($rule.IsInherited -or $rule.IdentityReference.Value -notin $allowed -or $rule.AccessControlType -ne 'Allow' -or
        $rule.FileSystemRights -ne [System.Security.AccessControl.FileSystemRights]::FullControl -or $rule.InheritanceFlags -ne $inherit) {
        throw 'Permisos de carpeta diferentes.'
    }
}
Write-Output 'private_directory_ok'
