$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'VIGENCIAS_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.release -ne '2026.10.25-1' -or @($manifest.files).Count -ne 25) { throw 'Manifiesto inesperado.' }
$seen = @{}
foreach ($entry in $manifest.files) {
    if ($entry.name -match '(^/|\\|(^|/)\.\.(/|$)|:)' -or $seen.ContainsKey($entry.name)) { throw 'Ruta repetida/invalida.' }
    $seen[$entry.name] = $true
    $path = Join-Path $PSScriptRoot $entry.name
    if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw ('Archivo diferente: ' + $entry.name) }
}
Write-Output 'PAQUETE VERIFICADO: Nucleo Vigencias 2026.10.25-1. Sin SDK, red ni cambios de tareas.'
