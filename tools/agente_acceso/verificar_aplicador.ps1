$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'APLICADOR_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.release -ne '2026.10.25-2' -or @($manifest.files).Count -ne 55) { throw 'Manifiesto inesperado.' }
$seen = @{}
foreach ($entry in $manifest.files) {
    if ($entry.name -match '(^/|\\|(^|/)\.\.(/|$)|:)' -or $seen.ContainsKey($entry.name)) { throw 'Ruta repetida/invalida.' }
    $seen[$entry.name] = $true
    if ((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $entry.name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw ('Archivo diferente: ' + $entry.name) }
}
Write-Output 'PAQUETE VERIFICADO: Aplicador Candidato 2026.10.25-2. Sin SDK, red ni cambios de tareas.'
