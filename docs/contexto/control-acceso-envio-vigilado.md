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
