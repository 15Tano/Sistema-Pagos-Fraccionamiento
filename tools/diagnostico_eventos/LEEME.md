# Lector diagnostico de eventos C3 — 2026.10.23-5

Preparado para Dell, C3-200 CO2K225060027, 192.168.1.201:4370.
La ejecucion real de RT sigue pendiente; el historial ya se valido en caseta.
No instalar como tarea ni dejarlo capturando.

## Fin de cola y comparacion de reloj (release 5, siguiente prueba)

Usar --revisar-cola en una sola sesion, durante un maximo de 60 segundos de
consultas y 300 llamadas RT (lo que ocurra primero). Cada consulta guarda buffer,
payload y metadatos; leer RT puede avanzar su cola temporal, como ya se observo.
No se borra historial ni se configura el controlador. Separacion entre consultas:
200 ms mas el tiempo de llamada y persistencia; no se hacen conexiones simultaneas.

La guia PullSDK v2.0, anexo 2, marca DateTime como **Write only** para sincronizar
hora. Por ello no se intenta consultar DateTime ni enviar SetDeviceParam. Anexo 7
describe una respuesta de estado codigo 255 cuando no se entregan eventos de la
cache. Se buscan dos respuestas de ese tipo separadas al menos un segundo, sin
eventos/vacios/buffers mixtos entre ellas. Esa observacion es del instante probado,
no una garantia permanente de que no haya mas trafico.

Cada muestra de estado compara su hora con el punto medio de inicio/fin de llamada
del PC. Conserva timestamps locales con offset y UTC, duracion y clave de zona de
Windows leida del registro. device_minus_pc_seconds negativo indica hora de estado
anterior al PC; positivo, posterior. La precision esta limitada por duracion de
llamada y resolucion de segundos del SDK. No certifica la hora externa del PC, ni
identifica por si sola zona/DST configurados en el controlador. No corrige nada.

Extraer/verificar release 5 en carpeta nueva. Con ZKAccess cerrado, preparar
mantenimiento desde el gestor y esperar confirmacion. Ejecutar:

```powershell
& 'C:\Users\Dell\Python32\python.exe' 'C:\SanIsidro\DiagnosticoEventos_20261023_r5\lector_eventos.py' --revisar-cola --seconds 60 --max-consultas 300
```

La ultima llamada/cierre se suman al plazo; no interrumpirlos para forzar 60 exactos.
Si se alcanza el limite sin dos estados, resultado limit_reached_queue_end_unconfirmed;
no inferir fin de cola, no repetir automaticamente ni aumentar limites sin revisar.
Si aparece two_status_responses_pending_clock_review, revisar las dos muestras,
offset del PC y diferencia relativa antes de afirmar reloj/frescura correctos.
Error/formato desconocido deja estado incomplete y conserva los originales.

Al terminar o fallar, usar Terminar y reanudar en el gestor y comprobar dos ciclos
posteriores. Compartir salida y resumen.json. Mantener separadas las preguntas:
fin de cola, reloj relativo y correspondencia fisica de puertas.
Usuario solo recuerda nombres Pluma 1/Pluma 2; no se ha confirmado que DoorID 1/2
correspondan a esos nombres, ni cual es entrada/salida. No inferirlo del sentido
registrado en eventos ni cambiar configuracion para comprobarlo.

Validacion local: trece pruebas simuladas aprobadas sin SDK/red/hardware, incluidos
limites, vacios, reinicio de confirmacion por eventos y cierre ante errores.
Esta nueva prueba aun no se ha ejecutado en caseta. Historial y extraccion RT ya
comprobados con versiones anteriores; los ZIP originales permanecen preservados.

## Observar RT remotamente por trafico normal (release 4, siguiente prueba)

Historial validado por usuario en release 3: cinco consultas secuenciales identicas,
121 registros del tag 6344928, mismos hashes, missing=0/added=0. Polling reanudado
y dos ciclos correctos a las 20:04:44 y 20:05:47 del 23 octubre. RT aun no probado.

Release 4 agrega --observar-rt sin requerir numero conocido ni presentacion fisica.
Extraer y verificar en carpeta nueva C:\SanIsidro\DiagnosticoEventos_20261023_r5.
Cerrar ZKAccess/otras utilidades SDK y pulsar Preparar mantenimiento en el gestor.
Esperar confirmacion y ejecutar:

```powershell
& 'C:\Users\Dell\Python32\python.exe' 'C:\SanIsidro\DiagnosticoEventos_20261023_r5\lector_eventos.py' --observar-rt --seconds 60
```

Una sesion A lee una base RT y la relee inmediatamente. Observa hasta 60 segundos
buscando un evento de tarjeta que difiera de esa base. Guarda todas las respuestas,
selecciona un evento como muestra y lo relee inmediatamente. Si no aparece otro,
puede usar un evento de la base, indicando expresamente su alcance. No ver un tag
en la ventana es inconcluso; no requiere provocar trafico ni modificar permisos.

Con una muestra, consulta historial de ese numero, cierra A antes de abrir B,
lee RT tras reconectar y vuelve a consultar ese historial. Las consultas SDK y el
cierre se suman a los 60 segundos de observacion: no es un limite global exacto.
No usa clientes simultaneos. Conserva todos los buffers y una muestra interpretada;
no asigna ese numero a nadie, ni decide vigencias ni acredita paso fisico.
Si aparece un formato RT inesperado, guarda el original y aborta sin adivinarlo.

Resultados posibles:
- rt_after_baseline_pending_review: muestra diferente de la base observada;
  no demuestra por si sola que se genero en ese momento ni que el reloj sea correcto.
- rt_baseline_only_pending_review: solo se identifico un evento de la base;
  no certificar entrega de eventos nuevos con este resultado.
- rt_no_card_event_inconclusive: no hubo muestra de tarjeta en esta ventana;
  conservar respuestas de estado y originales para revisar.
- incomplete: error; revisar la evidencia ya guardada.

Los booleanos selected_in_reread y selected_after_reconnect comparan la tupla RT
completa seleccionada; la ausencia en una muestra no demuestra por si sola borrado
de historial o consumo global. La comparacion history_A/history_B es del historial
del tag elegido: aun hay que correlacionar el evento RT con la fila historica y
revisar todos sus campos y fecha. GetRTLog puede afectar la cache consultada por
otros clientes, razon por la cual ZKAccess y polling se excluyen durante el ensayo.
Se prueban nuestros clientes secuenciales; New Record y clientes externos siguen
fuera de la validacion.

Al terminar o fallar, pulsar Terminar y reanudar. Compartir salida y resumen.json;
comprobar otra vez estado y dos ciclos posteriores de polling como se indica abajo.

## Consulta por AnyDesk sin presencia en caseta (release 3)

El usuario opera remotamente y no puede presentar un tag. Usar --historial-secuencial:
consulta eventos existentes del numero elegido en transaction, relee en A, cierra A,
conecta y relee con B, cierra B y reconecta con C. Guarda cinco respuestas originales
y sus comparaciones. No pide presentar tags ni llama GetRTLog en este modo.
No hace falta tener fisicamente el tag; basta su numero en el sistema.

Extraer el ZIP release 3 en carpeta nueva C:\SanIsidro\DiagnosticoEventos_20261023_r5,
verificar paquete, cerrar ZKAccess, pulsar Preparar mantenimiento en el gestor y
esperar confirmacion. Despues ejecutar:

```powershell
$tagDiagnostico = Read-Host 'Numero del tag cuyo historial quieres consultar'
& 'C:\Users\Dell\Python32\python.exe' 'C:\SanIsidro\DiagnosticoEventos_20261023_r5\lector_eventos.py' --historial-secuencial --tag $tagDiagnostico
```

Al terminar o fallar, pulsar Terminar y reanudar en el gestor y verificar dos ciclos
correctos como se indica abajo. Compartir salida y resumen.json.
Una respuesta vacia se informa como history_empty_pending_review: no es evidencia
de un evento. Las filas recibidas se muestran en orden del SDK, sin afirmar que sean
las mas recientes. Comparar el mismo registro entre clientes prueba solo la muestra
historica, sin inferir el comportamiento de RT, New Record o ZKAccess.
La captura controlada descrita mas adelante requiere colaboracion fisica en caseta
y queda pendiente. El preflight release 1 ya fue confirmado en el equipo por el
usuario; se conserva el mismo hash requerido y las mismas firmas.

Evidencia release 2: A y su relectura y B devolvieron los mismos 121 registros de
6344928; SHA256 del payload DC04CB75A5D19EAF59F501BEEFDC1746C08F448BF4881F59DB9EE979717C7B70.
A fallo con -2 al volver a consultarlo despues de B. No repetir por ahora el modo
--historial con sesiones simultaneas ni la captura controlada anterior. Release 3
agrega el modo secuencial para terminar la comprobacion de reconexion. Comprueba
cierre y salida de cada proceso antes del siguiente; no cambia el polling.
Los hashes y conteos se imprimen al guardar cada lectura, incluso si una posterior
falla. Bytes de una respuesta con retorno negativo son solo evidencia diagnostica,
nunca se interpretan como eventos validos.

## Documentacion y compatibilidad

Referencia primaria: manual del fabricante **PullSDK Interfaces User Guide v2.0,
enero 2012**, disponible como [documento original en un repositorio espejo](https://github.com/licjapodaca/Pull-SDK-Demo/blob/master/PullSDK%20User%20Guide-EN%20V2.0-201201.doc)
y [transcripcion consultada](https://studylib.net/doc/25652460/pullsdk-user-guide-en-v2.0-201201).
El espejo no certifica la version instalada. No se descarga ni instala su SDK.

Contrato documentado (secciones 4.1, 4.2, 4.4, 4.7, 4.10 y 4.13):

| Funcion | Uso en el lector |
| --- | --- |
| Connect / Disconnect | Sesion TCP; HANDLE como puntero, como el lector operativo existente. |
| GetDeviceParam(HANDLE, char*, int, const char*) | Leer ~SerialNumber y exigir el equipo esperado. |
| GetRTLog(HANDLE, char*, int) | Buffer de eventos o estado; retorno negativo indica error. |
| GetDeviceData(HANDLE, char*, int, const char*, const char*, const char*, const char*) | transaction, campos *, filtro Cardno=numero, opciones vacias. |
| PullLastError() | Diagnostico si Connect devuelve cero. |

El anexo 4 distingue Cardno de transaction de CardNo de user; son sensibles a
mayusculas. El anexo 7 distingue eventos RT de estado (codigo 255) y describe una
cache de hasta 30 eventos. No documenta garantias de entrega entre clientes.
No usamos la opcion incremental New Record: su cursor queda fuera de esta prueba.

Antes de conectar se exige PE x86, Python32, hash del inventario real del
14 octubre y todas las exportaciones necesarias. DLL esperada: version observada
2.2.1.1, SHA256 82bda08dbbab24b918ebe7de68eeb3e4fb952f275eecc992cb9148c5384a413a.
Exportaciones compatibles no prueban soporte del firmware ni ausencia de efectos
en otros clientes. Las consultas reales comprobaran esos comportamientos.

La herramienta carga la DLL por ruta absoluta y busca dependencias en NewSDK y
Windows. No copia bibliotecas, registra SDK, escribe configuracion del equipo,
consulta la API ni abre Access. Solo declara las funciones de la tabla anterior.
La API conserva toda autoridad de vigencias.

## Preparacion en la caseta

1. Transferir el ZIP a Downloads de Dell por el medio habitual.
2. En PowerShell como administrador, con el usuario Dell, extraer a carpeta nueva:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Diagnostico_Eventos_2026.10.23-5.zip' -DestinationPath 'C:\SanIsidro\DiagnosticoEventos_20261023_r5'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\DiagnosticoEventos_20261023_r5\verificar_paquete.ps1'
& 'C:\Users\Dell\Python32\python.exe' 'C:\SanIsidro\DiagnosticoEventos_20261023_r5\lector_eventos.py' --preflight
```

Esta comprobacion no llama Connect y puede hacerse antes del mantenimiento.
Conservar compatibilidad.json. Si falta una funcion, falla carga o cambia el hash,
detenerse y compartir la salida; no reemplazar DLL ni registrar otro SDK.

3. Cerrar ZKAccess y otras utilidades SDK antes del ensayo. Mantener las camaras.
4. Abrir el gestor instalado:

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File 'C:\SanIsidro\GestionTags\GestionTags.ps1'
```

5. Pulsar **Preparar mantenimiento**, esperar confirmacion de pausa. No ejecutar
altas/consultas desde el gestor durante el diagnostico. El lector exige mantenimiento
activo, ausencia de revision pendiente y tarea deshabilitada/no Running. Toma el
sync.lock existente con el mismo bloqueo Windows que el polling, durante toda la
prueba. No se borra el lock. No usar Terminar y reanudar mientras el lector corre.

## Ensayo controlado (tres presentaciones)

Elegir un tag conocido cuyo numero se pueda verificar. Anotar pluma y hora local.
Usar un periodo de poco transito; retirar el tag tras cada presentacion y esperar
al menos dos segundos antes de la siguiente. No cambiar pagos o vigencias para
provocar resultados. La presentacion puede accionar normalmente la pluma.

```powershell
$tagDiagnostico = Read-Host 'Numero decimal del tag conocido'
$plumaDiagnostico = Read-Host 'Pluma observada (por ejemplo entrada o salida)'
& 'C:\Users\Dell\Python32\python.exe' 'C:\SanIsidro\DiagnosticoEventos_20261023_r5\lector_eventos.py' --tag $tagDiagnostico --pluma $plumaDiagnostico --seconds 45
```

La herramienta crea procesos A y B independientes, cada uno con su sesion SDK.
La segunda conexion es parte del experimento; un fallo cancela la prueba.

1. Consulta historial filtrado en A y B. Al pulsar ENTER obtiene una lectura base
en ambos. Cuando diga ARMADO, presentar el tag una sola vez. A busca el numero
exacto, excluyendo respuestas de estado y eventos identicos a la base. Guarda
evento, relectura inmediata de A y consulta de B. Despues consulta y relee historial.
Anotar respuesta fisica, hora y posibles lecturas adicionales cuando lo pida.
2. Repite con B primero y A despues. Eso permite comprobar el efecto del orden.
3. Nueva base; presentar una vez y pulsar ENTER inmediatamente. A consulta primero
el historial y despues B consulta RT. Guarda tambien RT de A e historial de B.
4. Cierra A/B, abre otro proceso C y consulta RT e historial tras reconectar.

El numero de puerta se conserva como valor del equipo. Solo la observacion del
operador permite relacionarlo con una pluma real. La hora del evento se conserva
sin asignarle una zona inferida; las llamadas llevan tiempos UTC del PC.

Si falta el evento, falla la segunda conexion, el filtro no funciona o el SDK
devuelve error, se conservan evidencias y se interrumpe. No se intenta una descarga
completa ni se cambia de API automaticamente. Un Ctrl+C permite terminar: esperar
el mensaje de cierre antes de reanudar. Ante cierre forzado de la consola, comprobar
que no queden procesos con lector_eventos.py antes de terminar mantenimiento.

## Reanudacion obligatoria al terminar o fallar

En el gestor pulsar **Terminar y reanudar**. El lector no cambia el estado de la
tarea por su cuenta. El gestor restaura el estado previo: si ya estaba desactivada,
lo conserva y lo informa. Comprobar despues el estado y dos ciclos recientes:

```powershell
Get-ScheduledTask -TaskName 'SanIsidro-Vigencias' | Format-List TaskName,State
Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\registros\estado.json'
Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\registros\sync.log' -Tail 15
```

Para la aceptacion necesitamos hora actual, phase, PID, errores y last_ok_utc,
ademas de dos CICLO TERMINADO: correcto posteriores a la reanudacion. Running por
si solo no acredita sincronizacion correcta. La vigilancia puede alertar durante
el mantenimiento; conservar su configuracion y contrastar fechas al reanudar.

## Evidencia y criterio de interpretacion

registros/FECHA contiene resumen.json, stderr de cada proceso y, por llamada,
buffer.bin completo, payload.bin exacto hasta el primer NUL y JSON con retorno,
horas, hashes y lectura interpretada. Se guardan bytes ANTES de interpretar incluso
si la respuesta falla. Los archivos permanecen locales; pueden incluir otros tags
que hayan pasado durante el ensayo. No subirlos al repositorio.

Compartir compatibilidad.json, resumen.json, JSON y payload.bin de las lecturas
relevantes y la salida de reanudacion. Conservar los buffers completos para auditoria.

- Identificacion: numero conocido + evento posterior a la base + presentacion/hora
anotada. La autorizacion registrada no acredita el cruce del vehiculo.
- Relectura: comparar tupla completa tiempo/pin/tarjeta/puerta/codigo/direccion/modo.
No basta encontrar el mismo numero de tarjeta: podria ser otra presentacion.
- Otros clientes: comprobar la misma tupla en A y B y repetir con el orden inverso.
Si solo la recibe el primero, registrar posible consumo compartido. Si no aparece,
resultado inconcluso: desconexion, demora o cache tambien pueden explicarlo.
- Historial: comparar filas con multiplicidad, conservar anteriores y observar las
nuevas, tambien tras reconexion. Missing_rows distinto de vacio requiere revisar.
- El tercer experimento muestra RT de B despues de consulta historica de A.
Comprobar el evento controlado en esos archivos y en el historial, sin concluir
independencia universal por una sola muestra.

El resultado captured_pending_review significa evidencias tomadas, no aprobacion
de concurrencia. Esta prueba cubre nuestros procesos y las funciones seleccionadas.
El efecto en ZKAccess 3.5 y su descarga incremental sigue pendiente: abrir ese
programa puede sincronizar hora/configuracion segun sus ajustes. No abrirlo para
el ensayo sin revisar antes esos ajustes. Tampoco se prueba concurrencia con el
polling, que permanece pausado. Si no hay entrega independiente, el futuro agente
debera centralizar la lectura y distribuir eventos, antes de considerar su instalacion.
