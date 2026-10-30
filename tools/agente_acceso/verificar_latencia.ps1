$ErrorActionPreference='Stop'
$latManifestPath=Join-Path $PSScriptRoot 'LATENCIA_SHA256SUMS.json'
if ((Get-Item -LiteralPath $latManifestPath).Length -gt 131072) { throw 'Manifiesto excedido.' }
$latManifest=Get-Content -LiteralPath $latManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($latManifest.release -ne '2026.10.28-2' -or @($latManifest.files).Count -lt 150 -or @($latManifest.files).Count -gt 200) { throw 'Manifiesto inesperado.' }
$latSeen=@{}
foreach ($latEntry in $latManifest.files) {
    if (-not $latEntry.name -or $latEntry.name -match '(^/|\\|(^|/)\.\.(/|$)|:)' -or $latSeen.ContainsKey($latEntry.name)) { throw 'Ruta repetida/invalida.' }
    $latSeen[$latEntry.name]=$true
    if ((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $latEntry.name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $latEntry.sha256) { throw ('Archivo diferente: '+$latEntry.name) }
}
Write-Output 'PAQUETE VERIFICADO: Latencia Candidata 2026.10.28-2. Sin SDK, red ni cambios de tareas.'
