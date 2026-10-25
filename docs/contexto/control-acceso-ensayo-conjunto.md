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
