$ErrorActionPreference = 'Stop'
$operationManifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'OPERATIVA_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($operationManifest.release -ne '2026.10.26-1' -or @($operationManifest.files).Count -lt 130 -or @($operationManifest.files).Count -gt 200) { throw 'Manifiesto operativo inesperado.' }
$operationSeen = @{}
foreach ($operationEntry in $operationManifest.files) {
    if (-not $operationEntry.name -or $operationEntry.name -match '(^/|\\|(^|/)\.\.(/|$)|:)' -or $operationSeen.ContainsKey($operationEntry.name)) { throw 'Ruta repetida/invalida.' }
    $operationSeen[$operationEntry.name] = $true
    if ((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $operationEntry.name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $operationEntry.sha256) { throw ('Archivo diferente: ' + $operationEntry.name) }
}
Write-Output 'PAQUETE VERIFICADO: Preparacion Operativa 2026.10.26-1. Sin SDK, red ni cambios de tareas.'
