$ErrorActionPreference='Stop'
$expected=@('lector_eventos.py','LEEME.md','test_lector.py','verificar_paquete.ps1')
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($manifest.release -ne '2026.10.23-5'){throw 'Version de manifiesto inesperada.'}
if($manifest.files.Count -ne $expected.Count){throw 'Cantidad de archivos inesperada.'}
foreach($name in $expected){
    $entries=@($manifest.files | Where-Object {$_.name -ceq $name})
    if($entries.Count -ne 1){throw "Entrada ausente o duplicada: $name"}
    $actual=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $name) -Algorithm SHA256).Hash
    if($actual -ne $entries[0].sha256){throw "Hash distinto: $name"}
}
Write-Output 'PAQUETE VERIFICADO: Diagnostico Eventos 2026.10.23-5. No se cargo DLL ni se contacto C3.'
