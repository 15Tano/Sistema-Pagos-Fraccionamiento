# Control de acceso: contrato de ingesta v1

2026-10-23. Primera entrega autorizada por el usuario e implementada localmente.
Sin despliegue, migraciones en bases existentes ni conexión del polling instalado.
Diseño general: [control-acceso-diseno-integracion.md](control-acceso-diseno-integracion.md).

Actualizacion2026-10-26: consultas humanas de estado/eventos implementadas y
probadas localmente, deshabilitadas por defecto y sin despliegue. Contrato y
evidencia en [monitor](control-acceso-monitor-api.md). La ingesta v1 permanece
compatible y no modifica /api/vencimientos. Las menciones posteriores a una
consulta futura describen el alcance original de esta primera entrega.

## Rutas y credenciales

| Método y ruta | Función |
| --- | --- |
| POST /api/control-acceso/agente/estado | Conservar un reporte de salud |
| POST /api/control-acceso/agente/lotes | Conservar respuestas SDK y sus filas interpretables |

Ambas requieren `Content-Type: application/json` y `Authorization: Bearer <token>`.
Credencial exclusiva por agente/controlador: `sica_` seguido de 64 caracteres hexadecimales
minúsculos aleatorios. Backend conserva únicamente SHA256 del secreto. No autentica
usuarios humanos ni permite consultar sus rutas. El serial debe coincidir con el
registrado para la credencial; enviarlo en JSON no concede autoridad sobre otro equipo.
En producción se requiere HTTPS. Las rutas no cambian `/api/vencimientos`.

Administración mediante consola Laravel, sobre una base de ensayo ya preparada con
la migración `2026_10_23_210000_create_control_acceso_ingestion_tables.php`:

```powershell
php artisan control-acceso:agente crear --nombre="Caseta de ensayo" --serial="TEST-C3-001"
php artisan control-acceso:agente rotar --id="UUID-DEL-AGENTE"
php artisan control-acceso:agente revocar --id="UUID-DEL-AGENTE"
```

Ejecutar desde `backend/`. Crear y rotar muestran el secreto una sola vez; su destino
en caseta es DPAPI, implementado en el emisor local y todavía sin instalar en Dell.
Rotar invalida inmediatamente la
credencial anterior y reactiva un agente revocado. Revocar conserva todo el historial.
La ingesta vuelve a comprobar la credencial dentro de su transacción, con bloqueo
del agente, para coordinarse con rotación/revocación.

## Sobre común

| Campo | Regla |
| --- | --- |
| protocol_version | Entero JSON, exactamente 1 |
| agent_id | UUID devuelto al crear la credencial |
| device_serial | Serial autorizado, 1–64 caracteres ASCII: letras, números, `_ . : -` |
| session_id | UUID persistente de la sesión del agente |
| sequence | Entero JSON, 0–2147483647; no cadena ni decimal |

Estado y lotes tienen espacios de secuencia separados por agente/sesión. Una sesión
nueva utiliza otro UUID; un reintento conserva sesión, secuencia y contenido originales.
Los UUID se normalizan a minúsculas. Los campos fuera del contrato se rechazan.
Las fechas UTC admiten `YYYY-MM-DDTHH:mm:ss[.ffffff]Z` o `+00:00`, años 1000–9999.

## Estado

Ejemplo ficticio; reemplazar identidades por las del agente de ensayo:

```json
{
  "protocol_version": 1,
  "agent_id": "10000000-0000-4000-8000-000000000001",
  "device_serial": "TEST-C3-001",
  "session_id": "20000000-0000-4000-8000-000000000001",
  "sequence": 0,
  "reported_at_utc": "2026-10-24T02:27:44Z",
  "agent_version": "ensayo-1",
  "worker_version": "ensayo-1",
  "pid": 100,
  "vigencias": {
    "protocol": 2,
    "pid": 100,
    "run_started_utc": "2026-10-24T02:26:37Z",
    "phase": "idle",
    "last_ok_utc": "2026-10-24T02:27:44Z",
    "consecutive_errors": 0,
    "heartbeat_utc": "2026-10-24T02:27:44Z"
  },
  "sdk": {"last_ok_utc": "2026-10-24T02:26:27Z", "last_error_code": null},
  "reader": {"state": "status_observed", "checked_at_utc": "2026-10-24T02:26:27Z"},
  "sender": {"pending_count": 1, "oldest_pending_at_utc": null, "last_ack_at_utc": null}
}
```

Campos obligatorios: sobre común, `reported_at_utc`, `agent_version`, `pid` y los
cuatro objetos `vigencias`, `sdk`, `reader`, `sender`. Reglas de esos objetos:

- `vigencias.protocol=2`, `pid` positivo, `phase` en `starting|cycle|idle|stopped`,
  `consecutive_errors` no negativo. Fechas opcionales o nulas: `run_started_utc`,
  `last_ok_utc`, `heartbeat_utc`, `cycle_started_utc`, `cycle_finished_utc`.
  `last_error_type` opcional/nulo, máximo 128 caracteres.
- `sdk.last_ok_utc` y `last_error_code` opcionales/nulos. Código entero de 32 bits
  con signo. Ausencia de error no certifica acceso físico.
- `reader.state` obligatorio: `catching_up|status_observed|unknown|paused`.
  `checked_at_utc` opcional/nulo. `status_observed` no certifica el reloj del equipo.
- `sender.pending_count` obligatorio, no negativo. `oldest_pending_at_utc` y
  `last_ack_at_utc` opcionales/nulos.
- `watchdog` opcional: `status` obligatorio si está presente, valores
  `correcto|alerta|mantenimiento|desconocido`; `checked_utc` y `reason` opcionales/nulos
  (motivo máximo 512 caracteres). Reportar solo si se leyó esa fuente realmente.

Todos los PID/contadores usan enteros JSON hasta 2147483647. Versiones máximo 64
caracteres; `worker_version` opcional/nulo. Se conserva cada reporte, incluso uno
atrasado, sin reemplazar otro más reciente. La consulta de estado actual se diseñará
posteriormente; no se ha implementado una pantalla ni ruta de consulta.

## Lotes de respuestas

Una respuesta representa una llamada SDK completa. Este ejemplo usa una tarjeta y
un Pin ficticios; sus bytes son `2026-10-23 19:49:05,42,12345678,2,0,1,4\r\n`.

```json
{
  "protocol_version": 1,
  "agent_id": "10000000-0000-4000-8000-000000000001",
  "device_serial": "TEST-C3-001",
  "session_id": "20000000-0000-4000-8000-000000000001",
  "sequence": 0,
  "batch_id": "30000000-0000-4000-8000-000000000001",
  "responses": [{
    "response_id": "40000000-0000-4000-8000-000000000001",
    "source": "rt",
    "sdk_return_code": 1,
    "raw_payload_base64": "MjAyNi0xMC0yMyAxOTo0OTowNSw0MiwxMjM0NTY3OCwyLDAsMSw0DQo=",
    "sha256": "9e841d2b1f27d1d02ef20ad9b3361f9f9d107845b94545a4925ccee89fd0df8c",
    "captured_started_utc": "2026-10-24T02:12:01.854246Z",
    "captured_ended_utc": "2026-10-24T02:12:01.951000Z",
    "pc_local_time": "2026-10-23T20:12:01.854246-06:00",
    "windows_timezone": "Central Standard Time (Mexico)"
  }]
}
```

`batch_id` y `response_id` son UUID persistidos por el futuro emisor; no se regeneran
al reintentar. `source` admite `rt|transaction`. `sdk_return_code` es un entero JSON
de 32 bits con signo. Base64 estándar canónico, sin saltos/espacios; SHA256 hexadecimal
minúsculo de los bytes decodificados. Payload vacío se representa con `""`, no null.
Fin de captura mayor o igual al inicio, ambos obligatorios. Contexto del PC opcional
o nulo: `pc_local_time` máximo 40 y `windows_timezone` máximo 100 caracteres; se
conserva como texto, sin usarlo para certificar zona/reloj del controlador.

El agente no envía filas interpretadas. Laravel usa parser `zk-pull-text-v1`:

- RT: siete campos CSV de fecha, Pin, tarjeta, puerta, código, sentido y verificación.
- Transaction: cabecera `Cardno,Pin,Verified,DoorID,EventType,InOutState,Time_second`
  (se permite otro orden de esas columnas), más filas cuyo número coincida con el
  retorno SDK. Se conserva `Time_second` y su conversión al calendario empaquetado ZK.
- Cada fila conserva posición, campos originales y duplicados. Un código numérico
  desconocido se conserva sin asignarle significado. No hay unicidad por tarjeta/hora.
- Código 255 produce `kind=status` y campos de tarjeta, Pin, puerta, sentido y
  verificación nulos; los campos originales permanecen en `raw_fields`.
- Fecha del dispositivo sin zona, separada de capturas UTC y recepción UTC del
  servidor. No se certifican cruce de pluma, persona, autorización o reloj.
- Retorno negativo: `sdk_error`, bytes conservados, sin filas. Formato desconocido,
  binario, fecha inválida, exceso de líneas por respuesta o conteo transaction
  inconsistente: `unparsed`, bytes conservados, sin interpretación parcial.
- Payload vacío con retorno 0 conserva una respuesta sin filas; no implica estado 255.

El ACK indica cuántas respuestas, filas, eventos, estados y respuestas pendientes de
interpretación se conservaron. Aceptación durable puede incluir respuestas sin
interpretar. No modifica tags, vecinos, asociaciones, pagos ni vigencias.

## ACK, reintentos y errores

`201` para aceptación nueva; `200` para repetición idéntica, con el mismo ACK guardado
(incluida su fecha original). Se responde después de confirmar la transacción.
Un fallo al persistir revierte lote, respuestas y filas; no hay aceptación parcial.

Estado identifica por agente/sesión/secuencia; lote por agente/`batch_id` y además
reserva agente/sesión/secuencia. Una respuesta ya asignada a un lote no puede enviarse
en otro lote, ni con bytes idénticos: reintentar siempre el lote original. Cambiar
contenido con el mismo identificador produce `409`. El orden de claves de objetos
JSON no cambia su identidad; el orden de listas sí. UUID se normalizan; fechas y
otros textos conservan su representación. Campos ausentes y campos null son distintos.

`content_sha256` del ACK identifica el mensaje validado: ordenar recursivamente las
claves de objetos, conservar orden de listas y codificar JSON compacto UTF-8 sin
escapar Unicode ni `/`, conservando `.0` en flotantes. El servidor calcula este hash;
es distinto del SHA256 de cada payload SDK. El futuro emisor debe comprobar identidad,
hash y contadores antes de marcar enviado. Un timeout/5xx requiere reintento del
mismo lote; un 2xx genérico no permite borrar originales.

| Código | Acción del emisor futuro |
| --- | --- |
| 401 | Credencial inválida/revocada; conservar pendientes y señalar error |
| 403 | Identidad/serial no autorizado; corregir configuración |
| 409 | ID/secuencia reutilizado; conservar evidencia y revisar, no renumerar para eludirlo |
| 413 | Cuerpo/estado supera límite; preparar lotes válidos antes del primer envío |
| 415 | Enviar application/json |
| 422 | Esquema/hash/base64/fechas/filas inválidos; revisar sin descartar evidencia |
| 429 | Esperar y reintentar respetando Retry-After |
| 5xx/timeout | Reintentar con espera progresiva, mismo ID y contenido |

Límites iniciales en `backend/config/control_acceso.php`: cuerpo total 1 MiB,
estado 16 KiB, 100 respuestas/lote, 512 KiB decodificados/respuesta y 2000 filas
interpretadas/lote. La ruta aplica además 120 peticiones/minuto por la identidad
de limitación estándar de Laravel (en estas rutas sin usuario humano, IP/dominio).
Revisar capacidad/retención antes de operación continua; no hay purga automática.

## Evidencia local y pendientes

`backend/tests/Feature/ControlAccessIngestionTest.php` usa exclusivamente SQLite
en memoria con la nueva migración, fixtures ficticios y fallos simulados.
17 pruebas / 128 aserciones aprobadas: credenciales, separación humana, revocación
entre middleware/transacción, validación, bytes/hash, 255, tiempos, multiplicidad,
reintentos, conflictos, límites, rollback y administración por consola.

Suite completa: 32 pruebas, 180 aserciones, 31 aprobadas y un fallo ajeno.
`Tests\Feature\ExampleTest` espera 200
en `/`, pero `routes/web.php` ya está vacío en HEAD por arquitectura headless (404).
Validación MySQL posterior completada: 24 pruebas / 186 aserciones aprobadas en
MySQL 8.4.13 aislado, incluidos procesos simultáneos, bloqueo real InnoDB, migración
reversible, claves foráneas y precisión de fechas. Instancia detenida al terminar.
Evidencia y repetición en [control-acceso-ensayo-mysql.md](control-acceso-ensayo-mysql.md).
La suite habitual se ejecutó con `--exclude-group=mysql-ensayo`, conservando el
resultado anterior. Emisor/outbox posteriormente preparado y probado localmente
(23 pruebas); ver [emisor local](control-acceso-emisor-local.md). Validación en Dell
y coordinador pendientes; no se han instalado
componentes en caseta ni ejecutado migraciones sobre bases existentes. Este ensayo
no certifica configuración del servidor de producción ni despliegue.
