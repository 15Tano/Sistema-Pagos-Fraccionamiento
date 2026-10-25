$ErrorActionPreference='Stop'
$evExpected=@('envio_vigilado.py','bucle_envio.py','vigilancia_envio.py','simular_envio.py',
    'verificar_envio.ps1','LEEME_ENVIO_VIGILADO.md','tests/test_envio_vigilado.py',
    'runtime/entregar_coordinador.py','runtime/enlace_candidato.py',
    'runtime/control_operativo.py','runtime/salud_operativa.py',
    'runtime/outbox.py','runtime/protocolo.py','runtime/emisor.py','runtime/credencial.py')
$evManifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'ENVIO_SHA256SUMS.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if($evManifest.release -ne '2026.10.25-2' -or $evManifest.files.Count -ne $evExpected.Count){throw 'Manifiesto inesperado.'}
foreach($evName in $evExpected){
    $evEntry=@($evManifest.files | Where-Object {$_.name -ceq $evName})
    if($evEntry.Count -ne 1){throw 'Entrada ausente o duplicada.'}
    if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $evName) -Algorithm SHA256).Hash -ne $evEntry[0].sha256){throw "Hash distinto: $evName"}
}
Write-Output 'PAQUETE VERIFICADO: Envio Vigilado 2026.10.25-2. Sin SDK, red ni cambios de tareas.'
