# Control de acceso: emisor vigilado candidato

2026-10-25. Usuario autoriza continuar con envio automatico/vigilancia y agregar
y ejecutar pruebas aisladas. No es instalacion permanente ni deploy.

## Estado de partida

Ultima evidencia real: polling PID15600 desde18:28:46Z, dos ciclos correctos
12:28:49/12:29:53 Mexico, tercero en curso18:30:53Z, errores0. Parada de ensayo
por boton y dos cierres comprobados. Almacen real228respuestas/84mensajes acked
y1pendiente. Esta etapa no captura SDK ni renueva esa evidencia por simular.
API conserva autoridad unica de vigencias; no se cambian reglas/fechas.

## Implementacion y limites

- bucle_envio.py reutiliza Delivery/Outbox/Sender publicados. Agrupa una tanda
  por vuelta, Sender.once, limite5..180s, espera0.5s (hasta120intentos/minuto),
  HTTP timeout5s por IO. Conserva UUID/cuerpos, lease60s, backoff y pausas.
  No resume bloqueados ni borra originales/ACK. Verifica originales y cuerpos
  existentes antes/despues; informe incluye totales ACK y manifiesto.
- envio_vigilado.py: padre supervisor y un hijo HTTP sin SDK/Access. Destino
  fijo127.0.0.1:18881 por tunel a backend aislado. Credencial DPAPI existente
  solo se descifra en hijo; no por argumentos/entorno/salida. Filtra SANISIDRO_*.
  Usa base existente de c8d7ccdc-991f-497c-8383-92fb52921f8a/CO2K225060027,
  sin inicializar base faltante ni reetiquetar identidad.
- Canal stdin propio con handshake PID/run_id y EOF. Hijo tiene limite
  monotono; EOF del padre solicita salida tras llamada en curso. Padre recoge
  salida/recibo ligados a PID/run_id/codigo/reporte. Espera15s al finalizar;
  solo SU hijo HTTP puede ser terminado si excede plazo, con fault registrado.
  No mata polling/SDK/tareas ni toca sync.lock. Si padre muere fuera de finally,
  EOF se observa entre llamadas; no garantizar parada instantanea ante IO
  bloqueado ni confundir timeout por IO con deadline total de respuesta.
- Mutex durante supervisor, no otros emisores/versiones/envio manual. Leases
  persistentes y ACK idempotentes cubren reintentos; no borrar para acelerar.
- vigilancia_envio.py separa identidad/frescura del emisor, cola/pausa/ACK y
  vigencias. Cola vacia sin ACK nuevo no certifica conectividad. Parada acotada
  esperada se muestra detenido; fallo de cierre/propietario queda degradado.
- Padre observa cada10s con health del enlace2 congelado: tareas/CIM, estado
  real de polling/lector/cola. CIM puede demorar25s; no bloquea polling instalado
  ni hijo HTTP. Plazo total puede exceder ventana por observacion y cierre.
  No reemplaza vigilancia instalada ni agrega popup/EventLog/tarea.
- Evidencia propia en datos/sesiones/UUID: request/sender/closed/vigilancia/
  resultado JSON. Estado/stop del supervisor propios, separados de r2/SDK.
  Limite64MiB de sesiones y reserva64MiB; sin borrado automatico.

Ocho fuentes runtime son bytes de ZIP publicados: bibliotecas del coordinador1,
helper de entrega1, enlace/control/salud de enlace2. Ningun SDK/DLL/credencial.
Se usa health del enlace como funcion, no CLI/botones/verificador. Detector
anterior de botones no conoce estos procesos: terminar este ensayo antes de
usar controles del enlace durante primera aceptacion. No se modifica ZIP previo.

## Verificacion local

33pruebas nuevas aprobadas en4.615s: ACK/idle, offline/reintentos identicos,
ACK invalido/pausa, parada propia, original alterado, error de persistencia,
capturas concurrentes, identidad/frescura/cola del emisor, vigencias vencidas
no ocultadas, EOF del padre, recibo ausente/identidad incorrecta, mutex temporal,
timeout con terminacion exclusiva del hijo propio, error/KeyboardInterrupt del
padre, credencial ficticia fallida y destino ajeno rechazado antes de HTTP.
Para33casos: SQLite/locks temporales y Python ficticios propios; transporte,
DPAPI y tareas sustituidos. Sin SDK/red/Access/DPAPI/tareas reales.

Suite completa175aprobadas en45.049s, fuera del sandbox por Laravel loopback
de pruebas anteriores. Estas incluyen DPAPI con datos ficticios; ninguna caseta,
API de produccion, Access o credencial reales. Sintaxis/rutas/hashes correctos.
Desde ZIP extraido: simulation_ok,33tests, fallos/errores/omisiones0,
ended_utc2026-10-25T19:03:41.291918+00:00. Envio real en Dell no ejecutado aun.

## Paquete y siguientes pasos

Envio_Vigilado_2026.10.25-1.zip:16archivos,39120bytes, SHA256
a70d81fa6b2e594bce3e8d1c5143381f40453b89179a21e26b3d924935fcd1eb.
Guia: tools/agente_acceso/LEEME_ENVIO_VIGILADO.md. Destino nuevo Dell
C:\SanIsidro\EnvioVigilado_20261025. Primero verificar y simular con Python32,
sin mantenimiento/SDK/SSH/tareas reales. Simulacion Dell pendiente; no indicar
--ensayo antes de revisar resultado.

Despues, servidor/tunel de ensayo activos, --ensayo --seconds120 con polling
funcionando. Confirmar ACK del pendiente, originales/cuerpos conservados, cierre
y salud separada. worker_exit_code0 no equivale a cero pendientes si hubo retry.
--detener solicita al supervisor por PID/run_id; no acredita fin de proceso.

Pendientes: simulacion/ensayo Dell, vigilancia independiente con alertas (aqui
solo diagnostico durante ensayo), servicio permanente, integracion SDK y botones,
retencion/reconciliacion, rollback y transicion autorizada. Sin push/deploy,
pantalla web o endpoints nuevos. Ultimo pendiente real sigue sin ACK aportado.

## Simulacion aprobada en Dell — 2026-10-25

Usuario verifica Envio Vigilado2026.10.25-1 y ejecuta simular_envio.py con
Python32 instalado. Resultado simulation_ok,33tests, failures0/errors0/skipped0,
scope emisor_y_vigilancia_ficticios_sin_sdk_red_dpapi_access_tareas,
ended_utc2026-10-25T19:42:27.583715+00:00 (13:42:27 Mexico). Evidencia:
C:\SanIsidro\EnvioVigilado_20261025\registros\simulacion_envio_20261025_134227_582777.json.

Confirma los33casos sobre fixtures y trabajadores ficticios en runtime Dell;
no hubo SDK/red/DPAPI/Access/tareas reales ni se renueva salud de polling por
esta salida. Siguiente: comprobar servidor/tunel del ensayo y ejecutar envio
real acotado120s con polling activo, sin mantenimiento. Confirmar ACK del
pendiente, cierre de hijo y originales preservados. Servidor/tunel disponibles,
nuevo ACK y resultado real del supervisor todavia pendientes.

Comprobacion previa de red aportada despues por usuario: Invoke-RestMethod a
http://127.0.0.1:18881/salud falla con WebException/UnableToConnect. Solo acredita
ruta local del ensayo no disponible en ese momento; no distingue tunel ausente
de servidor detenido ni fallo de Internet. No se ha iniciado --ensayo nuevo,
no hay nuevo intento/ACK del pendiente acreditado. Reabrir/usar servidor privado
127.0.0.1:18880 y tunel18881, verificar salud y despues ejecutar emisor120s.
Sin mantenimiento, SDK, cambios de polling o produccion para restablecer ruta.

## Ensayo1: cola vacia, finalizacion con PermissionError — 2026-10-25

Salud por tunel restablecida: ensayo_listo/TEST-C3-001 es marcador estatico del
laboratorio, no serial del agente emisor. Usuario ejecuta --ensayo120s. Padre
PID5948/run_idf6fd9070-20d2-49ee-847d-a2614fbb033d, hijo712, ended_utc
2026-10-25T19:47:32.320805+00:00 (13:47:32 Mexico). phase fault, exit_code1,
worker_closure_confirmed false, forced_own_sender_exit false,
supervisor_error_type null, sender_report null. Proceso hijo termino por error;
no atribuir ausencia de cierre confirmado a proceso vivo o trabajador SDK.

Observacion real a19:47:27.893954Z: vigencias correcto, tareas Vigencias y
Vigilancia Running/enabled true, read_errors vacio, vigilancia instalada intacta.
Ensayo SDK10540 anterior permanece stopped sin errores. Cola228respuestas,
85mensajes acked,0pendientes/0sin lote/paused false: aumento de1confirmado frente
a84anteriores. No hay manifiesto nuevo ni totales/ACK individual impresos para
certificar nuevamente integridad o recepcion por inspeccion SQL independiente.
No confundir entrega observada con aprobacion del ensayo de cierre.

Archivos sender.json y closed.json aportados despues: phase fault,
error_type PermissionError, heartbeat19:47:31.995481Z, identidad712/mismo run_id,
exit_code1. No codigo winerror/errno, etapa o stack en version1. Evidencia:
C:\SanIsidro\EnvioVigilado_20261025\datos\sesiones\f6fd9070-20d2-49ee-847d-a2614fbb033d.
No modificar ni borrar sesion, base, credencial o ZIP1. Polling sigue separado;
no se ha confirmado cierre de ventanas del servidor/tunel despues del ensayo.

## Colision de snapshot corregida en candidato2 — 2026-10-25

Reproduccion local determinista: mantener lectura abierta de snapshot.json y
llamar save produce PermissionError WinError5 en os.replace. En Windows, lector
sin FILE_SHARE_DELETE impide sustituir archivo mientras permanece abierto.
Ruta del candidato compatible con incidente: padre lee sender.json mientras
hijo lo reemplaza cada vuelta. Recibo remoto carece de etapa/codigo, por tanto
no certificar que esta sea la unica causa de PermissionError en Dell ni cambiar
permisos globales/reinstalar SDK basandose solo en tipo de excepcion.

save ahora reintenta SOLO os.replace21veces con20esperas50ms (maximo1s).
No reintenta HTTP, ACK o transacciones por este evento. Si persiste error,
conserva destino anterior, intenta limpiar solo su temporal y eleva excepcion.
Marca operacion/rol del snapshot en error; worker agrega etapa/errno/winerror
sin ruta, mensaje arbitrario o secretos. Padre muestra worker_error vinculado
a identidad del recibo incluso cuando ensayo fault; no oculta salida1 ni da
cierre confirmado a un fallo. No cambios en cola, biblioteca Sender o SDK.

Cuatro casos agregados a33previos: reproduccion de lectura/reemplazo y
recuperacion tras liberacion, permiso persistente acotado/destino intacto,
diagnostico filtrado y salida real del canal del hijo con stdin del padre aun
abierto. Este ultimo paso sin errores ya con codigo previo: no atribuirle otra
causa ni afirmar parche de canal. Primer caso fallo antes del parche con
WinError5, ahora37pruebas aprobadas en5.632s. Suite completa179aprobadas
en25.698s, fuera del sandbox por Laravel loopback previo; mismas restricciones
sin caseta/Access/SDK/produccion. Nuevos37casos sin red/DPAPI/tareas reales.

ZIP2 extraido y verificado: simulation_ok,37tests/failures0/errors0/skipped0,
ended_utc2026-10-25T19:54:30.113698+00:00. Sintaxis/rutas/hashes verificados.
Envio_Vigilado_2026.10.25-2.zip:16archivos,40835bytes, SHA256
03b415a4e7aba6941d4eac219c4f986f863dbe8c1af1553591b9e611219f226b.
ZIP1 conserva a70d81fa6b2e594bce3e8d1c5143381f40453b89179a21e26b3d924935fcd1eb.
Destino Dell nuevo C:\SanIsidro\EnvioVigilado_20261025_r2, misma outbox/DPAPI
originales. Primero verificar/simular ZIP2 sin mantenimiento/SSH; salida Dell2
y siguiente ensayo real aun pendientes. Ultima cola real0pendientes; repetir
ensayo no requiere crear eventos nuevos ni releer SDK.
