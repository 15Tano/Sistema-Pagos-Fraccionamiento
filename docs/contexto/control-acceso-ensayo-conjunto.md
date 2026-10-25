# Control de acceso: ensayo conjunto

2026-10-25. Usuario indica continuar tras aceptar emisor2 separado. Candidato
manual readonly y HTTP aislado, no instalacion permanente, aplicar o deploy.

## Implementacion preparada

- ensayo_conjunto.py/coordinacion_conjunta.py supervisan lector x64/SDK32 y
  emisor32/HTTP en procesos propios. Misma DLL32 instalada, outbox/identidad y
  credenciales actuales. API sigue unica autoridad de vigencias.
- lector/ y envio/ contienen completos/intactos los paquetes cierres1 y envio2.
  lector_conjunto.py verifica fuentes y adapta en memoria SOLO atomic_json del
  entrypoint readonly al escritor con reintento1s de envio2, para observacion
  concurrente de estado. Delega al manual que compara apply=False. No modificar
  archivo publicado, llamadas DLL ni formato. Launcher x64 usa DPAPI existente,
  limpia BSTR/entorno; password no pasa por argumentos/padre supervisor.
- PID/run_id/fecha/CIM de ruta exacta vinculan al lector; PID del Popen y UUID
  al emisor. Viejo estado/argumento incidental python -c no confirman arranque.
- Parada: cerrar lector cooperativamente sin kill desde supervisor conjunto;
  luego hasta15s para cola HTTP y cierre de emisor/su hijo. Red/pausa/fallo de
  emisor ya iniciado no cancela comparacion; fallo de arranque/persistencia de
  control aborta conservadoramente este ensayo. No autorreinicios ni otro SDK.
- Recibos/lock se verifican despues de terminar ambos. Solo watchdog r2 con
  ruta/SHA exactos conocidos se exceptua del detector de lectores; desconocidos
  o PID reutilizado bloquean. Cierre SDK no confirmado persiste marca global y
  revision conjunta. Ejecucion incompleta bloquea nuevo arranque, sin force.
- Ventana5..150s, emisor180s, CIM25s y llamada inventario300s pueden extender
  tiempo real. No prometer plazo estricto ni cero perdida. No matar SDK por
  exceder plazo; fuente SDK mantiene tratamiento de cierre inseguro anterior.
- Estado propio por sesion y stop/UUID del conjunto; SDK conserva estado/stop/
  ledger/originales anteriores. Se distinguen cierres, reader_ok/sender_ok,
  delivery_complete y trial_passed. Pendientes no implican cierre inseguro.
  Resumen final valida originales/cuerpos/ACK sin SDK. Probe readonly y exito
  HTTP nunca renuevan last_ok del polling observado.
- --verificar-cierre vuelve a comprobar ausencia de PIDs/lectores, ledger de
  esta ejecucion, recibo HTTP y lock bajo mantenimiento. Reanudacion sigue
  manual por gestor instalado, dos ciclos nuevos al final. No botones enlace2
  para este nombre/ruta nuevo. No borrar marcadores ni eludir revision.

## Pruebas y paquete

30pruebas nuevas en1.645s: orden/parada/drenaje, fallos, sin matar SDK,
identidades viejas/futuras, env filtrado, recibos y cambios de estado, watchdog
con bytes correctos, verificacion final/PID reutilizado y adaptador readonly.
Incluyen dos Python ficticios propios sobre outbox WAL real con dos respuestas
y dos mensajes acked por transporte simulado. SDK/CIM/tareas/DPAPI sustituidos,
sin red/Access/SDK reales. No prueba de DLL ni de botones reales del gestor.
Suite completa209aprobadas en35.542s;208previas en35.216s antes de agregar
caso final de verificacion. Fuera de sandbox por Laravel HTTP local y DPAPI con
datos ficticios de pruebas anteriores, sin caseta o produccion.

Sintaxis Python/PowerShell, rutas/manifiestos/hashes verificados. ZIP extraido:
simulation_ok,30tests/failures0/errors0/skipped0, ended_utc
2026-10-25T20:33:05.804567+00:00. Ensayo_Conjunto_2026.10.25-1.zip,
45archivos (44fuentes/datos+manifiesto),113101bytes, SHA256
380668a70b2a8f83696e70f0e58286b145e5eaf6aeb25a3e5af9a844fba3d910.
Comparados todos los bytes de paquetes incorporados con ZIP originales:
cierres1 SHA62afc55c986178e8086035fa978c7d2241f715296f359cc02997db7698819a11,
envio2 SHA03b415a4e7aba6941d4eac219c4f986f863dbe8c1af1553591b9e611219f226b.

## Pendiente inmediato

Destino Dell C:\SanIsidro\EnsayoConjunto_20261025. Verificacion y simulacion
Dell aprobadas por salida del usuario el 2026-10-25: simulation_ok, 30 pruebas,
failures=0/errors=0/skipped=0, ended_utc=2026-10-25T21:10:49.868446+00:00.
Evidencia remota: registros\simulacion_conjunto_20261025_151049_867840.json.
Sin SDK/red/DPAPI/Access/tareas reales; no acredita lectura conjunta real ni
renueva salud del polling. Pendiente comprobar salud del tunel18881 antes de
pausar, luego ensayo real conjunto. Coordinar pausa con gestor instalado,
cerrar ZKAccess/otros emisores/paneles, servidor/tunel activos y ensayo150s.
FIN conjunto, verificacion y dos ciclos r2 tras reanudar. Guia exacta:
tools/agente_acceso/LEEME_CONJUNTO.md. Simulacion revisada; la prueba real
queda pendiente de salida del usuario. No tag fisico ni bibliotecas nuevas.

Ultima salud real sigue emisor2 a20:00:34Z:228respuestas/85acked/0pendientes,
originales conservados, vigencias correcto. Pruebas locales no la renuevan.
Servicio operativo/aplicar, vigilancia continua con alertas, retencion,
reconciliacion, rollback y transicion autorizada pendientes. Sin pantalla web,
endpoints nuevos ni push/deploy por preparar el ensayo.

## Primer intento real bloqueado — 2026-10-25

Usuario confirma /salud por tunel18881: ensayo_listo/TEST-C3-001. Despues
ejecuta --mantenimiento --seconds150; unica salida aportada:
CONJUNTO NO CONFIRMADO: RuntimeError. Conservar mantenimiento/evidencia.
No aparece anuncio CONJUNTO SOLO LECTURA ni resultado/sesion; codigo revisado
situa el anuncio antes de crear hijos. Causa exacta pendiente: el manejador
general solo imprime tipo. Solicitar lecturas de mantenimiento/tarea, almacen,
estado SDK previo y marcadores conjuntos. No repetir ensayo ni borrar marcas
o reanudar hasta determinar estado. No atribuir a DLL, tunel o credenciales.
Simulacion Dell sigue aprobada; ejecucion conjunta real no validada.

Salida posterior del usuario confirma SanIsidro-Vigencias Running/Enabled=true
y mantenimiento.active=false. Esto satisface la condicion exacta de rechazo
RuntimeError en maintenance_guard, antes de iniciar hijos SDK/HTTP. No corregir
paquete ni eludir guard: preparar mantenimiento desde gestor instalado y
comprobar tarea Disabled/Enabled=false, active=true y polling stopped antes
de reintentar. Salida de objetos PowerShell posteriores no visible: el primer
tipo tabular puede ocultar propiedades distintas; pedir Format-List por lectura.
Revision/cierre inseguro y estado SDK previo no se acreditan con esa salida.

Pausa posterior confirmada por usuario: tarea Disabled/Enabled=false,
mantenimiento.active=true, started=2026-10-25T15:22:41.7000562-06:00,
wasEnabled=true; estado polling PID15600, phase=stopped,
consecutive_errors=0. Se indica reintento conjunto150s manteniendo servidor/
tunel, seguido de --verificar-cierre. Resultado real y retorno a r2 pendientes.

## Ensayo conjunto real aprobado — 2026-10-25

Salida completa aportada por usuario en adjunto f547de3a-88a5-43c2-bee1-e1587d9bb50a:
phase=stopped, trial_passed/reader_ok/sender_ok/delivery_complete=true,
orchestration_error_type=null y safe_to_resume_candidate=true. Padre PID14316,
run_id=4a3c1d44-0cec-46a9-af52-9903d60b673a; ended_utc
2026-10-25T21:26:27.867919+00:00. Evidencia Dell:
C:\SanIsidro\EnsayoConjunto_20261025\datos\sesiones\4a3c1d44-0cec-46a9-af52-9903d60b673a.

SDK PID7112/run290a541f-9e13-4cce-a65a-17c9c3cd03e7, launcher9636,
started_utc21:23:49.172851Z; 3 ciclos readonly, errores consecutivos/totales0,
ultimo completado21:26:11.063796Z. reader_error/storage_error=null, gate sin
fault/active; salida0 y cierre confirmado, recibos acumulados14 (antes8).
stop_reason=requested corresponde a parada cooperativa del supervisor.

Emisor PID5112/runa942d826-6c2d-43c6-b839-c79a68106d6f, hijo15324,
salidas0/cierre confirmado, sin terminacion forzada ni errores; fin21:26:19.026499Z.
outcomes acked77/idle114; ultimo ACK21:26:12.101140Z. Agente/serial real
previo conservado. Total162acked (20estados/142lotes), 300respuestas/filas:
207eventos/93estados, interpretacion pendiente0. Frente a228/85 previos:
+72respuestas (+50eventos/+22estados), +77mensajes (+5estados/+72lotes).
Pendientes0, unbatched0, pausa vacia. Originales228anteriores preservados,
existing_messages_unchanged=true; 300originales y cuerpos162 hashes verificados.
Nuevo manifiesto original:
5afb571cd792b0772729284d932530a19af166a8d1f4c4845f5edc243348be46.
Son ACK/reportes del ensayo, no inspeccion SQL remota independiente, certificacion
de frescura, historial completo ni conteo de vehiculos.

Vigilancia observada21:26:18.550774Z: mantenimiento, Vigencias Disabled/false,
Vigilancia Ready/true, read_errors=[], watchdog instalado sin reemplazar.
Polling PID15600 permanecio stopped, last_ok21:22:04.488970Z sin renovarse por
el ensayo. --verificar-cierre aun NO aportado: ejecutar antes de Terminar y
reanudar por gestor instalado y comprobar dos ciclos nuevos. No confundir
safe_to_resume_candidate del resultado con esa comprobacion posterior.
Sin despliegue ni servicio permanente; aceptacion conjunta acotada validada.

## Cierre final y retorno a r2 confirmados — 2026-10-25

Usuario ejecuta --verificar-cierre: cierre_conjunto_confirmado para padre14316/
run4a3c1d44-0cec-46a9-af52-9903d60b673a a21:28:45.162974Z. Despues del
gestor: tarea SanIsidro-Vigencias Running/Enabled=true, protocol2, nuevo
PID12648/run_started21:29:15.343791Z, phase=idle, consecutive_errors=0,
last_error_type=null, last_ok21:30:22.584663Z. Dos ciclos nuevos correctos:
15:29:19.174 y15:30:22.586 Mexico, ambos API838/cambios Access0/C30,
no encontrados4 y ausentes API sin cambios116. Parada anterior15:22:42.063.
Se cierra aceptacion del ensayo conjunto readonly y retorno al polling.
No es instalacion de recolector/emisor permanentes; no afirmar que siguen
leyendo/enviando tras FIN. No hubo nueva evidencia de watchdog al reanudar
ni cierre de ventanas servidor/tunel; conservar originales, ACK y laboratorio.
