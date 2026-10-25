# Control de acceso: coordinador de ensayo

2026-10-24. Usuario autoriza siguiente etapa tras validar capturas fisicas y
entrega ficticia Dell -> Laravel aislado. Preparacion local, sin sustituir polling,
gestor, vigilancia, DLL ni tareas. No hay push/despliegue de esta etapa.

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
