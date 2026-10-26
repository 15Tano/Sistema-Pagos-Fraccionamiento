$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'INTEGRACION_APLICADOR_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.release -ne '2026.10.25-1' -or @($manifest.files).Count -ne 86) { throw 'Manifiesto inesperado.' }
$seen = @{}
foreach ($entry in $manifest.files) {
    if (-not $entry.name -or $entry.name -match '(^/|\\|(^|/)\.\.(/|$)|:)' -or $seen.ContainsKey($entry.name)) { throw 'Ruta repetida/invalida.' }
    $seen[$entry.name] = $true
    if ((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $entry.name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw ('Archivo diferente: ' + $entry.name) }
}
Write-Output 'PAQUETE VERIFICADO: Integracion Aplicador 2026.10.25-1. Sin SDK, red ni cambios de tareas.'
