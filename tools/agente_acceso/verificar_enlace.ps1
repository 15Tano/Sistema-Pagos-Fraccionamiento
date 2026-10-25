$ErrorActionPreference='Stop'
$enExpected=@('enlace_candidato.py','panel_coordinador.ps1','mantenimiento_candidato.ps1',
    'control_operativo.py','salud_operativa.py','verificar_enlace.ps1','LEEME_ENLACE.md','cierres_manifest_referencia.json',
    'enlace_funciones.ps1','simular_enlace.py','tests/test_enlace_candidato.py','tests/enlace_ficticio.ps1')
$enManifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'ENLACE_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($enManifest.release -ne '2026.10.25-2' -or $enManifest.files.Count -ne $enExpected.Count){throw 'Manifiesto inesperado.'}
foreach($enName in $enExpected){
    $enEntry=@($enManifest.files | Where-Object {$_.name -ceq $enName})
    if($enEntry.Count -ne 1){throw 'Entrada ausente o duplicada.'}
    if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $enName) -Algorithm SHA256).Hash -ne $enEntry[0].sha256){throw "Hash distinto: $enName"}
}
Write-Output 'PAQUETE VERIFICADO: Enlace Candidato 2026.10.25-2. Sin SDK, red ni cambios de tareas.'
