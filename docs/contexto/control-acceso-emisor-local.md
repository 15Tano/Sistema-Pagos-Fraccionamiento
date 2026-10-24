# Control de acceso: emisor y almacén local

2026-10-23. Usuario autoriza continuar esta etapa y sus pruebas.
Implementación separada en `tools/agente_acceso/`, sin nuevas
dependencias instaladas. Todavía no instalada ni conectada con caseta.

## Funcionamiento implementado

1. `Outbox.capture()` conserva bytes SDK completos, retorno, origen, UUID, SHA256
   y fechas de captura UTC. No interpreta eventos ni recalcula vigencias.
2. SQLite con WAL, `synchronous=FULL`, transacciones y FK. Identidad fija de agente,
   controlador y sesión persistente; versión del almacén y application_id propios.
   No acepta un SQLite ajeno ni cambia identidad al reiniciar.
3. Formación transaccional de lotes inmutables, secuencia persistente por endpoint,
   máximo inicial 20 respuestas (configurable hasta 100), límite 1 MiB y agrupación
   conservadora de hasta 2000 líneas. Una respuesta individual excesiva no se
   recorta: se conserva; si backend la rechaza, se pausa para revisión.
4. El snapshot de estado se encola con secuencia propia, máximo 16 KiB. El emisor
   recibe snapshots explícitos; aún no recolecta archivos del polling por su cuenta.
   Laravel conserva su validación completa y autoridad sobre lo recibido.
5. Un emisor reclama mensaje con lease SQLite de 60 s, confirma el reclamo y libera
   la transacción antes de HTTP. Dos emisores no reclaman el mismo pendiente vigente.
   Tras muerte del proceso, otro lo recupera al expirar el lease. Si fue reasignado,
   un ACK del propietario anterior no puede marcar el registro.
6. Envío de los mismos bytes/UUID en cada reintento. ACK válido exige HTTP 200/201,
   protocolo, accepted, agente, lote o sesión/secuencia, hash, fecha UTC y contadores
   coherentes. Laravel sigue interpretando las filas; no hay un segundo parser local.
   Se conservan ACK y originales; no se eliminan al marcar entregado.

El hash canónico se probó con Unicode y separadores U+2028/U+2029 contra PHP real.
Los tipos flotantes no forman parte del protocolo del emisor; se rechazan para
evitar representaciones ambiguas. `rows_stored=events_stored+statuses_stored` y
`responses_stored` debe coincidir con el número enviado. El emisor admite originales
aceptados sin interpretar y no exige que toda respuesta produzca un evento.

## Errores y límites

- Red/timeout, HTTP 408/429/5xx: conserva pendiente; espera exponencial con jitter,
  hasta unos 300 s, o más si lo exige Retry-After. El plazo queda en SQLite.
- Credencial, identidad, conflictos, límites, esquema, redirecciones o ACK inválido:
  pausa global; no renumera, borra ni modifica el mensaje. `reanudar` requiere
  intervención después de resolver la causa, reintentando el contenido original.
- Credencial guardada con DPAPI del usuario actual, prompt oculto. HTTPS con TLS
  normal; HTTP únicamente por opción explícita y host literal 127.0.0.1/::1.
  Sin redirecciones ni proxies heredados. Errores no imprimen tokens ni payloads.
- Tanda CLI de hasta 100 mensajes; valor inicial 20. Timeout HTTP 10 s, configurable
  hasta 15 s. Un envío no mantiene bloqueada la escritura SQLite durante la red.
- Capacidad inicial local 256 MiB y reserva de disco 64 MiB, comprobadas antes de
  agregar originales/lotes. Son valores iniciales; no una retención dimensionada.
- El futuro coordinador debe llamar `ensure_capture_capacity()` antes de leer RT,
  y detener nuevas lecturas si `capture()` falla. El disco puede cambiar entre ambos
  pasos; sigue existiendo la ventana SDK→persistencia. No se promete cero pérdidas.
- No hay tarea, daemon, SDK, limpieza automática ni integración con el gestor.
  SQLite debe permanecer en disco local; se necesita estrategia de respaldo/retención
  antes de operación continua. No copiar solo el archivo principal mientras esté abierto.

`health()` distingue entregados, pendientes, bloqueados y respuestas aún sin lote.
`pending_count` suma mensajes pendientes/bloqueados y respuestas sin lote, no personas
ni eventos físicos. Antigüedad desde la captura/creación local, sin certificar RTC C3.
Una falla del emisor nunca cambia `last_ok_utc` de vigencias ni actúa sobre su tarea.

## Evidencia

**23 pruebas aprobadas** con Python 3.12.5 / SQLite 3.45.3 de esta computadora:

- Persistencia al reabrir, UUID repetido y conflicto, multiplicidad, identidad,
  agrupación/tamaño, secuencias separadas y límite antes de guardar.
- Falta de espacio simulada, SQLITE_FULL real por límite de páginas en la base de
  prueba, rollback de asignación de lote y fallo al guardar ACK.
- Salida abrupta de un subproceso con `os._exit`, recuperación WAL y lease; protección
  ante otro emisor y ante confirmación por un propietario anterior.
- Red interrumpida, Retry-After, 5xx, códigos permanentes y ACK incorrecto.
- DPAPI real con secreto ficticio: el archivo cifrado no contiene el secreto claro.
- HTTP loopback y redirección rechazada sin reenviar credencial.
- Tres ensayos contra kernel HTTP Laravel real en servidor PHP efímero y SQLite
  aislado: ACK perdido tras commit y reenvío después de reabrir (una sola copia),
  estado Unicode y originales RT/255/error binario, y conflicto real 409 sin descarte.

Los tests usan solo fixtures ficticios. Servidores de ensayo detenidos y conexiones
SQLite cerradas al terminar. No se reinició MySQL ni se tocó la base configurada en
`.env`. No se modificó el código del backend; su contrato existente fue suficiente.
Repetición y CLI en [LEEME del emisor](../../tools/agente_acceso/LEEME.md).

## Pendientes

Usuario confirma en Dell Python32 3.13.13, SQLite 3.50.4 y SELECT 1 en memoria
correcto. Esto confirma importación/consulta básica, no WAL en disco ni DPAPI.
Preparado `tools/agente_acceso/Preflight_Emisor_2026.10.23-1.zip`: fuentes actuales
de outbox/protocolo/credencial, diagnóstico local, instrucciones y manifiesto.
SHA256 ZIP: `de69437863757601c3fdcaddc80be12b07e1356936153f8a37f669086a750159`.
Diagnóstico local aprobado en Python 3.12.5 x64: 13 comprobaciones verdaderas y
temporales retirados. Ejecución Dell posteriormente aprobada por salida del usuario:
Python 3.13.13 x86, SQLite 3.50.4, usuario Dell, status compatible_local y las 13
comprobaciones en true, temporary_files_removed=true. Inicio UTC
2026-10-24T05:14:22.225259+00:00; fin 05:14:22.616747+00:00. Evidencia remota:
`C:\SanIsidro\PreflightEmisor_20261023\registros\20261023_231422_bb300c43`.
WAL/FULL/FK, reapertura, leases, ACK simulado e integridad/DPAPI verificados en ese
Python y usuario. Sin SDK, red ni credencial real; ACK simulado no certifica entrega
HTTP ni inicio mediante tarea. No se requirió pausa del polling.

Preparar servidor y credencial de ensayo para una prueba remota controlada. Usuario
confirma acceso SSH y comparte PHP CLI 8.4.20, PDO mysql/sqlite; terminal en
`/home/sanisidro-back/htdocs/api.sanisidro.info` como root. Script de despliegue
confirmado por usuario: `/root/deploy-sanisidro.sh`; `type -t deploy` no produjo
salida. Script posteriormente recibido y revisado: despliega directamente al
docroot con rsync, Composer, migraciones y recarga PHP-FPM. Repositorio remoto
informado limpio en refactor-headless, siguiendo origin/refactor-headless.
SSH confirmado como `root@api.sanisidro.info`. Paquete de backend de ensayo
preparado; [alcance y límites](control-acceso-ensayo-remoto.md).
Esto no certifica PHP-FPM ni la versión del servidor MySQL. Preparación remota
posteriormente confirmada el 2026-10-24: paquete/hash y fuentes verificados,
migración exclusiva aplicada, ENSAYO PREPARADO y agente TEST-C3-001 con UUID
6b293548-0312-4d06-9c1d-3a7e79c9c5a0. Arranque de servicio, /salud y entrega
real desde Dell pendientes. No se publicó un endpoint público. No enviar tokens por chat.
Después: coordinador SDK en carpeta separada, parada/mantenimiento cooperativos,
prioridad de vigencias, watchdog y transición autorizada. La lectura real todavía
no llama `Outbox.capture()`; no dar por instalado un recolector permanente.
Reloj/mapa físico y reconciliación histórica siguen pendientes.
