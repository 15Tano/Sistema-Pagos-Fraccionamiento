# Ingesta resumida y conservación automática

## Decisiones confirmadas — 2026-10-31 México

Después de activar la primera retención, el usuario pide corregir el crecimiento
desde el origen y minimizar mantenimiento: sin intervenciones mensuales. Confirma
explícitamente admisión automática de lecturas atrasadas hasta **7 días**; originales
vehiculares fuera de ventana se conservan para revisión, no se descartan.

El release anterior conserva todos los ACK indefinidamente. Esta corrección sí
incluye caducidad de comprobantes y reducción en Dell y Laravel. Es una versión
nueva **preparada localmente**, no una certificación de despliegue o instalación.
La primera política 7/90 sigue activa en producción hasta aplicar esta actualización.

## Comportamiento preparado

- Dell reconoce exclusivamente RT completo, UTF-8, siete campos, fecha válida y
  código255 en todas las filas. Un único snapshot comprimido y contadores durables
  en SQLite reemplazan miles de originales. Mixtos, errores, binarios, vacíos y
  formatos desconocidos siguen conservándose completos. No cambia cadencia RT,
  r2, fechas, SDK, Access ni tareas de Windows.
- Salud normal cada30segundos e inmediata ante cambio de lector/fallo. Se reemplaza
  salud pendiente no arrendada, conservando secuencias. Lotes de vehículos y leases
  activos nunca se modifican. Una salud vencida410 se retira sin inventar ACK ni
  bloquear lecturas válidas; los lotes vehiculares vencidos permanecen protegidos.
- Los contadores de255 viajan con la salud y tienen epoch persistente. Laravel
  suma solo el incremento. Repeticiones y reportes atrasados no duplican conteos;
  reportes antiguos sin métricas no borran el watermark. Horas agrupadas por
  **recepción**, no hora física C3: después de desconexión se registra el incremento
  acumulado al recibirlo, sin inventar un historial horario de observaciones.
- En Laravel, `control_acceso_salud_actual` mantiene un payload vigente por agente.
  La tabla histórica conserva cuerpos solo para cambios de señal: versión/PID,
  fase/errores de vigencias, error SDK, estado lector y estado/motivo watchdog.
  Fechas, contadores crecientes y cambios ordinarios de cola no crean cuerpos
  repetidos. El snapshot sí actualiza sus fechas y contadores reales cada reporte.
- Con la política habilitada,255 ya no se inserta en control_acceso_filas. Los
  clientes anteriores siguen admitidos: se resumen en ingesta. ACK declara
  `storage_policy=summary-v1`, filas de eventos realmente guardadas y número de
  estados resumidos. La cantidad de respuestas corresponde a sus identidades
  reservadas; no promete conservación de bytes de255 ni perpetuidad de cuerpos.
- Detalle técnico24horas; resúmenes horarios7días; comprobantes mínimos7días desde
  recepción. Respuestas con eventos y sus lotes permanecen mientras existan
  eventos (90días); se conservan además las últimas lecturas de cada pluma y el
  último reporte de salud, como en la primera política. No renumera IDs.
- Tras eliminar comprobantes, un mensaje viejo no puede reinsertarse: admisión
  exige timestamps de captura/reporte dentro de7días (tolerancia futura300s) y
  autenticación del agente. Respuesta410 bloquea lotes y conserva originales.
  Un ACK aún almacenado se reproduce idéntico; otra identidad/contenido409.
  Esto depende del contrato que prohíbe regenerar UUID/fecha de mensajes antiguos;
  no permite republicar mensajes vencidos con fechas alteradas.
- Limpieza del servidor con el scheduler existente, transacciones pequeñas,
  lock del agente compartido con ingesta, máximo10000por fase/agente. Retira
  estados, respuestas huérfanas, lotes vacíos y resúmenes vencidos. No toca datos
  de negocio. Cada aplicación deja contadores sin datos personales en log diario,
  con rotación Monolog existente (predeterminado14días).
- Dell retira automáticamente archivos y originales **confirmados** mayores de
  7días, veinte por tanda cada30segundos. Valida bytes/ACK, omite copias calientes,
  registra intención en SQLite, retira catálogo y termina borrado físico por hash.
  Un corte recupera la intención sin reenviar ni perder pendientes. La incorporación
  del catálogo anterior también es gradual. Páginas SQLite/InnoDB se reutilizan;
  no se ejecuta VACUUM/OPTIMIZE mientras opera ni se promete reducción inmediata
  de archivos físicos.

El tamaño queda ligado al tráfico de las ventanas, no a todos los meses de uso.
No se promete una cifra fija de MB ni ausencia de averías. Lecturas sin confirmar,
archivos corruptos, reloj incorrecto o una desconexión superior a7días conservan
evidencia y pueden requerir revisión excepcional, sin mantenimiento mensual normal.

## Entrega y despliegue

Nueva migración `2026_11_01_000000_create_control_acceso_summaries`: snapshot,
resúmenes e índices de vencimiento. Reversión vacía comprobable; si hay snapshots
o resúmenes, conservar tablas al revertir código. No reconstruye datos caducados.
La bandera `CONTROL_ACCESO_INGESTION_SUMMARY_ENABLED` es false por defecto;
retención técnica local preparada1día y admisión7días, eventos90. Habilitar solo
tras ensayo MariaDB separado y revisar plan de limpieza.

GET autenticado `/api/control-acceso/agente/capacidades` anuncia política, ventanas
y bandera de retención. Si se habilita sin tablas/marcadores,503. No revela tokens
ni datos personales. Instalador Dell verifica HTTPS/DPAPI y exige política nueva
activa y retención habilitada antes de modificar enlaces. No hay chequeo de red
nuevo en cada arranque que impida operar el servicio por una caída de Internet.

Paquete candidato `Lecturas_Ingesta_Resumida_2026.10.31-4.zip`, exclusivamente sobre
Almacén-3 cuyo ZIP tiene SHA25622647c03...b3a889 y manifiesto3d16ee4f...f903e4.
Generador determinista, delta exacto, plan/hash, mantenimiento y sync.lock,
respaldo de enlaces, marcas de recuperación y rollback de código. Un rollback
no recupera archivos confirmados ya caducados. No cambia r2 ni preferencias de
la caseta. Ensayar copia antes de solicitar instalación real.

Flujo restante: publicar fuentes revisadas; ejecutar `tools/retencion/preparar_resumenes.sh`
con commit exacto en la copia privada MariaDB ya creada; revisar resultado; desplegar
backend mediante script habitual y activar bandera; finalmente instalar paquete
Dell en mantenimiento y aceptar dos ciclos correctos, ACK y lectura web. Autorización
general de la corrección confirmada; no afirmar aplicación de estos pasos sin salida.

## Evidencia de preparación local

Pruebas de origen con SQLite real:1000estados255 producen un snapshot y cero
originales/cola individuales; servicio integrado conserva eventos y reduce salud;
backlog se sustituye sin tocar leases; recuperación de retiro tras corte; catálogos,
ACK y originales pendientes protegidos. Verificación de paquete e instalador/
rollback en copias. Pruebas PHP de resúmenes, métricas, duplicados, reloj/admisión,
caducidad y monitor con SQLite y MySQL8.4 aislado. No equivale a prueba MariaDB
de esta versión ni instalación en Dell. Resultados finales se anotan al cerrar.

Resultados al cerrar preparación: SQLite **118 pruebas/1211 aserciones** y MySQL
aislado **48/641**, aprobadas. MySQL detenido con helper validado. Python:92casos
de regresión de agente/servicio/latencia/origen,6SDK,25almacenamiento/origen y un
caso nuevo de proceso real/IPC resumido aprobados; grupos con casos heredados o
repetidos, no sumarlos como casos únicos. Las pruebas con servidores ficticios
en localhost se repitieron fuera de sandbox tras bloqueo de sockets Windows10013;
el resultado final fue aprobado. Instalador/reversión del ZIP final:10casos
aprobados sobre copias, sin SDK real ni cambios de tareas. Sintaxis Bash y lint
PHP de los ejecutores verificados; guardas rechazan ejecución fuera del ensayo.

ZIP final:196entradas,507553bytes,
SHA256`580373c3d573a2d88be121ae61f169a30caf797d8e0bd558f7587d7d3ffc0409`;
manifiesto`ef62ef34b371e7e4f452dbbd3dac11407d379413c28d1d24e11bb21675b304ce`.
Las pruebas generadas de actualización se ejecutaron sobre este ZIP, no un
directorio con fuentes mezcladas. El generador ordena campos y archivos para
construcción determinista. No se aplicó ni reinició nada en Dell o producción.

## Ensayo remoto de origen aprobado — 2026-10-31 México

Usuario ejecuta preparador del commit1f737dd en la copia privada sicar5502802b,
MariaDB10.11.14. Migración2026_11_01_000000 DONE. Salida confirma1000observaciones255:
0filas,0copias raw individuales,1resumen horario; salud repetida compacta,
métricas sin doble conteo y último estado conservado.
Con reloj PHP+8días (sin modificar reloj del servidor) devuelve estados compactados1,
status/eventos eliminados0, respuestas compactadas0, comprobantes de estado
eliminados10001, respuestas11001, lotes1498 y resumen1. Son conteos de una tanda
acotada por fase/agente, incluyen datos previos del ensayo y no certifican vaciado
total de la copia. Reenvío caducado410 sin reinserción. Salida final
ENSAYO ORIGEN MARIADB APROBADO. Hora del ensayo real05:33:49UTC1nov=23:33:49México31oct.
Producción no modificada por el ensayo; despliegue/activación de summary-v1 e
instalación Dell pendientes. La autorización de esta corrección sigue vigente.

## Estructura productiva de resúmenes confirmada — 2026-10-31 México

Salida del usuario desde docroot real: backend_structure_ready=true, GET capacidades
y resto de rutas correctos, columnas de snapshot/resúmenes presentes, todos los
índices (incluidos ca_expiry_estados/lotes y ca_status_hour) correctos y ninguna
migración faltante. Monitor habilitado, historial vigilanciafalse/revisión1.
Esto confirma estructura y archivos nuevos, sin log completo del deploy ni
confirmación del nombre del respaldo actualizado propuesto antes de desplegar.
Plan05:36:31UTC1nov (=23:36:31México31oct): técnico1día, eventos90días;
10000estados a compactar,10000status a eliminar,10000respuestas a compactar,
0eventos a eliminar. Cifras limitadas por tanda, no totales globales. Solo aparecen
las cuatro fases iniciales: falta confirmar habilitación de summary-v1, primera
aplicación y capacidades efectivas. Dell todavía con release3.

## Política resumida activa en backend — 2026-10-31 México

Usuario confirma respaldo actualizado verificado mediante gzip -t:
`/root/backups-sanisidro/antes-resumenes-20261101-053548.sql.gz`. No se repitió su
restauración (el respaldo anterior sí fue restaurado en ensayo). Configuración
previa .env respaldada; actualización atómica y config:clear correctos.
config:show confirma ingestion_summary_enabled=true y retention_enabled=true,
admisión/reintentos7días para estados/eventos, técnico1día, resúmenes7días,
eventos90días y monitor=true.
Aplicación productiva05:38:38UTC1nov (=23:38:38México31oct):10000estados compactados,
10000status eliminados,10000respuestas compactadas y0eventos eliminados.
Los cuatro contadores de eliminación de comprobantes/resúmenes son0 (aún sin
antigüedad7días). schedule:list confirma tarea horaria, siguiente en21minutos.
La primera aplicación manual y habilitación están confirmadas; ejecución automática
de esta versión todavía no observada. No repetir tandas manuales como requisito
mensual. Instalar Dell release4 y aceptar continuidad/lecturas sigue pendiente.

## Verificación Dell y corrección de encabezado4a — 2026-10-31 México

Usuario confirma SHA del ZIP4 y source_update_package_verified/manifiestoef62ef34...
sdk_opened=false. Preflight HTTPS GET capacidades recibe415 después de autenticar.
No se pidió pausa ni se aplicó el paquete: Dell conserva release3.
Causa verificada en AuthenticateControlAccessAgent: isJson se exige también en GET.
backend_ready enviaba Accept pero omitía Content-Type. Pruebas previas con getJson
añadían esa cabecera y no detectaron el problema. Nueva aserción sobre la petición
Python reproduce fallo antes del parche; pasa al añadir Content-Type application/json.
Prueba Laravel GET sin getJson confirma415 sin cabecera y200 con ella (1prueba/2aserciones).
6pruebas Python de origen/preflight aprobadas. No se cambia middleware ni se requiere
otro despliegue backend; solo paquete nuevo Dell4a, preservando el ZIP4 como evidencia.

ZIP4a preparado:196entradas/507712bytes,
SHA256`201d3c3b448edbd812fdcaa71ef4d824f54e089e51957971a418aea5a9805e92`;
manifiesto`ddbb02c44725e87f1185cb252137b1da62cd916fbe2c144a0bc00e8bae500363`.
Generador usa versión4a tanto en paquete como runner; base sigue siendo Almacén-3.
Verificación real de capacidades y plan/instalación4a aún pendientes de salida Dell.
Verificación del ZIP4a y sus10pruebas de instalación/reversión sobre copias
aprobadas. No hubo cambios de código productivo Laravel ni pausa/instalación Dell.

## Compatibilidad4a real confirmada en Dell — 2026-10-31 México

Usuario descarga y verifica ZIP4a en
`C:\SanIsidro\LecturasIngestaResumida_20261031_4a\paquete` con Python64 canónico.
Salida source_update_package_verified/release2026.10.31-4a/manifiestoddbb02c4...
sdk_opened=false. GET real autenticado devuelve retention_enabled=true,
storage_policy=summary-v1, retry_window_days7, technical_days1, event_days90.
HTTP415 resuelto con el encabezado explícito. Descarga y preflight correctos;
pausa, cierre completo, plan, aplicación y reanudación de4a aún pendientes.

## Aviso del emisor durante preparación — 2026-10-31 México

Usuario reporta de nuevo popup «emisor de eventos requiere revisión» mientras
esperaba instrucciones. No se recibió salida de pausa/plan ni evidencia de
aplicación4a; se indica posponer controles y leer estado actual. Código verificado:
vigilancia_operativa.assess dispara ese texto por sender_error; Service.watch_sender
asigna error al fallar snapshot, pero no lo limpia al recuperar snapshots válidos.
Contexto anterior documentó FileNotFoundError persistente con ACK posteriores;
esto es una hipótesis para el aviso actual, no prueba de salud ni causa confirmada.
Necesario contrastar heartbeat, error, proceso del emisor, ACK/cola y último HTTP
actuales antes de instalar o cambiar el criterio de alerta. No borrar marcas ni
editar estado para silenciarlo. Preparación/instalación quedan pendientes de diagnóstico.

## Emisor saludable y aviso histórico confirmado — 2026-10-31 México

Dos muestras del usuario01nov05:51:32/42UTC (=31oct23:51México): tareaRunning/
Enabledtrue; padrePID16460/run_id7f90b4c8..., último ciclo05:50:48UTC/0errores,
heartbeat/SDK recientes, reader_error/storage_error nulos. EmisorPID14968/run_id
a03ae9ab..., process_exitedfalse, faseidle, heartbeatactual y ACK pasan5663→5670
en10segundos (último05:51:41UTC); retry25sin incremento. Cola no bloqueada,
pendientes8→6 recientes de pocos segundos. Se confirma que no hay parada de envío
en estas muestras y que sender_errorFileNotFoundError se conserva indebidamente.

Se prepara4b antes de instalar: Service.watch_sender recupera ese error transitorio
solo tras snapshot validado por PID/run_id, proceso vivo, faseidle/rate_limited y
heartbeat/ACK de hasta30segundos no futuros. No cambia vigilancia ni edita JSON
manualmente; registra recuperación en sync.log. Conserva error antefault/blocked,
ACK/heartbeat ausentes, antiguos o inválidos, y procesa salida como sender_exited.
Prueba nueva reproduce error antes del parche; servicio/latencia/vigilancia56casos
aprobados después. Se mantienen todos los cambios4a, incluido encabezadoJSON.
Base sigue Almacén-3 porque4/4a solo se verificaron, sin instalación/pausa confirmadas.
Backend no requiere otro despliegue por este ajuste local. Verificación, plan y
aplicación4b en Dell siguen pendientes.

Preparación4b cerrada el2026-11-01México; nombre de release conserva la familia31oct.
ZIP4b:196entradas/508680bytes,
SHA256`0b1d87726e911ef9c0c504dc26f55ea9a43394d1cd1f619cb89c6a37265b0b59`;
manifiesto`4c6a8a61996a7c90306d39514b7725c5774725771f13bc9405abc333f2bec6a6`.
Verificación y10pruebas del instalador/reversión del ZIP4b aprobadas sobre copias,
además de56pruebas de servicio/latencia/vigilancia. No se editaron estados reales
ni se silenció la vigilancia; no se instaló4a y base de actualización sigue3.
