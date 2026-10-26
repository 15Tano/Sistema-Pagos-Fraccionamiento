$ErrorActionPreference='Stop'
$pilotManifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'PILOTO_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($pilotManifest.release -ne '2026.10.26-2' -or @($pilotManifest.files).Count -lt 155 -or @($pilotManifest.files).Count -gt 200){throw 'Manifiesto piloto inesperado.'}
$pilotSeen=@{}
foreach($pilotFile in $pilotManifest.files){
    if(-not $pilotFile.name -or $pilotFile.name -match '(^/|\\|(^|/)\.\.(/|$)|:)' -or $pilotSeen.ContainsKey($pilotFile.name)){throw 'Ruta ajena/repetida.'}
    $pilotSeen[$pilotFile.name]=$true
    if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $pilotFile.name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pilotFile.sha256){throw ('Fuente diferente: '+$pilotFile.name)}
}
Write-Output 'PAQUETE VERIFICADO: Piloto Vigencias 2026.10.26-2. Sin SDK, red ni cambios de tareas.'
