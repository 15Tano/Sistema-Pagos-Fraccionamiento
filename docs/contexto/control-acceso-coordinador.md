# Control de acceso: coordinador de ensayo

2026-10-24. Usuario autoriza siguiente etapa tras validar capturas fisicas y
entrega ficticia Dell -> Laravel aislado. Preparado y ensayado en lectura real
acotada: tres comparaciones, 93 respuestas, sin errores y polling reanudado con
dos ciclos correctos. Sin sustituir polling, gestor, vigilancia, DLL ni tareas.
No hay push/despliegue de esta etapa. Entrega de las93respuestas al backend
aislado confirmada por ACK; ver evidencia al final de este documento.

## Implementacion preparada

En tools/agente_acceso:
- coordinador.py: secuencia acotada, comparacion primero, cierre RT antes de cada
  nuevo ciclo, cola SQLite local y salud separada.
- captura_rt.py: trabajador x86 de lectura, IPC, originales durables y recovery.
- referencia_vigencias.py y referencia_r2/: cuatro fuentes congeladas del ZIP
  ZKSync_2026.10.14-r2, bytes/SHA256 verificados. Adaptador invoca exclusivamente
  cycle(password, False, None). No se modifican esas fuentes ni las originales
  sin seguimiento de tools/zkaccess.
- ensayo_coordinador.py: simulacion por defecto, lectura manual acotada bajo
  mantenimiento y peticion propia de parada por PID + run_id.
- lanzar_lectura_coordinador.ps1: lanzador manual x64 para etapa posterior, usa
  DPAPI Access instalada sin copiar secreto a texto ni pasarlo por argumentos.
- empaquetar_coordinador.py, verificar_coordinador.ps1, LEEME_COORDINADOR.md.

SDK: misma carga PE/hash/exports del lector diagnosticado, misma DLL x86 instalada,
Connect/Disconnect/GetRTLog/GetDeviceParam. No SDK nuevo ni funciones de escritura
en trabajador RT. Serial exigido CO2K225060027. Paquete incluye lector_eventos.py
en runtime/ con sus bytes existentes, no una DLL.

## Secuencia y salud

Primero comparacion readonly API/Access/C3 usando logica r2; al terminar espera
60 s, durante los que RT consulta cada 1 s. Antes del siguiente ciclo confirma
Disconnect y salida del trabajador x86. La prioridad se aplica entre operaciones;
una llamada iniciada puede retrasar turno o parada hasta finalizar/timeout.
Ensayo manual 150 s por defecto, maximo 180 s mas operaciones en curso/cierre;
el ciclo r2 conserva timeouts existentes. No aplica fechas, permisos ni validez.

Salud de comparacion en cycle_probe: completed, consecutive_errors, total_errors,
last_completed_utc. No significa ciclo operativo aplicado. Estado instalado se
lee/filtra al encolar snapshot, conservando PID, phase, last_ok_utc y errores
observados; exito RT no los reescribe. Salud propia en
datos/lectura_mantenimiento/estado.json, con scope de ensayo. No escribe estado
ni stop-file de la instalacion operativa. Lotes cada 5 s, snapshots cada 30 s.
No hace HTTP: emisor existente puede procesar la misma SQLite por separado.
Estado255 no prueba RTC ni ausencia permanente de trafico.

## Originales y fallos

Capacidad comprobada antes de GetRTLog. Trabajador guarda buffer completo, payload
y metadatos UUID/hash/retorno/UTC con flush/fsync antes de responder al padre;
este captura en SQLite usando ese UUID. Recovery guarda originales completos aun
sin encolar; mismo UUID no duplica. Archivo parcial/alterado impide continuar y
exige revision. Compatibilidad SDK se guarda aparte de los recibos.

Fallo SQLite/disco suspende RT y cierra trabajador; siguientes comparaciones
readonly conservan turno. Negativo, vacio, formato desconocido o buffer sin NUL
se conservan y suspenden RT hasta revisar/reiniciar. Negativo no es evento.
Cierre forzado/no limpio: estado fault, no inicia otro SDK ni recomienda reanudar
automaticamente. Parada propia ligada a PID/run_id ignora peticiones antiguas.
Limites: outbox256MiB, originales128MiB por carpeta, reserva64MiB. Sin borrado ni
retencion automatica. Persiste ventana SDK -> primer guardado durable; no garantiza
cero perdidas/historial completo, ni reconcilia o deduplica por tarjeta/fecha/hash.

## Compatibilidad del gestor y limites del ensayo

Codigo real de tools/gestion_tags/mantenimiento.ps1: Procesos-Sync busca ruta
C:\SanIsidro\ZKSync\sincronizar_vigencias.py y --continuo. No reconoce el nombre/ruta
nueva. Por eso es un ensayo manual acotado, no una sustitucion operativa compatible.

Primer paso Dell: --simular, sin SDK/red/Access/tareas ni mantenimiento. Lectura
real posterior requiere provisionar agente de ensayo del serial real; se rechaza
el UUID ficticio TEST-C3-001 anterior. Mantener identidad SQLite al reiniciar.
Lectura con ZKAccess cerrado, Preparar mantenimiento confirmado, sync.lock instalado
tomado y tarea deshabilitada/no Running, active y sin revision pendiente. Verifica
hashes de cuatro fuentes instaladas frente a referencia r2. Padre x64 usa Access;
trabajador x86 recibe entorno sin password Access ni token API.

No usar consultas/altas ni Terminar y reanudar mientras corre. Un arranque anticipado
del polling podria fallar por lock ocupado. Usar parada propia o esperar limite y
Cierre coordinador, despues reanudar desde gestor y exigir dos ciclos nuevos.
Futura transicion requiere entrypoint compatible o paquete conjunto de
gestor/vigilancia, mas rollback y autorizacion. No se genero instalador.

## Evidencia y paquete

43 pruebas aprobadas, Python3.12.5/SQLite local, ultima corrida 10.679s: 26 anteriores
y 17 nuevas. Incluyen prioridad/cierre, parada, peticion antigua, rechazo sin
mantenimiento, cierre inseguro, disco lleno, guardado fallido recuperable, negativos,
formatos desconocidos, recovery/hash alterado, subproceso real ficticio sin secretos
heredados y adaptador siempre False. Laravel HTTP local acepta snapshot observado
y tres originales (evento,255,error binario) producidos por coordinador. Sin C3,
caseta, API produccion ni cambios de backend durante pruebas.

Sintaxis PowerShell verificada sin ejecutar lanzador. Simulacion de 150s virtuales
aprobada con 5 checks true y 3 comparaciones simuladas; 139 originales recuperados
sin duplicar. Pendientes normales: no envia HTTP. Se repitio desde ZIP extraido:
verificador PowerShell correcto y simulation_ok, cinco checks true. No certifica
runtime Dell ni bucle SDK real.

tools/agente_acceso/Coordinador_Ensayo_2026.10.24-1.zip, 19 archivos, SHA256
2e2837992f7c0b0b3374ac346ca862b25100a349f5d419caabc8a97aa9016902.
Manifiesto/rutas verificados, sin datos, credenciales, DLL ni tareas. Destino nuevo
C:\SanIsidro\CoordinadorEnsayo_20261024; primero ensayo_coordinador.py --simular
con Python32, sin pausar polling. Comandos en LEEME_COORDINADOR.md del paquete.

Pendientes: salida simulacion Dell; agente real de ensayo y lectura readonly
acotada; secuenciacion/recovery/parada/watchdog reales; envio de esas capturas;
retencion/reconciliacion; comparacion antes de habilitar aplicacion de fechas;
transicion operativa y rollback autorizados. Cierre del tunel/servidor remoto del
ensayo anterior fue solicitado, sin confirmacion de procesos recibida.

## Simulacion Dell aprobada — 2026-10-24

Usuario comparte verificacion de paquete 2026.10.24-1 y --simular con Python32
instalado. Resultado simulation_ok; cinco checks true (ciclos readonly simulados,
clientes cerrados, originales recuperados sin duplicar, hashes y snapshot de
vigencias sin reescribir). responses=139, messages.pending=33, unbatched=2,
pending_count=35, paused vacio. Pendientes esperados, no envio HTTP.
oldest_pending_utc=2026-10-25T02:04:00.830611+00:00 (24 octubre 20:04:00 Mexico).
Evidencia en Dell:
`C:\SanIsidro\CoordinadorEnsayo_20261024\datos\simulacion_20261024_200400_596825`.
Confirma simulacion, SQLite y runtime Python32 de esta etapa; no certifica bucle
SDK real, Python x64/ODBC, lectura de trafico ni parada en hardware.

Siguiente: provisionar agente en backend aislado para CO2K225060027. Comando
Artisan existente crear genera UUID/token; capturar salida en archivo root-only
datos/alta-controlador-real.txt y mostrar solo agent_id. No rotar ni reutilizar
el agente ficticio TEST-C3-001. No requiere PHP HTTP/tunel ni pausa del polling
para esta preparacion. Lectura real seguira despues de obtener ese UUID y coordinar
mantenimiento; todavia no se ejecuto.

## Agente de ensayo del serial real creado — 2026-10-24

Usuario ejecuta por SSH el comando Artisan crear dentro del backend aislado,
con entorno limpio, guardas de listo.json/ensayo.sqlite, archivo nuevo y umask077.
Salida solo agent_id: c8d7ccdc-991f-497c-8383-92fb52921f8a, para
CO2K225060027, nombre EnsayoCoordinadorC3. Credencial permanece en
/root/sanisidro-ensayos/acceso-20261023-1/datos/alta-controlador-real.txt; no se
compartio token ni se importo aun en Dell. No se cambio el agente ficticio previo.
UUID no secreto para inicializar almacen real de lectura del coordinador.

Siguiente ensayo preparado: lanzar_lectura_coordinador.ps1 -Agente con ese UUID
-Seconds150, desde carpeta separada, durante mantenimiento confirmado. Compara
vigencias sin aplicarlas, observa trafico normal, guarda originales y termina;
no necesita presentar tags ni HTTP/tunel. Tras Cierre coordinador, reanudar por
gestor y exigir dos ciclos posteriores. Lectura real y reanudacion de ESTA etapa
todavia pendientes; simulacion no se toma como evidencia de hardware.

## Primera lectura readonly real completada — 2026-10-24

Usuario ejecuta lanzar_lectura_coordinador.ps1 -Agente
c8d7ccdc-991f-497c-8383-92fb52921f8a -Seconds150 durante mantenimiento.
PAQUETE VERIFICADO, ENSAYO SOLO LECTURA y Recuperados de originales=0.
cycle_probe: mode=readonly, phase=waiting, completed=3, consecutive_errors=0,
total_errors=0, last_error_type=null; last_completed_utc
2026-10-25T02:14:34.198265+00:00 (24 octubre 20:14:34 Mexico).
reader_error=null y storage_error=null. Health: responses=93, messages.pending=30,
unbatched=3, pending_count=33, paused vacio. oldest_pending_utc
2026-10-25T02:12:27.227609+00:00 (20:12:27 Mexico). Pendientes normales: no HTTP.

Confirma en esta ejecucion la comparacion API/Access/C3 sin aplicar, captura RT
real a SQLite y cierres secuenciados sin error observado. Son 93 respuestas, no
93 vehiculos/eventos: pueden incluir estado255 y acumulados. No se imprimieron
filas/codigos ni se certifica aqui frescura/reloj/completitud. Originales y salud
propia en C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento.
Recovery real no ejercitado: recuperados=0; queda la evidencia simulada/local.

Termina con Cierre coordinador normal. Solicitado Terminar y reanudar en gestor;
estado y dos ciclos correctos posteriores a ESTE ensayo pendientes. No reutilizar
los cierres de pruebas de plumas. Credencial del agente real aun no importada a
Dell y ningun lote de estas capturas enviado al backend aislado.

Primera consulta posterior del usuario aun muestra estado detenido del proceso
anterior PID7468: phase=stopped, last_ok_utc=2026-10-25T02:11:24.870961+00:00,
heartbeat_utc=2026-10-25T02:11:55.963084+00:00 y errores0. Ultimo log PARADA
ORDENADA 20:11:55.967 (sin escrituras en curso); ciclos correctos 20:08-20:11
son previos al ensayo. No hay evidencia de nuevo PID/ciclo ni de reanudacion.
No inferir causa ni fallo del coordinador de ese estado previo. Se indica usar
Terminar y reanudar del gestor y obtener mensaje/estado de tarea y dos ciclos
nuevos. No se ordena iniciar tarea por fuera del gestor ni borrar stop/lock.

## Reanudacion posterior al coordinador confirmada — 2026-10-24

Usuario comparte SanIsidro-Vigencias Running, Enabled=True, nuevo PID10868,
run_started_utc=2026-10-25T02:22:20.317482+00:00 (24 octubre 20:22:20 Mexico).
Estado protocol2, phase=idle, errores0, last_error_type=null y last_ok_utc
2026-10-25T02:23:27.812375+00:00. Dos ciclos correctos posteriores al ensayo:
20:22:24.503 y 20:23:27.814, ambos API838, cambios Access0/C3=0,
no encontrados4, ausentes API conservados116. Reanudacion aceptada en esta ventana;
la consulta anterior mostraba la parada, no era evidencia de fallo del ensayo.

Cierra primera prueba readonly real del coordinador y retorno a r2. No se
aplicaron vigencias desde el coordinador ni se instalo servicio continuo. Quedan
pendientes vigilancia observada, parada propia/recovery en hardware y entrega
autenticada de estas capturas. Siguiente: importar credencial del agente real
a DPAPI y enviar su outbox al backend aislado, sin nueva pausa ni consultas SDK.

## Complemento de entrega preparado — 2026-10-24

Usuario pregunta como continuar con esa entrega. Preparado entregar_coordinador.py
en tools/agente_acceso y ZIP independiente Entrega_Coordinador_2026.10.24-1.zip,
4 archivos, SHA256 bdad2b8c196c4f7e36ae84fdb60a6ea0c9824192c088ac2bfb968ea6af01581f.
Manifiesto y verificador PowerShell correctos, fuentes/ZIP coinciden, sin datos
ni credenciales. No reemplaza paquetes/fuentes del coordinador.

Reutiliza outbox/protocolo/emisor/credencial de CoordinadorEnsayo_20261024, exige
sus cuatro hashes conocidos, base existente datos/lectura_mantenimiento/outbox.sqlite,
UUID c8d7ccdc-991f-497c-8383-92fb52921f8a y serial CO2K225060027. Nunca inicializa
otra base ni cambia identidad. Configurar lee por stdin la salida privada de
alta-controlador-real.txt mediante SSH, hasta4096bytes, ID/token unicos y formato
estricto; guarda solo credencial-ingesta.dpapi en carpeta de datos, usuario Dell.
No imprime/guarda secreto en texto claro ni lo usa por argumentos.

Estado muestra conteos, sumas ACK y manifiesto SHA256 de originales, sin tarjetas
ni payload. Enviar agrupa sin lote, conserva UUID/cuerpos existentes y verifica
hash/base64/metadatos de originales SQLite antes/despues. No relee todos los
buffer.bin independientes. Usa Sender/ACK existente, destino fijo loopback18881
por tunel al backend aislado. Tanda hasta100mensajes/60s mas llamada en curso,
progreso cada5ACK; retry/limit conservan pendientes, errores permanentes pausan.
Resumen en entrega_resumen.json y ACK completos en SQLite. Sin SDK, Access,
tareas o nuevas capturas; no requiere mantenimiento ni altera polling.

50 pruebas locales aprobadas, 15.603s: 43 anteriores y 7 nuevas (ID/token/limite,
DPAPI real, biblioteca alterada, falta de red, identidad incorrecta, original
corrupto antes de HTTP y entrega a Laravel real local con segundo envio idle).
Fixtures y agente/serial equivalentes, sin conectar caseta ni produccion. Se
verifico el ZIP por rutas/archivos/hashes; no se modifico backend.

Pendientes: verificar complemento en Dell, importar credencial y comprobar estado
de las93respuestas; despues entregar por SSH y confirmar cero pendientes, sumas
ACK y originales/mensajes existentes sin cambios. Todavia no se envio ningun
lote real de este agente. Pasos completos en LEEME_ENTREGA.md del paquete.

## Credencial real importada y almacen verificado — 2026-10-24

Usuario comparte PAQUETE VERIFICADO Entrega Coordinador 2026.10.24-1 y
CONFIGURADO por tuberia SSH -> DPAPI. Agente esperado
c8d7ccdc-991f-497c-8383-92fb52921f8a, serial CO2K225060027. Sin secreto compartido.
Estado previo a envio: responses93, mensajes pendientes30, unbatched3,
pending_count33, paused vacio, oldest_pending_utc=2026-10-25T02:12:27.227609+00:00.
ACK totales todos0. originales.count93, hashes_verified=true,
manifest_sha256=ee79ca83bef66050d092b171967985bfe8dc703f022fc35f62bd2f1a70b99700;
messages.count30, body_hashes_verified=true. Este manifiesto sirve para comparar
antes/despues del envio. Agrupar las3respuestas sin lote puede cambiar cantidad
de mensajes, no originales ni UUID/cuerpo de los30mensajes existentes.
Entrega real todavia pendiente. Siguiente: servidor/tunel privados y enviar dos
veces; exigir pendientes0, 93respuestas confirmadas por ACK, manifiesto conservado
y segundo envio idle. No requiere nueva pausa ni consultas SDK.

## Entrega real al backend aislado confirmada — 2026-10-24

Usuario comparte fallo al iniciar otra instancia PHP por puerto18880 ocupado;
GET /salud mediante SSH devuelve ensayo_listo/TEST-C3-001, marcador fijo de salud
del ensayo. Se utiliza la instancia existente. No se identifica aqui su PID ni
se atribuye el marcador de salud al agente real.

Dos ejecuciones de entregar_coordinador.py enviar con scope
entrega_capturas_reales_backend_aislado, agente
c8d7ccdc-991f-497c-8383-92fb52921f8a y serial CO2K225060027. Primera entrega:
31 mensajes confirmados (5 estados y 26 lotes), delivery acked31/idle1.
ACK totales: responses_stored93, rows_stored93, events_stored51,
statuses_stored42, responses_pending_interpretation0. Health responses93,
messages.acked31, unbatched0, pending_count0, paused vacio y oldest_pending_utc=null.
Las3respuestas antes sin lote quedaron agrupadas: de30 a31mensajes, sin cambiar
los mensajes existentes. Segunda ejecucion delivery idle1, mismos conteos y ACK;
no realiza nuevos envios. No equivale a reenvio forzado de mensajes ya aceptados.

Ambas salidas: originales.count93, hashes_verified=true y mismo manifiesto previo
ee79ca83bef66050d092b171967985bfe8dc703f022fc35f62bd2f1a70b99700.
messages.count31, body_hashes_verified=true, originals_before93,
originals_preserved=true y existing_messages_unchanged=true. ACK validados y
guardados en Dell; originales conservados en SQLite. Conteos remotos acreditados
por ACK, sin consulta SQL independiente del servidor en esta evidencia. No se
certifica frescura, completitud de historial ni51vehiculos/pasos fisicos.

Cierra entrega autenticada de las capturas reales de este ensayo, sin nueva
consulta SDK, pausa de polling, despliegue ni servicio permanente. Solicitar
Ctrl+C en ventana del tunel y, si se localiza la ventana del servidor temporal,
en esa ventana; no matar procesos desconocidos por puerto. Conservar bases y
evidencias. Cierre de procesos todavia no confirmado. Siguiente etapa propuesta:
ensayos acotados de parada propia y recuperacion en hardware, integracion con
gestor/vigilancia y comparacion con r2 antes de plantear transicion operativa.

## Siguiente ensayo: parada solicitada — preparado 2026-10-24

Usuario indica continuar. Revision de las fuentes reales confirma que el paquete
instalado admite --detener, peticion por PID/run_id y publicacion de phase y
stop_reason al cerrar. Se prepara prueba manual reutilizando ese paquete sin
modificar fuentes ni ZIP: pausar por gestor, lanzar readonly con limite150s,
solicitar parada desde otra PowerShell unos15s despues de los mensajes de inicio,
esperar Cierre coordinador e inspeccionar estado propio. Criterio: phase=stopped,
stop_reason=requested, sin reader_error/storage_error ni errores de comparacion.
Si vence el limite antes de solicitar, stop_reason=limit no acredita esta prueba.
Tras cierre limpio reanudar por gestor y comprobar dos ciclos nuevos. Ante fault
o cierre SDK inseguro, conservar evidencia y revisar antes de reanudar.

Punto de partida: 93originales, 31mensajes ya confirmados y manifiesto conocido.
El arranque ejecuta recover sobre recibos existentes con mismo UUID; su contador
indica recibos procesados, no necesariamente originales nuevos recuperados.
La prueba agregara respuestas de trafico normal y puede dejar pendientes locales;
no envia HTTP. Reapertura/parada antigua ignorada y recuperacion tras fallo se
validaran por separado; no forzar una caida ni modificar originales en esta etapa.
Prueba remota de parada aun no ejecutada, sin nueva evidencia de watchdog.

## Parada solicitada en hardware confirmada — 2026-10-24

Usuario comparte --detener con PARADA SOLICITADA, estado final y consola del
lanzador. PID16112, run_id=e6753322-2db0-4797-a1d5-d52689117844,
started_utc=2026-10-25T03:51:33.429207+00:00 (24octubre21:51:33 Mexico).
phase=stopped, stop_reason=requested, heartbeat_utc=2026-10-25T03:52:57.523448+00:00.
Dos comparaciones readonly completadas, errores consecutivos/totales0,
last_completed_utc=2026-10-25T03:52:41.634142+00:00 y last_error_type=null.
SDK last_ok_utc=2026-10-25T03:52:56.915825+00:00, last_error_code=null;
reader_error=null, storage_error=null. Consola termina Cierre coordinador normal.
Se acredita parada solicitada antes del limite y cierre sin fallo reportado.

Arranque imprime Recuperados de originales93: recibos anteriores reprocesados
con sus UUID, no93recuperaciones nuevas tras fallo. Estado final conserva
messages.acked31, pendientes17, responses141, unbatched3, pending_count20,
paused vacio, oldest_pending_utc=2026-10-25T03:51:37.551889+00:00.
Incremento neto48respuestas respecto a93previas, compatible con nuevas lecturas;
no se aporta aqui comparacion individual de identidades/hashes que certifique
ausencia de duplicados. Pendientes esperados: este ensayo no envia HTTP.

observed_vigencias conserva polling PID10868 en stopped, last_ok_utc
2026-10-25T03:50:23.995854+00:00 y heartbeat03:51:12.461143+00:00, errores0.
Es la parada para mantenimiento, no evidencia de reanudacion ni fallo.
Siguiente inmediato: Terminar y reanudar por gestor y comprobar nuevo proceso y
dos ciclos posteriores a03:52:57UTC. Reanudacion, nueva entrega de pendientes,
reapertura frente a peticion antigua y recuperacion tras fallo aun pendientes.

Primera evidencia de reanudacion posterior: SanIsidro-Vigencias Running,
nuevo PID17684, run_started_utc=2026-10-25T03:54:06.186129+00:00,
phase=idle, consecutive_errors0, last_error_type=null y last_ok_utc
2026-10-25T03:54:10.088535+00:00. Primer ciclo correcto21:54:10.090 Mexico,
API838, cambios Access0/C3=0, no encontrados4 y ausentes API conservados116.
Segundo ciclo posterior aun pendiente; los ciclos21:48-21:50 son anteriores a
la parada21:51:12.462 y no cuentan para aceptar esta reanudacion.

Reanudacion cerrada por evidencia posterior del usuario: segundo ciclo correcto
21:55:13.400, precedido de resumen API838, cambios Access0/C3=0, no encontrados4,
ausentes API sin cambios116. Junto a21:54:10.090 acredita dos ciclos nuevos tras
la parada solicitada del coordinador. Polling r2 reanudado, sin nueva evidencia
de vigilancia ni entrega de los pendientes agregados durante este ensayo.

## Integridad previa a reapertura verificada — 2026-10-24

Usuario consulta entregar_coordinador.py estado sin mantenimiento ni HTTP:
agente/serial esperados, responses141, mensajes acked31/pending17, unbatched3,
pending_count20, paused vacio. ACK conserva5estados/26lotes, 93respuestas,
51eventos/42estados y pendientes de interpretacion0. Originals count141,
hashes_verified=true, manifest_sha256
b9d4f832be39a0541e927055e55d1e588556a6cf3e866c639e793cbb46749b29.
Messages count48, body_hashes_verified=true. Es el punto de comparacion previo;
no equivale a verificar la igualdad individual del subconjunto original93.

Siguiente preparado: mantenimiento por gestor, mismo lanzador -Seconds20 sin
--detener, conservando detener.json anterior. Esperar cierre normal y comprobar
nuevo PID/run_id, stop_reason=limit, comparacion readonly y ausencia de errores.
Inicio recover debe procesar141recibos previos; conteo no significa inserciones
nuevas. Consultar estado de entrega despues para verificar hashes/ACK, sin enviar.
Si phase=fault o cierre inseguro, revisar antes de reanudar. Si cierre normal,
reanudar por gestor y exigir dos ciclos nuevos. No se fuerza caida ni se prueba
recuperacion tras fallo con esta reapertura; aun pendiente de ejecucion remota.

## Reapertura acotada completada — 2026-10-24

Usuario comparte consola -Seconds20, estado propio y entregar_coordinador.py
estado. Paquete verificado, Recuperados de originales141, Cierre coordinador
normal. Nuevo PID14204, run_id=8598f076-0dc0-4a5a-abc6-8b786425dec6,
started_utc=2026-10-25T03:59:26.387517+00:00. Phase stopped, stop_reason limit,
heartbeat_utc=2026-10-25T03:59:46.517429+00:00: completa nueva ejecucion sin
detenerse por la peticion de la anterior. No se aporta lectura independiente de
detener.json; resultado compatible con guarda PID/run_id revisada en fuentes.
Una comparacion readonly correcta, errores consecutivos/totales0,
last_completed_utc=2026-10-25T03:59:30.161701+00:00. SDK last_ok_utc
2026-10-25T03:59:45.703688+00:00, last_error_code null; reader_error/storage_error
null. Recovery reprocesa141recibos existentes; no certifica recuperacion tras caida.

Almacen final: responses149 (incremento neto8), messages acked31/pending21,
unbatched4, pending_count25, paused vacio, oldest_pending_utc
2026-10-25T03:51:37.551889+00:00. Originales149 con hashes_verified=true,
manifest_sha256=edfaeae5adbfc8d3f176f0f885fbbf861ac312c2666b50b4b8433e2b9eb407e1;
mensajes52 con body_hashes_verified=true. ACK conserva5estados/26lotes,
93respuestas/93filas, 51eventos/42estados, pendientes de interpretacion0.
No se compara aqui subconjunto individual de originales entre ejecuciones ni se
acredita entrega de los nuevos pendientes.

Polling observado previo PID17684 en stopped, last_ok_utc
2026-10-25T03:58:24.466497+00:00, heartbeat03:59:07.039723+00:00, errores0.
Es la pausa de esta prueba. Siguiente: Terminar y reanudar desde gestor y obtener
dos ciclos nuevos posteriores a03:59:46UTC. Reanudacion tras esta reapertura aun
pendiente; no reutilizar los ciclos21:54/21:55 de la prueba anterior.

Reanudacion tras reapertura confirmada por salida posterior: tarea
SanIsidro-Vigencias Running, nuevo PID2640, run_started_utc
2026-10-25T04:01:06.214496+00:00. Protocol2, phase idle, consecutive_errors0,
last_error_type null, last_ok_utc=2026-10-25T04:03:17.648988+00:00.
Tres ciclos correctos posteriores al ensayo:22:01:09.932,22:02:13.330 y
22:03:17.650 del24octubre Mexico; todos API838, cambios Access0/C3=0,
no encontrados4, ausentes API sin cambios116. Prueba de reapertura y retorno
a r2 cerrada. Sin nueva evidencia de watchdog. Pendiente entrega de las nuevas
respuestas:149originales totales frente a93confirmadas por ACK; envio manual
al backend aislado sin SDK ni nueva pausa. Servidor/tunel deben verificarse o
abrirse si estan detenidos, sin duplicar procesos ni tocar produccion.

## Acumulados tras parada y reapertura entregados — 2026-10-24

Usuario comparte dos ejecuciones de enviar y consola PHP temporal, iniciado
2026-10-25 04:06:55 (hora mostrada por servidor), atendiendo conexiones loopback
04:08:16-04:08:27 con Accepted/Closing. Primera entrega confirma22mensajes nuevos,
delivery acked22/idle1. Health final messages.acked53, responses149, unbatched0,
pending_count0, paused vacio, oldest_pending_utc null. Las4respuestas sin lote
previas se agrupan en un mensaje adicional:52->53mensajes.

ACK acumulados:9mensajes de estado,44lotes, responses_stored149, rows_stored149,
events_stored106, statuses_stored43, responses_pending_interpretation0.
Son56respuestas adicionales respecto a la entrega anterior93 (55filas de evento
y1de estado segun diferencia de ACK), no56vehiculos/pasos certificados.
Originales149, hashes_verified true, mismo manifiesto anterior a envio
edfaeae5adbfc8d3f176f0f885fbbf861ac312c2666b50b4b8433e2b9eb407e1.
Mensajes53, body_hashes_verified true, originals_before149,
originals_preserved true y existing_messages_unchanged true. Segunda ejecucion
delivery idle1, mismos conteos/ACK/hash; no nuevos envios.

Cierra entrega de pendientes de ambas pruebas, con evidencia de ACK validados
localmente, sin inspeccion SQL remota independiente. Sin SDK, mantenimiento nuevo,
cambio de vigencias ni deploy. Solicitar Ctrl+C en ventanas identificadas del
servidor temporal y tunel, conservar datos; cierre aun no confirmado. Siguientes
pendientes: integracion gestor/vigilancia, recuperacion tras fallo real, retencion
y reconciliacion antes de transicion permanente autorizada.

## Revision de integracion operativa iniciada — 2026-10-24

Usuario indica seguir con gestor/vigilancia. Inspeccionadas fuentes reales de
mantenimiento, monitor, runtime, lanzador/tareas y adaptador readonly. Diseno
propuesto y criterios en control-acceso-operacion.md: conservar tarea/entrypoint,
SDK propio secuenciado, envio sin bloquear vigencias, parada con identidad de
ejecucion y salud separada. Hallazgo adicional: timeout del trabajador del ciclo
r2 requiere tratamiento de cierre inseguro antes de permitir otro cliente SDK;
adaptador readonly actual no transforma ese caso en UnsafeClosure. No se ha
reproducido ese fallo en caseta ni cambiado implementacion. Solicitar inventario
readonly de tareas, configuracion/estado vigilancia y hashes antes de preparar
compatibilidad. Sin mantenimiento, SDK, tareas nuevas ni cambio de instalacion.

Inventario posterior coincide en tres hashes (monitor/lanzador/mantenimiento) y
vigilancia reporta correcto a2026-10-25T04:18:26.433699+00:00. Preparada primera
capa candidata en paquete Integracion_Operativa_2026.10.24-2.zip: contratos de
control/salud/turnos y un inspector readonly independiente. Solo sintaxis y
manifiesto verificados, sin nuevos ensayos de comportamiento ni enlace al
coordinador/SDK/gestor instalado. Detalle y limites en control-acceso-operacion.md.

Tras simulacion r3 aprobada en Dell, siguiente candidato Cierres_Coordinador_
2026.10.24-1.zip enlaza gate y recibos con trabajadores readonly de inventario/RT.
21pruebas nuevas y101totales aprobadas localmente; simulacion de ZIP extraido
correcta. No ejecutado aun en Dell ni conectado a C3 real. Mantiene almacen/
originales anteriores y usa estado_cierres/stop propios, sin tocar r2 instalado.
Detalle, SHA y limites en control-acceso-operacion.md y LEEME_CIERRES.md.

## Aceptacion real de adaptadores de cierre — 2026-10-25

Usuario aporta ensayo150s con paquete Cierres Coordinador2026.10.24-1:
PID5396/run_id7e60c27f-54a6-4333-a815-0631e6beb164, tres ciclos readonly sin
errores, seis cierres confirmados, gate sin fallo y sin cliente activo, parada
normal por limite. Almacen previo revisado149 respuestas, total local228 (+79),
53 mensajes ya acked,30 pendientes y1 respuesta sin lote: pending_count31.
No hubo envio HTTP;149 respuestas son la entrega previa al backend aislado,
no las228. Nuevos manifiestos y ACK de esta captura aun pendientes.

Polling reanudado PID9544 desde2026-10-25T06:31:52.156041+00:00: tarea Running,
phase idle, errores0, tres ciclos correctos00:31:55,00:32:59 y00:34:02 Mexico,
API838, cambios Access0/C3=0, no encontrados4, ausentes API116 sin cambios.
Ventana de mantenimiento cerrada; vigilancia no consultada en esta muestra.
Detalle de timestamps y evidencia en control-acceso-operacion.md. Cierres
validados por el padre no certifican estado interno de firmware o clientes
externos. Siguiente entrega al ensayo aislado puede hacerse sin mantenimiento;
enlace gestor/vigilancia e instalacion permanente siguen pendientes.

Entrega posterior confirmada el2026-10-25:31mensajes nuevos y84ACK acumulados
(14estados/70lotes),228respuestas/228filas segun ACK:157eventos y71estados,
interpretacion pendiente0. Cola pendiente/sin lote0; segundo envio idle1.
Originales228 y mensajes existentes conservados, hashes correctos; manifiesto
483c43bc939fdece659d2fd9e6d67974e19d5784f4fabbfc45f570744da4ee32.
Queda cerrada la entrega de las79respuestas adicionales del ensayo de cierres.
Sin SDK, nueva pausa o deploy; detalle/limites en control-acceso-ensayo-remoto.md.
No se aporto nueva salud del polling o vigilancia ni cierre de tunel/servidor.

## Parada de ensayo desde panel candidato validada — 2026-10-25

Tras pausa de r2 a12:19, usuario solicita parada del ensayo PID10540/run_id
1c5afafc-4f85-4ea9-ab8f-352d655ccabd desde boton. Resultado requested/stopped,
una comparacion readonly correcta a18:27:36.569976Z, sin errores/gate fault.
Verificacion del panel cierre_confirmado a18:28:16.930202Z, dos cierres de esta
ejecucion/ocho acumulados, lock libre observado. Respuestas locales228 sin
nuevas capturas RT,84mensajes acked y1pendiente desde18:27:36.609119Z,
coherente con snapshot de estado; entrega de ese mensaje aun no verificada.

Polling nuevo PID15600 desde18:28:46.103056Z, dos ciclos correctos12:28:49.887
y12:29:53.479 Mexico, API838/cambios Access0/C3=0/no encontrados4/ausentes116.
Estado phase cycle a18:30:53Z representa siguiente ciclo en curso con errores0.
Aceptado retorno de esta ventana; detalle de limites/incidente previo Ctrl+C
en control-acceso-operacion.md. Servicio permanente/emisor/vigilancia nuevos
siguen pendientes, no hay nuevas tareas o despliegue de produccion.
