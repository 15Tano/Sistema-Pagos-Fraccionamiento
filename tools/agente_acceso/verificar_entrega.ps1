$ErrorActionPreference = 'Stop'
$expected = @('entregar_coordinador.py','LEEME_ENTREGA.md','verificar_entrega.ps1')
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'ENTREGA_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.release -ne '2026.10.24-1' -or $manifest.files.Count -ne $expected.Count) { throw 'Manifiesto inesperado.' }
foreach ($name in $expected) {
    $entry = @($manifest.files | Where-Object { $_.name -ceq $name })
    if ($entry.Count -ne 1) { throw "Entrada ausente o duplicada: $name" }
    $actual = (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $name) -Algorithm SHA256).Hash
    if ($actual -ne $entry[0].sha256) { throw "Hash distinto: $name" }
}
Write-Output 'PAQUETE VERIFICADO: Entrega Coordinador 2026.10.24-1. Sin SDK ni conexion al servidor.'
