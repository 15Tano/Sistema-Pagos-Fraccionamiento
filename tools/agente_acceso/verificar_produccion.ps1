$ErrorActionPreference='Stop'
$base=$PSScriptRoot
$manifest=Get-Content -LiteralPath (Join-Path $base 'OPERATIVA_SHA256SUMS.json') -Raw | ConvertFrom-Json
if ($manifest.release -ne '2026.10.30-1' -or $manifest.scope -ne 'production_r2_reference' -or $manifest.files.Count -lt 170 -or $manifest.files.Count -gt 200) { throw 'Manifiesto de produccion distinto.' }
$names=@{}
foreach ($row in $manifest.files) {
    $name=[string]$row.name
    if ([string]::IsNullOrWhiteSpace($name) -or $name.Contains('\') -or $name.Contains(':') -or $name.StartsWith('/') -or $name -match '(^|/)\.\.(/|$)' -or $names.ContainsKey($name)) { throw 'Ruta duplicada/ajena.' }
    $names[$name]=$true
    $file=Join-Path $base $name
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $row.sha256) { throw ('Fuente distinta: '+$name) }
}
foreach ($name in @('produccion_dell.py','produccion_config.py','produccion_r2.py','produccion_worker.py','produccion_emisor.py','produccion_instalador.py','produccion_paquete.py','runner_produccion.py','archivo_cierres.py')) {
    if (-not $names.ContainsKey($name)) { throw 'Release incompleto.' }
}
Write-Output 'PAQUETE PRODUCCION VERIFICADO: Lecturas 2026.10.30-1. Sin SDK, red ni cambios de tareas.'
