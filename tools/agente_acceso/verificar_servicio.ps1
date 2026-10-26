$ErrorActionPreference = 'Stop'
$serviceManifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'SERVICIO_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($serviceManifest.release -ne '2026.10.26-2' -or @($serviceManifest.files).Count -lt 100 -or @($serviceManifest.files).Count -gt 160) { throw 'Manifiesto inesperado.' }
$serviceSeen = @{}
foreach ($serviceEntry in $serviceManifest.files) {
    if (-not $serviceEntry.name -or $serviceEntry.name -match '(^/|\\|(^|/)\.\.(/|$)|:)' -or $serviceSeen.ContainsKey($serviceEntry.name)) { throw 'Ruta repetida/invalida.' }
    $serviceSeen[$serviceEntry.name] = $true
    if ((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $serviceEntry.name) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $serviceEntry.sha256) { throw ('Archivo diferente: ' + $serviceEntry.name) }
}
Write-Output 'PAQUETE VERIFICADO: Servicio Integrado 2026.10.26-2. Sin SDK, red ni cambios de tareas.'
