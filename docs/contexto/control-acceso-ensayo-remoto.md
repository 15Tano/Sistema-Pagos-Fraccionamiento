# Control de acceso: preparación del ensayo remoto

2026-10-23. Usuario confirma SSH mediante `ssh root@api.sanisidro.info` y comparte
el script `/root/deploy-sanisidro.sh`. El script hace fetch/pull, respaldo de código,
comparación de migraciones, rsync --delete al docroot, Composer, limpieza de caché,
migraciones opcionales, permisos, recarga de PHP-FPM y curl a la raíz pública.
Tiene confirmaciones intermedias, pero su destino es producción; no es un comando
de ensayo. La verificación de la raíz no certifica los endpoints de ingesta.

Estado informado: `/root/repo-sanisidro` limpio en refactor-headless siguiendo
origin/refactor-headless; no se recibió hash remoto ni se hizo fetch/pull/despliegue.
PHP CLI 8.4.20, PDO mysql y sqlite. No certifica PHP-FPM ni versión de MySQL.

## Paquete y preparación aislada

Fuentes de `backend/app`, config, rutas y entradas necesarias se toman del commit
9beb4f04c3952d6fecb662edfb7b0f2c3049c839. Solo se incluye la migración nueva de acceso;
se excluyen .env, vendor, datos, scripts operativos y frontend compilado.
Builder: `tools/agente_acceso/empaquetar_ensayo_servidor.py`.
Scripts revisables en `tools/agente_acceso/ensayo_servidor/`.
Artefacto: `tools/agente_acceso/Ensayo_Acceso_Servidor_2026.10.23-1.tar.gz`,
73 archivos, SHA256
`70bdc08f49c6686e06037465456966898f0ffe1c30c9395939c01c2c0f4fd5be`.

Destino exclusivo: `/root/sanisidro-ensayos/acceso-20261023-1`.
El preparador valida ruta física y usuario root, manifiesto y carpeta nueva;
exige composer.lock igual al de producción para copiar vendor a la copia y
reserva de 1 GiB además del espacio de esa copia. No invoca Composer en producción.
Genera .env propio con clave aleatoria, SQLite en datos/ensayo.sqlite, solo la
migración de acceso y agente TEST-C3-001 con secreto aleatorio. Procesos PHP con
entorno limpio, sin heredar configuración de producción. Credencial solo en archivos
root, sin mostrarla en salida compartible.

Servidor PHP temporal en primer plano, exclusivamente 127.0.0.1:18880. Router
restringido a GET /salud y los dos POST de ingesta, sin servir otros archivos/rutas.
Se detiene con Ctrl+C. Sin servicios, tareas, firewall, Nginx ni PHP-FPM modificados.
Túnel previsto desde Dell: `ssh -N -o ExitOnForwardFailure=yes -L
127.0.0.1:18881:127.0.0.1:18880 root@api.sanisidro.info` (en una sola línea).
Emisor apuntará al HTTP loopback 18881 con opción explícita de ensayo; tráfico
entre computadoras cifrado por SSH, no HTTP público.

Validaciones locales: sintaxis Bash y PHP correctas; manifiesto completo y contenido
del paquete por SHA256. Preparación en Linux remoto posteriormente confirmada por
salida del usuario (ver evidencia siguiente); arranque y envío desde Dell pendientes.
No se hizo push; las fuentes nuevas no están en origin. El paquete permite probar
la copia confirmada localmente antes del push/despliegue final autorizado.
No usar credenciales de producción ni enviar secretos por chat.

## Preparación remota confirmada — 2026-10-24

Usuario confirma archivo de 82 KiB en /root, SHA256 del paquete OK y FUENTES
VERIFICADAS. package:discover termina correctamente; se crea tabla de migraciones
y solo se aplica 2026_10_23_210000_create_control_acceso_ingestion_tables.
Salida ENSAYO PREPARADO, serial TEST-C3-001,
agent_id=6b293548-0312-4d06-9c1d-3a7e79c9c5a0 (identificador, no secreto).
SQLite exclusiva en la carpeta de ensayo; el preparador informa credencial en
datos/credencial-ensayo.json, acceso solo root. No se recibió ni registró su secreto.
La salida concuerda con las guardas, copia de dependencias y configuración separada
del paquete revisado. No se ejecutó deploy. El arranque posterior se documenta abajo.

## Siguiente evidencia requerida

Configurar emisor de ensayo en Dell, guardar credencial en DPAPI mediante
SSH y enviar únicamente fixtures. Confirmar ACK real, reintento y conteos antes
de integrar SDK o ejecutar el deploy habitual. Este ensayo no modifica el polling.

## Arranque y salud comprobados — 2026-10-24

Usuario comparte inicio mediante bash iniciar_ensayo.sh, PHP 8.4.20 en
127.0.0.1:18880. Desde PowerShell en Dell ejecuta SSH con curl --fail a /salud;
obtiene {"status":"ensayo_listo","device_serial":"TEST-C3-001"}.
Log del servidor: inicio 2026-10-24 20:19:51, conexión 20:20:04 (zona de ese log
no comprobada). Después pulsa Ctrl+C y vuelve al prompt: proceso detenido.
La prueba confirma acceso SSH y salud del servicio de ensayo durante esa ventana;
no certifica túnel local 18881, autenticación del agente ni entrega de lotes.
Reiniciar PHP y mantener esa terminal abierta para probar el envío.

Cliente manual preparado en tools/agente_acceso/ensayo_dell.py: exige UUID de este
ensayo y serial TEST-C3-001, importa JSON de SSH directamente a DPAPI de Dell,
sin archivo de secreto en texto claro ni impresión del token. Solo destino
127.0.0.1:18881/api/control-acceso/agente. Outbox exclusiva en
datos/ensayo_remoto. Prepara tres originales ficticios (evento, estado 255, error
binario -2) y un estado ficticio, dos mensajes en total. UUID/horas fijos permiten
repetir preparar secuencialmente sin duplicar; no ejecutar preparadores paralelos.
Enviar conserva reintentos, originales, hashes y ACK del emisor existente.
No carga DLL, no lee el estado real del polling, no instala tareas y no requiere
pausa del gestor. Instrucciones en LEEME_ENSAYO_DELL.md dentro del paquete cliente.
Importación/entrega real desde Dell siguen pendientes de evidencia del usuario.

Paquete cliente: tools/agente_acceso/Ensayo_Emisor_Dell_2026.10.24-1.zip,
8 archivos, SHA256 f7a4c4525a3204a4dce24f4d2d5e6da12df40aba04a45b4d034a728666625c12.
Manifiesto, fuentes dentro del ZIP y verificador Windows PowerShell correctos.
Suite local completa: 26 pruebas aprobadas (23 anteriores y 3 del cliente),
11.517 s, Python 3.12.5. Nuevas: identidad/campos/entrada limitada; importación
a DPAPI real sin eco ni JSON claro; fixtures repetibles y ACK Laravel real,
conservación byte a byte en servidor y sin duplicación por repetir preparar/enviar.
ACK esperado del lote: 3 respuestas, 2 filas, 1 evento, 1 estado y 1 respuesta
sin interpretar (el error SDK ficticio conservado como sdk_error).
La primera corrida fue bloqueada por WinError 10013 del sandbox; se repitió con
acceso HTTP local permitido. Otra repetición agotó el inicio PHP en una prueba
anterior; la última corrida completa pasó. No se cambió el backend ni sus límites.

## Cliente Dell configurado — 2026-10-24

Usuario comparte PAQUETE VERIFICADO del cliente 2026.10.24-1 y ejecución de la
tubería SSH a ensayo_dell.py configurar. Resultado CONFIGURADO: credencial DPAPI
del usuario actual e identidad de ensayo verificadas. No compartió el secreto.
Esto confirma importación/cifrado local según el cliente revisado; no certifica
túnel, envío, ACK ni estado actual del proceso PHP. Esos pasos siguen pendientes.
Usuario está ahora físicamente en caseta con tag 12230693 para una captura SDK
controlada, que se realizará aparte sin enviar sus datos al backend de ensayo.

## Pendientes conservados sin conexion — 2026-10-24

Usuario comparte preparar y enviar en Dell, con destino de tunel aun sin abrir.
Preparacion: dos mensajes pendientes, tres originales, unbatched=0, paused vacio.
oldest_pending_utc=2026-10-25T01:23:30.251481+00:00 (24 octubre 19:23:30 Mexico).
Envio: delivery=[retry], lote attempts pasa de 0 a 1, error=network, ack=null;
estado conserva attempts=0. Ambos siguen pendientes, sin pausa global.

Identidades para comparar en el siguiente reintento:
- Lote f640e2c4-63a9-4fae-90e8-440c2b39ea54, sequence=0, SHA256
  92ab401adab4b8b42afa52502755b3e4383ff6b455635d0c4189e94da02f0239.
- Estado 8d3b4772-b0d9-499e-843f-1de1a9e2475c, sequence=0, SHA256
  549760fa90d2ac344488fdea6d1de61d09b12e4c564428d4b75eeb0c8fc414f7.

Los tres response_id fijos terminados 0001/0002/0003 mantienen 41/35/16 bytes y
los mismos hashes antes/despues del fallo. No se borro ni renumero evidencia.
Confirma en Dell persistencia de originales/mensajes y reintento ante fallo de
conexion; no certifica caida general de Internet, autenticacion ni recepcion remota.
No se consulto SDK ni se requirio mantenimiento. Pendiente reiniciar PHP de
ensayo si sigue detenido, abrir tunel 18881 y reenviar estos mismos pendientes;
comprobar ACK, hashes/identidades conservados y segundo enviar sin nuevos mensajes.

## Entrega desde Dell confirmada — 2026-10-24

Usuario comparte las dos salidas de enviar despues de abrir servidor/tunel segun
el procedimiento. Primer comando: delivery=[acked,acked,idle]; segundo: [idle].
Ambos muestran messages.acked=2, responses=3, unbatched=0, pending_count=0,
paused vacio y oldest_pending_utc=null. Los UUID, secuencias y hashes de los dos
mensajes coinciden exactamente con los pendientes conservados en el fallo previo.
Lote f640e2c4-63a9-4fae-90e8-440c2b39ea54 termina attempts=2 (fallo previo +
entrega), estado 8d3b4772-b0d9-499e-843f-1de1a9e2475c attempts=1; error=null.

ACK de lote: accepted, protocol_version=1, agente esperado, batch_id/hash
coincidentes, server_received_at_utc=2026-10-25T01:29:58.934905Z. Informa
responses_stored=3, rows_stored=2, events_stored=1, statuses_stored=1 y
responses_pending_interpretation=1. Este ultimo es el error SDK ficticio -2
conservado como sdk_error, no una falla de entrega. ACK de estado: accepted,
sequence=0, session_id=d5c7e201-5cf1-4b08-a3b5-5e353853c568, hash coincidente,
server_received_at_utc=2026-10-25T01:29:59.460732Z (24 octubre 19:29:59 Mexico).

Los tres originales conservan 41/35/16 bytes y hashes:
- 0001: 1e1ae8648ea9000a090bb595efe8898320f8d88c61684fb899a97126c5c619b6.
- 0002: 96381db5e541563b2d40f24013e1fcbb7336f39d0ebad7d4c1536a4447dda99b.
- 0003: 283474c1aeffde2affe854ce1bb4b066e4452d720ff79610141e819a840b7cce.

Entrega autenticada por la ruta de ensayo, ACK validado/guardado en Dell y
recuperacion del pendiente tras fallo de conexion comprobados para estos fixtures.
El segundo comando no hizo nuevos envios ni aumento intentos. No equivale a
probar perdida de ACK tras commit remoto ni reenvio deliberado de un lote ya
aceptado; esos escenarios siguen cubiertos por pruebas locales, no por este paso.
Conteos remotos son los informados por ACK; no se hizo inspeccion SQL independiente
de la SQLite remota en esta salida. No se enviaron eventos reales de los tags,
no se instalo recolector/tarea y no se ejecuto deploy/push. Emisor no toca SDK
ni polling. Solicitado Ctrl+C en ventanas de servidor PHP temporal y tunel al
terminar, conservando carpetas/bases/evidencia; cierre de procesos aun no aportado.
Siguiente etapa: coordinador SDK en carpeta separada, prioridad de vigencias y
parada/mantenimiento cooperativos; instalacion permanente requiere transicion
autorizada y sigue pendiente.

2026-10-24, preparacion de coordinador: usuario crea en esta misma copia aislada
un agente adicional para serial real CO2K225060027, nombre EnsayoCoordinadorC3,
UUID c8d7ccdc-991f-497c-8383-92fb52921f8a. Salida Artisan privada con umask077 en
datos/alta-controlador-real.txt; solo UUID compartido. TEST-C3-001 permanece aparte.
La nueva credencial aun no se importa a Dell ni se envia un lote de ese agente.
Simulacion del coordinador en Dell aprobada; siguiente lectura readonly acotada
durante mantenimiento, sin HTTP. Ver control-acceso-coordinador.md.

Tras ensayo readonly real del coordinador (93respuestas) y reanudacion r2
confirmada con dos ciclos, se prepara complemento de entrega independiente:
Entrega_Coordinador_2026.10.24-1.zip. Importa desde alta-controlador-real.txt por
SSH directo a DPAPI y usa la outbox existente del UUID real; no toca SDK/polling.
50 pruebas locales aprobadas (7 nuevas), incluyendo entrega a Laravel aislado
local y segundo envio idle. Provision/importacion en Dell y recepcion remota de
estas93respuestas todavia pendientes. Fuentes, SHA y pasos en documento de coordinador.

Importacion en Dell posteriormente confirmada: complemento verificado,
CONFIGURADO (DPAPI del agente real), estado con93respuestas/30mensajes/3sinlote,
ningun ACK y hashes verificados. Manifiesto de originales
ee79ca83bef66050d092b171967985bfe8dc703f022fc35f62bd2f1a70b99700.
Pendiente activar/usar servidor y tunel privados, enviar capturas y verificar ACK
sin cambio de originales ni mensajes existentes. No se compartio token.

## Recepcion de capturas reales confirmada por ACK — 2026-10-24

Usuario entrega outbox del agente c8d7ccdc-991f-497c-8383-92fb52921f8a,
serial CO2K225060027: 31mensajes confirmados, 5estados y26lotes. ACK suma
93respuestas/93filas, 51eventos y42estados, pendientes de interpretacion0.
Pendientes locales0, sin lote0, pausa vacia. Segundo enviar idle1 y mismos totales.
Los93originales conservan manifiesto
ee79ca83bef66050d092b171967985bfe8dc703f022fc35f62bd2f1a70b99700;
hashes de originales/cuerpos verificados, originals_preserved=true y
existing_messages_unchanged=true en ambas salidas. No hay inspeccion SQL remota
independiente ni reenvio deliberado de mensajes ya confirmados en esta prueba.

Servidor existente respondio /salud tras puerto ocupado al intentar otra instancia;
no se sustituyeron procesos. Solicitar cierre del tunel y del servidor temporal
desde sus ventanas, conservando evidencia. Cierre aun pendiente. No deploy,
instalacion permanente ni nueva pausa. Detalle y siguientes limites en
control-acceso-coordinador.md.

## Segunda entrega real:149respuestas confirmadas — 2026-10-24

Tras pruebas de parada solicitada y reapertura, usuario envia22mensajes nuevos
desde la misma outbox/agente real. Total53confirmados (9estados/44lotes),
149respuestas/149filas segun ACK:106eventos y43estados, interpretacion pendiente0.
Pendientes0 y sin lote0, pausa vacia; segundo enviar idle1 y mismos totales.
Originales149 conservados con mismo manifiesto previo
edfaeae5adbfc8d3f176f0f885fbbf861ac312c2666b50b4b8433e2b9eb407e1;
hashes de originales y cuerpos correctos, originales/mensajes existentes sin
cambios. Son56respuestas adicionales a93anteriores; no se afirma cruce fisico,
frescura ni completitud por esos conteos. Sin consulta SQL remota independiente.
Consola PHP temporal muestra inicio y conexiones Accepted/Closing del ensayo.
Cierre de servidor/tunel solicitado al terminar, no confirmado. Sin produccion,
SDK ni pausa adicional. Detalle en documento de coordinador.

## Tercera entrega real: 228 respuestas confirmadas — 2026-10-25

Tras el ensayo de cierres readonly, usuario comparte salud de tunel18881 con
status ensayo_listo/device_serial TEST-C3-001 (marcador estatico del laboratorio,
no identidad del agente que envia) y dos ejecuciones de entregar_coordinador.py
enviar. Agente real c8d7ccdc-991f-497c-8383-92fb52921f8a, serial CO2K225060027.
Primer envio confirma31mensajes nuevos; acumulado84 (14estados y70lotes).
ACK validados suman228respuestas/228filas:157eventos,71estados y0respuestas
pendientes de interpretacion. Frente a entrega anterior: +79respuestas,
+51filas de evento y+28de estado; no son conteos certificados de vehiculos.

Pendientes0, unbatched0, pausa vacia y oldest_pending_utc null. Segundo envio
delivery idle1 sin nuevas confirmaciones, mismos totales y manifiesto original:
483c43bc939fdece659d2fd9e6d67974e19d5784f4fabbfc45f570744da4ee32.
Ambas salidas: originales228/hashes_verified true, cuerpos de84mensajes con
hashes verificados, originals_before228, originals_preserved true y
existing_messages_unchanged true. Evidencia local resumida en
C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento\entrega_resumen.json;
ACK completos y originales retenidos en outbox.sqlite del mismo almacen.
Salida compartida no incluye timestamps nuevos de ACK; no inventar hora de
recepcion ni afirmar inspeccion SQL remota independiente. Segundo envio idle
verifica cola vacia; no prueba reenvio forzado de un lote ya aceptado.

Entrega concluida al backend aislado sin SDK, mantenimiento ni deploy nuevo.
Polling se conserva funcionando; ultima evidencia de salud sigue siendo los
tres ciclos posteriores al ensayo de cierres, no renovada por esta entrega.
Solicitar Ctrl+C en ventanas identificadas del tunel y del servidor temporal
si siguen abiertas, conservando datos; cierre de esos procesos sin confirmar.
Pendiente siguiente: enlace de control/estado con gestor y vigilancia en
candidato separado, antes de transicion permanente autorizada.

2026-10-25, validacion acumulada posterior por reporte de emisor vigilado2:
85mensajes acked (15estados/70lotes) frente a84anteriores,228respuestas/filas
(157eventos/71estados), pendientes0 y originales/cuerpos conservados con mismo
manifiesto483c43bc939fdece659d2fd9e6d67974e19d5784f4fabbfc45f570744da4ee32.
Reporte terminado20:00:34Z valida ACK persistidos, sin ACK fresco en esa ventana
(215idle, cola ya vacia). No inspeccion SQL remota ni reenvio forzado. Emisor1
tuvo fallo local de snapshot; emisor2 termina limpiamente y confirma al hijo.
Detalle/correccion y evidencia en control-acceso-envio-vigilado.md. Estado final
de ventanas servidor/tunel no compartido; no inferir que hayan sido cerradas.
