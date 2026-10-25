$ErrorActionPreference='Stop'
$jcOwn=@('ensayo_conjunto.py','coordinacion_conjunta.py','simular_conjunto.py','verificar_conjunto.ps1',
    'LEEME_CONJUNTO.md','tests/test_conjunto.py','lector_conjunto.py','lanzar_lector_conjunto.ps1')
$jcManifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'CONJUNTO_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($jcManifest.release -ne '2026.10.25-1' -or $jcManifest.files.Count -ne 44){throw 'Manifiesto inesperado.'}
if(@($jcManifest.files | Where-Object {$_.name -like 'lector/*'}).Count -ne 20 -or
   @($jcManifest.files | Where-Object {$_.name -like 'envio/*'}).Count -ne 16){throw 'Fuentes publicadas incompletas.'}
foreach($jcName in $jcOwn){
    if(@($jcManifest.files | Where-Object {$_.name -ceq $jcName}).Count -ne 1){throw 'Fuente propia ausente o duplicada.'}
}
foreach($jcEntry in $jcManifest.files){
    if($jcEntry.name.Contains('..') -or [IO.Path]::IsPathRooted($jcEntry.name) -or
       @($jcManifest.files | Where-Object {$_.name -ceq $jcEntry.name}).Count -ne 1){throw 'Ruta invalida/duplicada.'}
    if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $jcEntry.name) -Algorithm SHA256).Hash -ne $jcEntry.sha256){throw ('Hash distinto: '+$jcEntry.name)}
}
Write-Output 'PAQUETE VERIFICADO: Ensayo Conjunto 2026.10.25-1. Sin SDK, red ni cambios de tareas.'
