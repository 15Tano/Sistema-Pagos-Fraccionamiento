$ErrorActionPreference = 'Stop'
$expected = @('preflight_dell.py', 'outbox.py', 'protocolo.py', 'credencial.py', 'LEEME_PREFLIGHT.md', 'verificar_preflight.ps1')
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'PREFLIGHT_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.release -ne '2026.10.23-1' -or $manifest.files.Count -ne $expected.Count) { throw 'Manifiesto inesperado.' }
foreach ($name in $expected) {
    $entry = @($manifest.files | Where-Object { $_.name -ceq $name })
    if ($entry.Count -ne 1) { throw "Entrada ausente o duplicada: $name" }
    $actual = (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $name) -Algorithm SHA256).Hash
    if ($actual -ne $entry[0].sha256) { throw "Hash distinto: $name" }
}
Write-Output 'PAQUETE VERIFICADO: Preflight Emisor 2026.10.23-1. Sin SDK ni red.'
