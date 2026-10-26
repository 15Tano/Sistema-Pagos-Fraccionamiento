# Servicio integrado candidato de acceso

2026-10-26. El usuario autoriza preparar y probar la union operativa local.
Estimacion inicial comunicada60–90min; prueba Dell e instalacion separadas.
Este documento registra implementacion y pruebas locales, no despliegue ni
aceptacion de nuevas escrituras reales.

## Implementacion

Fuentes nuevas en tools/agente_acceso; las publicaciones previas permanecen
intactas. servicio_integrado.Service controla ciclos de vigencias prioritarios,
RT entre ciclos y un emisor HTTP en proceso propio. SDKGate y recibos anteriores
siguen siendo obligatorios. RT debe cerrar antes de abrir inventario/aplicacion;
cierre incierto termina nuevos turnos y conserva evidencia. Parada cooperativa
termina la operacion actual y recoge RT/emisor antes de publicar stopped.

El nucleo admite ejecucion continua y protocol2, con last_ok exclusivamente
tras ciclo de aplicacion verificado. Una comparacion readonly no publica estado
oficial nuevo; encola el snapshot r2 observado sin reescribirlo. HTTP, eventos y
ACK nunca conceden vigencias. Errores de captura/disco pausan RT; si el SDK cerro
con certeza pueden continuar los ciclos de vigencias. Fallo parcial de fechas
conserva requires_review y detiene el servicio; no hay reintento/rollback ciego.

ciclo_operativo.Cycle valida la misma fuente API/r2, lee las cinco columnas
Access, valida inventario C3 cerrado y prepara planes solo de existentes.
Duplicado Access, inventario vacio/incierto o API invalida bloquean aplicacion.
Ausentes API permanecen intactos; fechas vencidas se aplican como vencidas.
El modo de ciclo debe coincidir con el del planificador antes de crear procesos.

La ruta de aplicacion de biblioteca reutiliza aplicador_integrado.execute,
AccessDates, el transporte concreto y Approval por plan exacto. Los alcances se
exigen al llamador y no se emiten automaticamente para datos reales. No hay CLI
--aplicar/--continuo en la entrada Dell de este paquete.

respaldo_ciclo prepara UNA copia MDB por ciclo con cambios, valida los estados
Access de todos los planes contra esa copia y guarda un indice inmutable fuera
del directorio MDB. Se preserva el contrato de admision anterior de copias.
Cada tag tiene su propio perfil DPAPI y bundle ligado al indice/recibo/hash MDB.
Todos los respaldos/perfiles preceden la emision de Approval; no se renueva TTL.
CycleBundle se reconstruye en el hijo antes de permitir la escritura protegida.
Solo cuatro campos C3 y tres columnas de fechas/validez Access, conservando
campos privados, permisos y otras tablas. No copiar una MDB completa por tag.

emisor_servicio.ProcessSender usa Popen propio, entorno sin SANISIDRO_ y EOF de
stdin para parar al perder el padre. Solo carga su token DPAPI de ingesta.
Reutiliza Sender.once/leases/ACK/backoff/cuerpos; no importa SDK ni Access.
Salida del proceso sin recibo correcto no acredita cierre. En Windows se
reintenta exclusivamente reemplazar/leer snapshots ante sharing temporal,
nunca HTTP ni SDK. Interrupcion persistente conserva el estado anterior.

## Entrada Dell y limites

servicio_integrado_dell solo permite preflight, ensayo readonly5..150s,
parada PID+UUID y verificacion final. Carpeta separada:
C:\SanIsidro\ServicioIntegrado_20261026. Usa el gestor/lock instalados, r2 con
hashes conocidos, la misma outbox/identidad anterior y el backend aislado por
127.0.0.1:18881. Consulta API productiva para comparar; no cambia fechas reales,
DLL, tareas, reloj, credenciales instaladas, endpoints o UI.

lanzar_servicio_integrado.ps1 descifra DPAPI del usuario Dell, limpia entorno,
lanza padre64 y verifica cierre en otro proceso tras salir. El resultado vincula
PID/UUID, recibos SDK, emisor y hash; guarda cierre_final.json. Solo despues de
cierre_servicio_confirmado se reanuda por gestor y comprueban dos ciclos r2.
Si falta cierre o queda fault, conserva mantenimiento/evidencia. Nada se instala
por verificar/simular ni se reanuda automaticamente desde este candidato.

Siguen pendientes aceptacion de aplicacion real, autorizacion operativa continua,
entrada canonica instalada, instalador/rollback, enlace gestor/vigilancia y
parada real frente a360s; transporte definitivo sin SSH y retencion/alertas.
No borrar originales ni ampliar topes existentes:32copias/2GiB,
1024perfiles/256MiB y limites SQLite/originales previos. El nucleo continuo no
equivale a un servicio permanente aceptado. Pantalla/altas siguen posteriores.

## Verificacion local completada

48 pruebas nuevas: planificador con reloj virtual, SQLite real temporal,
prioridad/cierre, fallos API/HTTP/disco, revision parcial, originales recuperables,
identidad de parada, snapshots Windows, hijos Python reales, perfil/grant DPAPI,
aplicacion cerrada con SDK ficticio y un ciclo con ACE/MDB/DPAPI nativos de prueba.
Incluye el cableado real de la entrada readonly, con SDK/API sustituidos, RT
original durable, emisor hijo real y verificacion final. No caseta ni produccion.

Suite492 aprobadas en125.346s, cero fallas/errores/omitidas. La primera ejecucion
en sandbox bloqueo siete comprobaciones previas de loopback Laravel con
WinError10013; repeticion autorizada fuera del sandbox aprobo toda la suite.
No se modificaron esas pruebas ni se omitieron. Sintaxis Python/PowerShell
comprobada. Pruebas nuevas standalone tambien aprobadas.

Servicio_Integrado_2026.10.26-2.zip:117archivos/302035bytes/SHA256
2e8a4aed431ec6f96223c1ff4c1f6845bc0765bf66334d81b09d8d0d0e289507.
Manifiesto116fuentes mas manifiesto; los95archivos del transporte anterior
conservados byte por byte. El primer borrador local no tenia tres dependencias
en raiz; detectado al extraer, corregido en version2 antes de entregar a Dell.
No sobrescribir publicacion. Paquete2 extraido en datos/s2 y verificado en
PowerShell; simulacion completa simulation_ok,48tests/failures0/errors0/skipped0,
parent64/child64, ended_utc=2026-10-26T06:11:27.806680Z. Evidencia local:
tools/agente_acceso/datos/s2/registros/servicio_simulado_20261026_001127_806680.json.

Siguiente: usuario descarga SOLO paquete2 y ejecuta verificar_servicio.ps1 y
simular_servicio.py con Python64 y --python32 instalado. No mantenimiento para
esa simulacion. Arquitectura nueva padre64/hijo32 y ensayo readonly conjunto
todavia pendientes de evidencia Dell. Ninguna nueva consulta real solicitada
ni efectuada por las pruebas locales.

Ultima evidencia real sigue siendo perfil/cierre aceptados y r2 PID14608 con
dos ciclos correctos23:27/23:28 Mexico25oct, documentados en aplicador candidato.
No afirmar salud actual, instalacion o escritura nueva por estos resultados.

## Simulacion del servicio aprobada en Dell — 2026-10-26

Usuario verifica Servicio_Integrado_2026.10.26-2 y ejecuta simular_servicio.py
con Python64 y --python32 C:\Users\Dell\Python32\python.exe. Resultado
simulation_ok, parent_bits64/child_bits32, tests48/failures0/errors0/skipped0,
ended_utc2026-10-26T06:17:59.152782Z (00:17:59 Mexico26oct). Evidencia:
C:\SanIsidro\ServicioIntegrado_20261026\registros\servicio_simulado_20261026_001759_152739.json.

Queda aceptada la simulacion de esta union en arquitecturas Dell, incluidos
procesos/SQLite/ACE/DPAPI sobre datos ficticios. No acredita lectura SDK real,
entrega HTTP nueva, tarea instalada o salud actual del polling.

Siguiente ensayo: verificar salud del tunel18881 antes de pausar; con backend
aislado/tunel activos y otros lectores/emisores candidatos cerrados, preparar
mantenimiento por gestor y ejecutar lanzar_servicio_integrado.ps1 -Seconds150.
El lanzador valida tarea/estado/exclusion y comprueba cierre propio al terminar.
Solo tras cierre_servicio_confirmado, Terminar y reanudar por gestor y comprobar
dos ciclos correctos nuevos. Si no hay cierre confirmado, conservar mantenimiento
y evidencia. No tag fisico, escrituras de fechas, sustitucion DLL ni despliegue.
Ensayo real, cierre y retorno de esta etapa todavia pendientes.

## Ensayo readonly integrado real y cierre aprobados — 2026-10-26

Usuario restablece servidor/tunel y aporta salud18881 ensayo_listo/TEST-C3-001
(marcador del backend aislado). Ejecuta lanzar_servicio_integrado.ps1 -Seconds150:
trial_passed=true, mode=readonly, phase=stopped, stop_reason=limit,
dates_applied=false. PadrePID8332/run_id04944797-e3d4-42f3-8376-b0a4adf96dd5.
Dos ciclos completados/errores0, ultima comparacion API838/Accesschanges0/
C3changes0/not_found4/absent_api_unchanged116, verified0/statuscompared.
No son dos ciclos de aplicacion candidata. PlanSHA:
532666deaecc52b9fb0b6f91de501f4095758426f32cb9765b62d73d35f43381.

Lector/almacen/emisor sin errores, sdk_gate active=null/fault=false,
closures_confirmed=true. Ultima lectura SDK06:25:39.504455Z; lector paused
corresponde al cierre. Cuatro recibos de trabajadores:53a2ade2-ca8b-458a-b782-
54ebecaafd95/PID17564,6a824f9d-5e38-4869-a4b2-1ce64610b7b4/PID7056,
e438ed21-12f0-413d-8e3b-f5892dfa842c/PID15780,
f7a36e68-c2d1-4bfa-b6da-a8e64cb2316b/PID16388. No asignar funciones a los
PIDs por orden del listado UUID; consultar request.json si hace falta.

EmisorPID9296/run_id90f8b8f5-c533-4fa1-ab0a-0cd739f077dc,
21mensajes ACK durante el ensayo/216idle, ultimoACK06:25:36.583116Z.
Cola acumulada:359respuestas originales,183mensajes acked, unbatched3,
pending_count3, paused vacio, oldest_pending06:25:36.353914Z. Las tres ultimas
respuestas estan guardadas localmente sin agrupar, no perdidas ni confirmadas
en backend. No afirmar cola vacia ni nuevos totales eventos/estados del servidor.
El snapshot del emisor con process_exited=false es anterior al cierre; la
verificacion final posterior confirma salida/recibo del hijo conforme al codigo.

Evidencia:
C:\SanIsidro\ServicioIntegrado_20261026\datos\sesiones\04944797-e3d4-42f3-8376-b0a4adf96dd5.
Verificador automatico: cierre_servicio_confirmado para mismoPID/run,
trial_passed=true/dates_applied=false, checked_utc2026-10-26T06:25:47.234273Z
(00:25:47 Mexico26oct). result_sha256:
aeb713ccb9b13afb040cae10f776466060e0ebf6607a06541ce7073dfbbbd78a.

Aceptados ensayo readonly real, lecturas/envio combinados y cierre propio.
Ahora Terminar y reanudar por gestor y comprobar tarea/estado y dos ciclos r2
nuevos. No se ha aportado ese retorno aun. Tras comprobarlo, entregar las tres
respuestas restantes con emisor manual existente, sin SDK ni mantenimiento,
y comprobar segundo envio idle/originales conservados. Mantener tunel abierto.
Instalacion permanente, aplicacion candidata real y demas pendientes continúan.

## Retorno de r2 comprobado tras servicio integrado — 2026-10-26

Usuario aporta SanIsidro-Vigencias Running/Enabled=true, protocol2/PID13936,
run_started2026-10-26T06:28:05.254541Z, phaseidle, consecutive_errors0,
last_error_typenull y last_ok06:30:16.802893Z. Tres ciclos nuevos correctos:
00:28:09.337,00:29:12.971 y00:30:16.804 Mexico26oct; API838/Accesschanges0/
C3changes0/not_found4/absent_api_unchanged116. Parada previa00:22:58.142.

Quedan aceptados ensayo integrado readonly, cierre final propio y retorno r2.
No repetir pausa/SDK por esta etapa. No nueva evidencia de vigilancia aportada.
Pendiente entregar las tres respuestas locales y confirmar cola vacia/originales
conservados/segundo envio idle. Usar entregar_coordinador.py del paquete actual,
mismo almacen/credencial/servidor de ensayo, sin SDK ni mantenimiento. No se
acredita aun instalacion permanente ni aplicacion candidata real de fechas.

## Entrega final confirmada; ensayo integrado concluido — 2026-10-26

Usuario ejecuta dos veces entregar_coordinador.py enviar del paquete2 con
Python64, mismo agente c8d7ccdc-991f-497c-8383-92fb52921f8a/serialCO2K225060027.
Primera entrega:acked1/idle1. Segunda:idle1 sin nuevos envios. Ambas muestran
184mensajes acked,359respuestas originales, unbatched0/pending_count0,
oldest_pending=null y paused vacio. Totales ACK24estados+160lotes,
responses_stored359/rows_stored359/events_stored257/statuses_stored102,
responses_pending_interpretation0. Son totales acumulados del ensayo aislado,
no359eventos nuevos ni257pasos fisicos certificados.

Originales359/hashes_verified=true, cuerpos184/body_hashes_verified=true,
originals_preserved=true y existing_messages_unchanged=true en ambas salidas.
Manifiesto de originales:
2a9a81b2825b2bce8aa82ab2e0cb53511c5759a89643e8422f41a86281aa1b49.
Las tres respuestas sin agrupar anteriores quedaron entregadas en un lote.
No consulta SQL remota independiente ni nueva escritura SDK por esta entrega.

Concluidos simulacion Dell64/32, ensayo integrado readonly, cierre propio,
retorno r2 con tres ciclos correctos y entrega final sin duplicar/cambiar
mensajes existentes ni perder originales. No repetir esta pausa/lectura.
Ultima salud r2 es la consulta anterior PID13936/last_ok06:30:16.802893Z;
esta entrega no renueva esa certificacion. Servidor/tunel siguen siendo de
ensayo; cierre posterior de sus ventanas no aportado. Siguen pendientes
aplicacion candidata real, autorizacion/guard operativo, instalador/rollback,
gestor/vigilancia, transporte definitivo y retencion, antes de operacion continua.

## Preparacion consolidada local durante ausencia del usuario — 2026-10-26

Preparados propietario nativo SDK, runner continuo con aceptacion obligatoria,
almacenes nuevos comprimidos/archivos ACK, recibos archivables sin perdida,
instalacion/reversion de biblioteca con r2 inicial, parche minimo del gestor y
vigilancia adicional. Ninguna instalacion/activacion remota. Suite564aprobadas;
paquete extraido con72pruebas y2400buffers ficticios conservados. Siguiente
salida Dell: simulacion64/32 y preflight, sin mantenimiento. Detalle y limites en
control-acceso-preparacion-operativa.md. No repetir el ensayo integrado aceptado.
