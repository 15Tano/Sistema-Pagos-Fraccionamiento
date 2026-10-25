# Captura controlada C3 — 2026.10.24-1

Una sola presentacion de tag conocido, una sesion SDK a la vez. Usa exactamente
la DLL x86 instalada y sus guardas de hash/serial/mantenimiento/bloqueo, mediante
lector_eventos.py ya utilizado. Sin SDK nuevo ni sustitucion de bibliotecas.
No escribe configuracion, reloj, vigencias ni permisos; no modifica Access/API.
No envia eventos al backend. La presentacion puede accionar normalmente la pluma.

Este paquete evita el modo antiguo de dos clientes simultaneos. Los ZIP anteriores
se conservan, pero no ejecutar el ensayo controlado antiguo de lector_eventos.py.
GetRTLog puede avanzar la cola temporal; ZKAccess y otras utilidades SDK deben
estar cerradas. Polling pausado solo desde el gestor; no borrar sync.lock.

## Preparar en PowerShell de Dell, sin pausar aun

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Captura_Tag_C3_2026.10.24-1.zip' -DestinationPath 'C:\SanIsidro\CapturaTag_20261024'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\CapturaTag_20261024\verificar_captura.ps1'
```

Elegir una pluma concreta y un momento de poco transito. Dejar el tag lejos de la
antena. Anotar si fisicamente es entrada o salida y el nombre visible del sistema
si se conoce; no inferir que coincide con DoorID 1 o 2.

## Pausa y captura

1. Cerrar ZKAccess y otras utilidades SDK. Conservar las camaras.
2. En GestionTags, pulsar **Preparar mantenimiento** y esperar confirmacion.
3. No usar consultas/altas del gestor mientras corre la captura.
4. Ejecutar en PowerShell de Dell:

```powershell
$plumaCaptura = Read-Host 'Pluma fisica que vas a probar (entrada o salida; agrega nombre si lo conoces)'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\CapturaTag_20261024\captura_controlada.py' --tag 12230693 --pluma $plumaCaptura --seconds 60
```

Al pedirlo, mantener el tag lejos y pulsar ENTER. Lee historial previo y prepara
la base RT hasta dos respuestas 255 separadas por al menos un segundo, sin eventos
ni vacios entre ambas. Limite de preparacion 60 s / 300 consultas. Conserva todas
las respuestas originales, incluidas las de otros tags. Si no logra esa base,
no se arma y termina inconcluso: no presentar el tag ni repetir automaticamente.

Solo cuando muestre **ARMADO: presente el tag 12230693 UNA vez...**, acercarlo a
la antena y retirarlo, sin repetir. Hay hasta 60 s para presentarlo. Observar si
abre, rechaza o no responde. Cuando diga Tag recibido, dejarlo lejos. Otra tarjeta
del trafico normal no se selecciona como muestra de este tag.

El lector guarda evento y relectura RT inmediata, historial posterior y relectura;
cierra A antes de reconectar B. Tras reconexion lee RT/historial. Correlaciona la
tupla completa y multiplicidad, usando Time_second documentado, sin asignarle
zona inferida. Confirma nuevos registros solo si aumento su cantidad respecto al
historial previo y permanecen tras relectura/reconexion, sin faltar filas previas.
Finalmente pide anotar pluma, hora aproximada y respuesta fisica observada.

rt_and_new_history_confirmed_pending_operator_review significa correlacion nueva
obtenida; revisar salida y nota fisica antes de dar por confirmado el mapa de
plumas. rt_captured_history_pending_review conserva RT pero no acredita esa nueva
persistencia. No ver el tag en 60 s es inconcluso. Un evento autorizado no demuestra
cruce del vehiculo, y esta herramienta no certifica la vigencia web del tag.

## Reanudar siempre, termine bien o falle

Esperar **Cierre diagnostico**, pulsar **Terminar y reanudar** en el gestor.
No reanudar con el lector activo. Esperar dos ciclos (~2 minutos) y compartir:

```powershell
Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\registros\estado.json'
Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\registros\sync.log' -Tail 15
```

Conservar la carpeta registros indicada al inicio: resumen.json, payload.bin exacto,
buffer.bin completo y metadatos con retorno, horas y SHA256 por cada llamada.
Compartir salida de captura y reanudacion; no publicar archivos con tags de otros
residentes. El efecto en ZKAccess/cursor incremental y la concurrencia con polling
siguen fuera del alcance; no abrirlos durante la prueba.
