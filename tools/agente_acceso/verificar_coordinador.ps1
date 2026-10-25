$ErrorActionPreference = 'Stop'
$expected = @('ensayo_coordinador.py','coordinador.py','captura_rt.py','referencia_vigencias.py',
    'outbox.py','protocolo.py','emisor.py','credencial.py','agente.py',
    'lanzar_lectura_coordinador.ps1','verificar_coordinador.ps1','LEEME_COORDINADOR.md',
    'referencia_r2/sincronizar_vigencias.py','referencia_r2/sync_runtime.py',
    'referencia_r2/c3_worker.py','referencia_r2/c3_panel.py','referencia_r2/FUENTE.json',
    'runtime/lector_eventos.py')
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'COORDINADOR_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.release -ne '2026.10.24-1' -or $manifest.files.Count -ne $expected.Count) { throw 'Manifiesto inesperado.' }
foreach ($name in $expected) {
    $entry = @($manifest.files | Where-Object { $_.name -ceq $name })
    if ($entry.Count -ne 1) { throw "Entrada ausente o duplicada: $name" }
    $actual = (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $name) -Algorithm SHA256).Hash
    if ($actual -ne $entry[0].sha256) { throw "Hash distinto: $name" }
}
Write-Output 'PAQUETE VERIFICADO: Coordinador Ensayo 2026.10.24-1. Sin cargar SDK ni contactar C3.'
