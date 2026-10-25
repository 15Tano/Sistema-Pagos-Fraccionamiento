$ErrorActionPreference = 'Stop'
$expected = @('control_operativo.py','salud_operativa.py','trabajador_controlado.py',
    'revisar_operacion.py','verificar_operacion.ps1','LEEME_OPERACION.md')
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'OPERACION_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.release -ne '2026.10.24-2' -or $manifest.files.Count -ne $expected.Count) { throw 'Manifiesto inesperado.' }
foreach ($name in $expected) {
    $entry = @($manifest.files | Where-Object { $_.name -ceq $name })
    if ($entry.Count -ne 1) { throw "Entrada ausente o duplicada: $name" }
    $actual = (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $name) -Algorithm SHA256).Hash
    if ($actual -ne $entry[0].sha256) { throw "Hash distinto: $name" }
}
Write-Output 'PAQUETE VERIFICADO: Integracion Operativa 2026.10.24-2. Sin SDK ni cambios de tareas.'
