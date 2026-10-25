$ErrorActionPreference = 'Stop'
$expected = @('adaptadores_cierre.py','ensayo_cierres.py','trabajador_controlado.py',
    'control_operativo.py','captura_rt.py','coordinador.py','outbox.py','protocolo.py',
    'referencia_vigencias.py','referencia_r2/sincronizar_vigencias.py','referencia_r2/sync_runtime.py',
    'referencia_r2/c3_worker.py','referencia_r2/c3_panel.py','referencia_r2/FUENTE.json',
    'runtime/lector_eventos.py','lanzar_cierres.ps1','verificar_cierres.ps1',
    'LEEME_CIERRES.md','tests/test_adaptadores_cierre.py')
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'CIERRES_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.release -ne '2026.10.24-1' -or $manifest.files.Count -ne $expected.Count) { throw 'Manifiesto inesperado.' }
foreach ($name in $expected) {
    $entry = @($manifest.files | Where-Object { $_.name -ceq $name })
    if ($entry.Count -ne 1) { throw "Entrada ausente o duplicada: $name" }
    $actual = (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $name) -Algorithm SHA256).Hash
    if ($actual -ne $entry[0].sha256) { throw "Hash distinto: $name" }
}
Write-Output 'PAQUETE VERIFICADO: Cierres Coordinador 2026.10.24-1. Sin cargar SDK ni contactar C3.'
