# Control de acceso: integracion operativa propuesta

2026-10-24. Diseno preparado tras la indicacion del usuario de continuar con
gestor y vigilancia. No es una version implementada ni una autorizacion para
reemplazar archivos/tareas de caseta o desplegar el backend a produccion.

## Punto de partida verificado

- Coordinador readonly: lectura real, parada solicitada, reapertura acotada y
  cierre normal comprobados. Polling r2 reanudado tras cada prueba.
- Ultima reanudacion aportada: PID2640, tarea Running, errores0, tres ciclos
  correctos22:01:09,22:02:13 y22:03:17 Mexico del24octubre.
- 149 respuestas entregadas al backend aislado por 53 mensajes, cero pendientes,
  originales conservados, segundo envio idle. Ver documento de coordinador.
- Gestor/vigilancia instalados no han sido sustituidos en estas pruebas.
- Fuentes locales de tools/zkaccess y tools/gestion_tags son trabajo existente
  sin seguimiento Git. No modificarlas ni agregarlas masivamente para esta etapa.

## Hallazgos en codigo real

| Componente | Comportamiento observado en fuentes | Consecuencia |
| --- | --- | --- |
| mantenimiento.ps1 | Busca ruta ZKSync/sincronizar_vigencias.py y argumento --continuo; pausa tarea, solicita parada protocol2 y espera salida | Otro nombre/ruta de entrada no es compatible automaticamente |
| mantenimiento.ps1 reanudar | Confirma proceso encontrado en25s, no un ciclo correcto ni que adquirio el lock | Hace falta comprobar arranque y bloqueo antes de anunciar reanudacion |
| sync_runtime.py | detener.sync.json ligado solo a PID; sync.lock retenido por proceso | Mantener lock; incorporar run_id para nueva version y compatibilidad explicita con r2 |
| vigilar_sync.py | Comprueba heartbeat y last_ok de vigencias por separado;5min por defecto, repeticion15min; tarea Disabled se trata como mantenimiento | RT o envio exitosos no deben actualizar last_ok de vigencias |
| vigilancia actual | Solo evalua salud de vigencias; no lee outbox/lector | Se necesita salud separada para lecturas y envio, sin convertirla en exito/fallo del ciclo de fechas |
| iniciar_oculto.ps1 | Ejecuta pythonw x64 con entrypoint actual --aplicar --continuo, espera salida y usa DPAPI instalada | Conservar contrato de lanzamiento y comportamiento oculto |
| referencia_r2/sincronizar_vigencias.py worker | subprocess.run con timeout300; timeout/error se propaga como excepcion normal | El coordinador debe distinguir cierre SDK inseguro antes de permitir otra conexion |
| referencia_vigencias.py | Invoca cycle(password,False,None), sin habilitar escritura | El ensayo readonly no es aun un sustituto del polling operativo |

Los hallazgos describen fuentes inspeccionadas, no certifican que todos sus bytes
coincidan hoy con los instalados. Cuatro fuentes r2 si fueron verificadas por el
lanzador durante los ensayos. Falta lectura actual de vigilancia, configuracion,
tareas y hashes del monitor/gestor/lanzador en Dell.

Hashes SHA256 de las fuentes locales inspeccionadas, para comparar con inventario
de Dell (no prueban por si solos instalacion remota):

| Fuente | SHA256 |
| --- | --- |
| vigilar_sync.py | 204fc781b9d632c0decc7e11122ebcf6b9d1729191467e26d3ce67ebfcc4c1cd |
| iniciar_oculto.ps1 | d63567bfc5259d78505f8ffcc9e1a07c5b46b32c84ea6c49444409d08bdbbc92 |
| mantenimiento.ps1 | 840c500933e644fb9545c88091a287416a018b7c3e16434d634138531b97b4f4 |

## Diseno para revisar antes de implementar

### Una entrada compatible y un unico propietario del SDK

Conservar tarea SanIsidro-Vigencias y punto de entrada
C:/SanIsidro/ZKSync/sincronizar_vigencias.py --aplicar --continuo en el futuro
paquete operativo. Ese punto delegaria al coordinador conservando PID principal,
credenciales DPAPI, archivos de control y la toma de sync.lock durante su vida.
No instalar otro lector SDK permanente junto al polling anterior.

El coordinador alternaria ciclo de vigencias y RT. Primero cerrar y confirmar
salida del trabajador RT; despues permitir el trabajador del ciclo de vigencias.
El ciclo usaria la misma API, reglas, respaldos y verificacion r2: solo fechas e
indicador de validez, conservar ausentes API. Una comparacion readonly tiene
salud propia y nunca cuenta como aplicacion correcta de vigencias.

Antes de habilitar esta delegacion, envolver la ejecucion del trabajador de
vigencias para que timeout, terminacion forzada o salida no confirmada se eleven
como cierre inseguro y detengan nuevos clientes SDK. No basta con capturar la
excepcion del ciclo y seguir leyendo RT. Esto no corrige ni reemplaza fuentes
congeladas de un ZIP publicado: requiere nuevo adaptador/paquete revisado.

### Envio separado del turno SDK

Un emisor propio, sin SDK ni Access, compartiria la outbox con leases existentes
y esperas progresivas. HTTP no debe bloquear el siguiente ciclo de vigencias ni
la parada del lector. El coordinador debe registrar/gestionar ese proceso propio
y su cierre, con plazo y diagnostico separados; sin procesos huerfanos.
Inicialmente seguir usando el backend aislado; no configurar envio automatico
a produccion ni depender del tunel SSH como transporte definitivo.

### Protocolo para mantenimiento

Mantener Preparar mantenimiento y Terminar y reanudar como botones del gestor.
Para la nueva version: identificar PID + run_id y ruta admitida; deshabilitar la
tarea; solicitar parada; dejar terminar operacion en curso; persistir lo recibido;
confirmar cierre de trabajadores y liberacion del bloqueo. Solo entonces permitir
consultas/escrituras del gestor. No borrar locks ni usar un fallo de arranque
por lock ocupado como mecanismo de exclusion.

Si hay revision pendiente o cierre inseguro, conservar mantenimiento y evidencia.
Reanudar valida proceso/ejecucion nuevos y arranque con lock adquirido, antes de
cerrar el registro de mantenimiento. La aceptacion operativa sigue exigiendo dos
ciclos correctos nuevos. Compatibilidad con r2 sin run_id debe ser explicita:
no inferir compatibilidad de un estado incompleto o de un PID aislado.

### Salud y vigilancia

Conservar estado protocol2 de vigencias con phase starting/cycle/idle/stopped,
PID y fechas existentes; incorporar run_id como extension para control nuevo.
Solo el ciclo operativo correcto actualiza last_ok_utc y reinicia sus errores.
Publicar salud de lector/outbox/emisor en archivo separado, con fecha propia,
alcance y modo readonly/operativo. Un snapshot observado no reemplaza al estado
del proceso que ejecuta vigencias.

Mantener vigilancia independiente: actividad reciente y ciclo correcto reciente
se evaluan por separado. Conservar umbrales actuales hasta comprobar configuracion
real: referencia local5min/15min y ventana20s solo ante alerta. Agregar diagnostico
de lectura/envio degradados sin ocultar una falla de vigencias ni reiniciar
automaticamente el controlador. La reanudacion no debe borrar silenciosamente
errores o pendientes. Evaluar mantenimiento por tarea y registro coherentes;
estado ausente/invalido debe quedar explicito, no anunciar correcto por RT255.

## Entregas y aceptacion

1. Obtener inventario readonly de tareas/configuracion/estado de vigilancia y
   hashes de monitor, mantenimiento y lanzador actuales. Sin mantenimiento.
2. Preparar componentes candidatos en carpeta separada, sin modificar r2, gestor
   o ZIP instalados. Revisar contrato de arranque/parada, excepcion de cierre SDK
   inseguro y evaluacion separada de salud. Ensayo sin SDK/tareas de produccion.
3. Prueba acotada de compatibilidad en Dell, con pausa/reanudacion coordinadas,
   evidencia de lock, procesos propios cerrados y dos ciclos nuevos al regresar.
   Probar recuperacion tras interrupcion sobre copias/datos de ensayo; no provocar
   una caida con escritura real en Access/C3 para comprobar ese caso.
4. Comparar resultado de vigencias candidato con r2 y ensayar respaldo/rollback.
   Persistencia, retencion/capacidad, cierre inseguro y limites de reconciliacion
   deben resolverse antes de habilitar un servicio permanente. No prometer
   historial completo por haber reenviado mensajes locales.
5. Presentar paquete concreto y obtener confirmacion antes de transicion de
   caseta. Backend sigue su flujo Git/deploy autorizado por separado. Mantener
   outbox/originales y ACK en cualquier rollback, sin reetiquetar identidad.

## Inventario inmediato solicitado

PowerShell de Dell, sin pausa ni SDK. Compartir salidas sin credenciales:

```powershell
Get-ScheduledTask -TaskName 'SanIsidro-Vigencias','SanIsidro-Vigilancia' | Select-Object TaskName,State,@{Name='Enabled';Expression={$_.Settings.Enabled}}
Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\vigilancia-config.json'
Get-Content -LiteralPath 'C:\SanIsidro\ZKSync\registros\vigilancia.json'
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\SanIsidro\ZKSync\vigilar_sync.py','C:\SanIsidro\ZKSync\iniciar_oculto.ps1','C:\SanIsidro\GestionTags\mantenimiento.ps1' | Format-List Path,Hash
```

Si falta un archivo/tarea, conservar ese error como evidencia; no instalar,
habilitar ni crear sustitutos para ocultarlo. Resultado de inventario pendiente.

## Inventario real confirmado — 2026-10-24

Usuario comparte SanIsidro-Vigencias Running/Enabled=True y SanIsidro-Vigilancia
Ready/Enabled=True. Configuracion real: minutes5, repeat_minutes15, popup true.
vigilancia.json: checked_utc=2026-10-25T04:18:26.433699+00:00,
enabled_since_utc=2026-10-25T04:01:27.344420+00:00, task_state Running,
status correcto, reason null. Esta muestra si acredita ejecucion reciente del
monitor y reporte correcto; no es prueba de su ventana de alerta o de una falla
provocada. Los tres hashes instalados coinciden exactamente con tabla local:
vigilar_sync.py, iniciar_oculto.ps1 y GestionTags/mantenimiento.ps1.

Inventario inmediato completo. Siguiente trabajo autorizado: preparar candidatos
separados para contrato de mantenimiento/vigilancia y cierre SDK, segun diseno;
instalacion permanente, modificacion de tareas y produccion siguen pendientes de
paquete concreto, ensayo y confirmacion. No se altero ninguna instalacion.

## Primera entrega candidata preparada — 2026-10-24

Tras la pregunta del usuario sobre el siguiente paso, preparados en
tools/agente_acceso, separados de fuentes/ZIP operativos:

- control_operativo.py: identidad PID/run_id y parada; r2 sin run_id requiere
  allow_legacy explicito. Checks de reanudacion exigen proceso/identidad nuevos,
  runtime operativo con mismo PID/run_id, lock adquirido y heartbeat reciente.
  Parada exige identidad objetivo, ausencia de proceso, cierre SDK y lock libre
  confirmados por el futuro adaptador. No comprueba esos hechos por si solo ni
  permite afirmar compatibilidad completa del gestor por incluir funciones.
- salud_operativa.py: evalua vigencias por actividad y ciclo correcto, con
  mantenimiento coherente con tarea; lector/envio separados por ejecucion/fecha.
  Componentes ausentes/ajenos/readonly quedan desconocidos. No escribe last_ok ni
  estado instalado. La evaluacion nueva aun no reemplaza el monitor actual.
- trabajador_controlado.py: SDKGate compartido en memoria y ejecucion de hijo
  propio; entorno sin SANISIDRO_*, timeout/salida no0/recibo invalido bloquean
  siguientes turnos. Exige verify_closed del adaptador. No incluye ese adaptador
  para r2, no modifica ReferenceProbe, no carga SDK al importar. El gate no
  sustituye sync.lock ni persiste su fallo; esas conexiones siguen pendientes.
- revisar_operacion.py: inspector readonly, comando que se pide ejecutar ahora.
  Verifica fuentes candidatas antes de importarlas, lee tareas/CIM locales, estado
  y configuracion/monitor/gestion y hashes conocidos. No lee DPAPI, Access, SQLite
  ni originales; no abre HTTP/SSH/SDK, no habilita ni detiene tareas. Solo guarda
  reporte filtrado bajo registros/ de la nueva carpeta. candidate_linked=false
  explicito; lectores/emisor desconocidos son esperables en instalacion r2.

Paquete final Integracion_Operativa_2026.10.24-2.zip, 7archivos, 11780bytes, SHA256
799fe9b4d8b4b423411f3cd946a03fade74719bd62d617e9b06a464814244844.
Borrador1 previo conservado en datos/borradores sin publicar/sustituir. Revision
estatica ajusta captura de now despues de leer archivos/CIM (evitar falso futuro
si el polling actualiza mientras se consulta), contador de fallos desde arranque
y ocultacion de stdout/stderr en representacion del recibo de trabajador.
Verificador/manifiesto correctos; analisis de sintaxis de5Python y1PowerShell
correcto, sin ejecutar componentes ni tareas. No se agregaron/ejecutaron nuevas
pruebas de comportamiento. No afirmar que gate, parada/reanudacion o evaluador
nuevos estan validados en ejecucion/hardware. El inspector real en Dell aun no
ejecutado. Detalles/comandos y limites en LEEME_OPERACION.md del paquete.

Siguiente: obtener reporte readonly de Dell; despues validar los contratos y
fallos con datos/procesos ficticios y preparar adaptadores/enlace. Esta entrega
no es un coordinador operativo, instalador ni parche de GestionTags/vigilar_sync;
no habilita aplicar ni servicio continuo. No se reemplazaron bibliotecas ni
paquetes publicados ni se hizo push/despliegue.

## Inspector candidato ejecutado en Dell — 2026-10-24

Usuario verifica paquete Integracion Operativa2026.10.24-2 y ejecuta inspector
con Python32. Scope readonly, checked_utc=2026-10-25T04:36:03.409940+00:00.
Tareas Vigencias Running/Enabled true y Vigilancia Ready/Enabled true. Un solo
polling_pids2640; vigencias phase idle, errores0, last_ok_utc
2026-10-25T04:35:07.221268+00:00 y heartbeat04:35:07.221288+00:00.
Evaluacion candidata de vigencias correcto/reason null. Watchdog observado
correcto a04:35:26.540568+00:00, antiguedad36.869372s, sample_recent true.
Configuracion5min/15min, popup true. Tres hashes instalados coinciden con
referencia; read_errors vacio. candidate_linked false.

Reader/sender desconocido, reason invalid_components. El inspector recibe estado
r2 sin run_id y sin archivo de componentes; ese motivo es generico por validacion
de identidad previa, no evidencia de corrupcion del almacen ni fallo del polling.
Mejora pendiente: distinguir ausencia/legacy de campos corruptos en diagnostico
del componente, en nueva version sin cambiar paquete2 publicado.

Evidencia Dell: C:\SanIsidro\IntegracionOperativa_20261024\registros\revision_20261024_223603_410909.json.
Verifica funcionamiento readonly del inspector y evaluacion sobre muestra real;
no prueba write_stop, pause_check/resume_check, gate ni recibos de cierre SDK.
Sin mantenimiento ni enlace a tareas/SDK. Siguiente etapa: validacion con
datos/procesos ficticios de contratos y errores, antes de enlazar adaptadores.
Instalacion permanente sigue pendiente de ensayo y confirmacion.

## Contratos ensayados localmente y paquete3 — 2026-10-24

Usuario indica Siguiente tras proponer pruebas locales con procesos ficticios.
Agregadas tests/test_operacion.py. Primera corrida28casos detecta6fallos de
asercion, sobre cinco problemas candidatos: reutilizar run_id al cambiar PID;
heartbeat ausente calificado correcto durante gracia; acoplamiento de errores
de formato entre reader/sender; pendientes0 con fecha pendiente aceptados;
motivos genericos para componentes ausentes/legacy. No afectan instalaciones:
son helpers candidatos no enlazados al polling/gestor real.

Corregidos control_operativo.py y salud_operativa.py; identidad anterior debe
confirmarse, run_id debe ser nuevo, transicion desde anterior r2 legacy requiere
allow_legacy_previous explicito y limite de frescura valido. Reader/sender se
evaluan por separado; heartbeat ausente nunca correcto y pendientes coherentes.
Agregados dos casos de identidad anterior/limites y transicion legacy explicita.
30casos nuevos aprobados en1.202s. Incluyen escritura atomica de stop solo en
temporales, peticion antigua, identidades, readonly/lock/cierre no confirmados,
estados stale/futuros, aislamiento de salud, gate en dos hilos, hijos Python
ficticios reales con timeout/salida no0/recibo rechazado, cierre y entorno sin
SANISIDRO_*. Inspector ejercitado sobre fixtures con tareas/procesos sustituidos;
no se consulta CIM real en estas pruebas.

Suite completa80pruebas aprobadas en23.378s (50anteriores+30nuevas), incluyendo
Laravel HTTP local y SQLite/DPAPI previos. Primera tentativa bajo sandbox no pudo
iniciar PHP loopback y se interrumpio; repetida fuera del sandbox con exito.
Sin C3, API de produccion, Access real, tareas ni datos de caseta. No acreditar
por estos casos lock real compartido, boton del gestor o recibo Disconnect de SDK:
esas garantias requieren adaptadores y prueba separada. Gate sigue en memoria.

simular_operacion.py ejecuta solo30casos del paquete, con verificacion previa de
fuentes, resumen JSON y detalle .txt en registros/ de su carpeta. Usa temporales
guardados en datos/pruebas_operacion y solo hijos ficticios propios, sin red,
SDK, Access, DPAPI o consultas de tareas. No requiere PHP ni credenciales en Dell.
Inspector readonly sigue como comando separado. Resultado local simulation_ok,
30tests, failures0/errors0/skipped0, repetido desde ZIP extraido con igual exito.

Integracion_Operativa_2026.10.24-3.zip:9archivos,19174bytes, SHA256
d27ef8346943fa0c6d7dab3469a6feed8d63597a198de5cc2e8b50ad377d98cf.
Manifiesto/verificador, rutas y fuentes comprobados; ZIP2 publicado mantiene
SHA799fe9b4d8b4b423411f3cd946a03fade74719bd62d617e9b06a464814244844.
Destino Dell nuevo C:\SanIsidro\IntegracionOperativa_20261024_r3. No sobrescribir
carpeta2 ni instalaciones. Pendiente simulacion con Python32 de Dell; siguiente
enlace de adaptadores/cierre SDK/gestor/vigilancia aun no implementado ni instalado.

## Simulacion de contratos aprobada en Dell/Python32 — 2026-10-24

Usuario verifica paquete Integracion Operativa2026.10.24-3 y ejecuta
simular_operacion.py con C:\Users\Dell\Python32\python.exe -B. Resultado
simulation_ok, scope contratos_y_procesos_ficticios_sin_sdk_red_access_tareas,
tests30, failures0, errors0, skipped0. ended_utc
2026-10-25T04:51:54.635090+00:00 (24octubre22:51:54 Mexico).
Evidencia: C:\SanIsidro\IntegracionOperativa_20261024_r3\registros\simulacion_20261024_225152_729945.json.

Confirma los30casos de contrato, salud y hijos Python ficticios en el runtime
x86 de Dell. No consulta SDK, tareas ni Access reales, no requiere mantenimiento
ni modifica polling, credenciales, outbox u originales. No es evidencia de
Disconnect real, bloqueo operativo entre procesos o boton del gestor integrado.
La ultima salud de caseta permanece la del inspector aportado antes; esta
simulacion no renueva sus timestamps.

Siguiente etapa: implementar adaptadores de cierre del trabajador de vigencias
y turnos RT, traduciendo cierre inseguro al fallo fatal del coordinador, con
identidad/recibo verificables; despues enlazar control con gestor y salud con
vigilancia en candidato separado. Primero validar localmente y preparar paquete
concreto antes de nueva lectura readonly acotada en mantenimiento. No sustituir
archivos instalados ni habilitar aplicar/servicio permanente en esta etapa.

## Adaptadores de cierre enlazados en candidato readonly — 2026-10-24

Usuario indica Siguele. Preparados adaptadores_cierre.py y ensayo_cierres.py,
lanzar_cierres.ps1, verificador/manifiesto, empaquetador, guia y21pruebas nuevas.
SafeReferenceProbe carga referencia r2 verificada e invoca cycle(password,False,None),
inyectando solo su worker readonly. El hijo SDK x86 usa load_sdk diagnosticado,
GetDeviceParam para serial y GetDeviceData user con argumentos conocidos; conserva
solo CardNo/Pin/StartTime/EndTime en respuesta, sin persistir Password/Group.
No SetDeviceData ni otra escritura al equipo. Fuentes r2 congeladas intactas.

SafeRTClient usa el worker RT existente, con envoltorio que emite recibo despues
de retornar de Disconnect/directorio. captura_rt.RTClient admite worker_command
opcional y filtra todo SANISIDRO_* del hijo; comportamiento por defecto permanece.
Gate compartido excluye turnos RT/vigencias. closed.json se vincula a PID/run_id/
UUID/rol/hash SDK y tiempos UTC PC, mas tamano/hash de respuesta cuando corresponde.
El padre confirma salida0, valida recibo y guarda parent_ack.json. Falta de ACK,
timeout, salida anormal, serial inesperado o cierre sin confirmar producen
UnsafeClosure fatal, no un error de ciclo que permita otro cliente SDK.
Error de datos con cierre confirmado se mantiene como comparacion fallida.

Ledger completo se comprueba antes de nueva conexion; request sin parent_ack
bloquea tras caida del padre, incluso con recibo del hijo. Marca cierre_inseguro.json
y estado fault impiden reinicio normal; no hay force/reset ni borrado automatico.
Los recibos acreditan ruta de cierre y salida de proceso, no estado interno de
firmware/red ni independencia de clientes externos. ZKAccess debe estar cerrado.
Gate sigue en memoria pero ledger/marca hacen persistente el bloqueo del ensayo.

Programa manual preparado: misma SQLite/identidad/originales de
C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento, no nueva base.
Agente c8d7ccdc-991f-497c-8383-92fb52921f8a y serial CO2K225060027 exigidos.
Estado nuevo estado_cierres.json y stop propio detener_cierres.json (PID/run_id),
sin cambiar estado/stop operativos ni estado.json del ensayo anterior. DPAPI Access
y token API opcional solo en padre x64, hijos filtrados. Sin HTTP de ingesta ni
servicio/aplicar; comparacion usa GET API existente y Access readonly. Preserva
sync.lock instalado, guardas de mantenimiento y hashes r2, plazo5..180s mas
operaciones/cierre (worker inventario300s). No ejecutar manual hasta simulacion
Dell aprobada y coordinacion del siguiente mantenimiento. Gestor actual sigue
sin reconocer este nombre/ruta: limite/parada propia antes de reanudar por gestor.

21pruebas nuevas aprobadas en3.896s; suite completa101 en15.609s (80anteriores+21),
con Laravel loopback temporal fuera del sandbox y sin C3/produccion/Access reales.
Ejercitan adaptadores, worker real con SDK sustituido, hijos Python ficticios,
serial, recibos alterados/incompletos, cierre/desconexion fallidos, gate ocupado,
caida antes de ACK, timeout fatal que impide RT y conservacion de originales.
Se corrigio limpieza de fixtures para no llamar communicate sobre pipes ya
cerrados por RTClient; ultima corrida sin excepciones de hilos. Simulacion desde
ZIP extraido: simulation_ok,21tests, fallos/errores/omisiones0.

Cierres_Coordinador_2026.10.24-1.zip,20archivos,50664bytes, SHA256
62afc55c986178e8086035fa978c7d2241f715296f359cc02997db7698819a11.
Manifiesto/rutas/hashes/fuentes comprobados y sintaxis Python/PowerShell valida,
sin ejecutar lanzador/DPAPI local. Verificacion desde arbol fuente sin runtime/
fallo por ese archivo empaquetado; verificador real correcto desde ZIP extraido
con runtime/lector_eventos.py incluido. ZIPs anteriores conservan sus hashes.
Destino Dell nuevo C:\SanIsidro\CierresCoordinador_20261024. Primero --simular con
Python32, sin mantenimiento. Simulacion Dell, SDK real de estos adaptadores y
reanudacion de ese ensayo pendientes. Enlace de botones gestor/vigilancia y
transicion operativa permanecen para etapas posteriores.

## Simulacion de adaptadores aprobada en Dell — 2026-10-25

Usuario verifica Cierres Coordinador2026.10.24-1 y ejecuta ensayo_cierres.py
--simular con Python32 instalado. Resultado simulation_ok, scope
adaptadores_ficticios_sin_sdk_red_access_tareas, tests21, failures0, errors0,
skipped0. Evidencia:
C:\SanIsidro\CierresCoordinador_20261024\registros\simulacion_cierres_20261025_002338_326174.json.
Fecha local segun nombre de evidencia25octubre00:23:38; resumen no aporta UTC.

Confirma casos de adaptadores/recibos sobre procesos ficticios en Dell x86.
No es prueba del SDK real ni renueva salud de polling/vigilancia. Siguiente
ensayo preparado:150s readonly con lanzar_cierres.ps1, mantenimiento confirmado
por gestor y ZKAccess cerrado, conservando outbox/originales anteriores. Exigir
cierre normal, phase stopped, gate fault false, comparaciones sin errores y
recibos confirmados; despues reanudar por gestor y verificar dos ciclos nuevos.
Ante cierre/identidad SDK sin confirmar o phase fault, revisar antes de reanudar.
Lectura real de estos adaptadores y su reanudacion todavia pendientes.

## Cierres con SDK real y retorno a r2 verificados — 2026-10-25

Salida aportada por usuario tras lanzar_cierres.ps1 -Seconds 150, paquete
Cierres Coordinador2026.10.24-1. PID5396, run_id
7e60c27f-54a6-4333-a815-0631e6beb164, inicio
2026-10-25T06:28:34.837254+00:00 (00:28:34 Mexico). Termina por limite,
phase stopped, tres comparaciones readonly completadas, errores consecutivos y
totales0, ultimo ciclo2026-10-25T06:30:58.277499+00:00. reader_error y
storage_error null; sdk_gate_fault false, active null y seis cierres confirmados
por el padre. Ultima lectura SDK06:31:03.984616Z, heartbeat final06:31:04.987154Z.
El Ctrl+C compartido aparece despues del retorno normal al prompt, no como
interrupcion de este ensayo. Los recibos acreditan ruta de cierre y salida de
los trabajadores segun validacion del padre; no estado interno del firmware ni
independencia de clientes externos.

Originales anteriores revisados149; responses228 al cierre (+79), mensajes
acked53/pending30, unbatched1, pending_count31, paused vacio. Primer pendiente
2026-10-25T06:28:42.904202+00:00. Son pendientes locales esperados sin envio HTTP;
las149 respuestas anteriores siguen como entrega previa confirmada, no afirmar
que las228 esten en el servidor. Esta salida no aporta nuevo manifiesto SHA ni
desglose de eventos/estados de las79 respuestas. Almacen de evidencia:
C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento,
estado_cierres.json, resultado_cierres.json y cierres/ con recibos/ACK del padre.
No se modificaron fuentes instaladas, tareas, SDK o vigencias por este ensayo.

Reanudacion confirmada con tarea SanIsidro-Vigencias Running, PID9544,
run_started_utc2026-10-25T06:31:52.156041+00:00, phase idle, errores0 y
last_ok_utc2026-10-25T06:34:02.896227+00:00. Tres ciclos nuevos correctos a
00:31:55.703,00:32:59.708 y00:34:02.897 Mexico; API838, cambios Access0/C3=0,
no encontrados4, ausentes API sin cambios116. La parada previa fue00:28:24.168.
Queda cerrada esta ventana de mantenimiento. Vigilancia no fue consultada en
esta salida; no actualizar su ultima comprobacion ni inferir nuevas alertas.

Pendiente inmediato: entregar las nuevas capturas con el emisor existente al
backend aislado y validar ACK, originales y segunda ejecucion idle, sin pausar
polling ni abrir SDK. Enlace real con botones del gestor/vigilancia, recuperacion
ante fallo real y transicion permanente siguen pendientes; no hay deploy nuevo.

Entrega posterior al backend aislado verificada por salidas del usuario,
2026-10-25:31mensajes nuevos confirmados;84acumulados,228respuestas/228filas
(157eventos/71estados), interpretacion pendiente0. Pendientes y sin lote0,
segundo envio idle1, originales/mensajes existentes sin cambios y hashes
verificados; manifiesto228originales
483c43bc939fdece659d2fd9e6d67974e19d5784f4fabbfc45f570744da4ee32.
Se cierra el pendiente inmediato de entrega anterior. No hubo mantenimiento,
SDK o deploy; no actualizar salud del polling por esta salida de emisor.
Siguiente pendiente de implementacion: enlazar control/estado del candidato
con gestor y vigilancia, preservando r2 instalado hasta transicion autorizada.
Detalle de ACK/evidencia y cierre de ventanas pendiente en ensayo-remoto.

## Panel/enlace candidato preparado, sin activar en caseta — 2026-10-25

Usuario indica seguir. Releidos mantenimiento.ps1, GestionTags.ps1,
vigilar_sync.py, runtime, contratos y ensayo de cierres reales. Preparados
enlace_candidato.py, panel_coordinador.ps1, mantenimiento_candidato.ps1,
empaquetador/verificador y LEEME_ENLACE.md, separados de fuentes instaladas.
No se modifican tools/gestion_tags ni tools/zkaccess ni ZIPs anteriores.

Panel WinForms candidato con botones Preparar mantenimiento, Solicitar parada
ensayo, Verificar cierre, Terminar y reanudar y Consultar salud. No se enlazo
dentro del gestor original, no inicia lector, no instala tareas ni vigilancia
automatica. No hay ejecucion local de botones ni SDK/CIM/Access/DPAPI reales.

Solicitud de parada confirma script/ruta exacta mediante CommandLineToArgvW,
PID/run_id y creacion del proceso; escribe solo detener_cierres.json, sin matar
procesos. Verificacion separada exige stopped por limit/requested, gate limpio,
ausencia del PID objetivo y otros lectores, revision del gestor ausente, todos
los recibos/ACK completos y toma/liberacion de sync.lock existente. Modulos de
cierre se verifican contra manifiesto congelado del ZIP publicado, no solo
contra el manifiesto que se encuentre en Dell. Importacion no carga SDK.
Python sin script identificable y otras herramientas SanIsidro desconocidas
bloquean confirmacion. Procesos/argumentos completos solo se inspeccionan en
memoria, no se imprimen ni persisten. No se eliminan locks, ledger ni fallos.

Botones de pausa/reanudacion delegan al mantenimiento instalado exigiendo SHA
840c500933e644fb9545c88091a287416a018b7c3e16434d634138531b97b4f4. Reanudacion
exige ademas cierre del ensayo confirmado y mantenimiento activo. El contrato
legacy de r2 sigue sin acreditar lock/ciclo nuevo por confirmar un proceso:
el wrapper lo explicita y siguen requiriendose dos ciclos nuevos. No afirmar
compatibilidad completa ni sustituir el gestor. El control propio serializa
sus comandos; el lock libre es observacion puntual, no reserva transaccional
frente a lanzadores externos. No abrir otros lectores durante transiciones;
validar carreras y errores antes de usar botones. No hay reanudacion automatica.

Salud: evalua vigencias desde estado/tarea/PID reales y referencia de vigilancia,
sin usar el exito readonly para last_ok. Muestra ensayo readonly por separado;
stopped se denomina detenido_sin_verificar_cierre hasta comprobacion explicita.
Consulta cola existente SQLite mode=ro/query_only, identidad real exigida, sin
inicializar/agrupar/enviar ni tocar leases. Cantidad pendiente y pausa locales
no equivalen a transporte saludable. Informe filtrado propio en registros/,
sin copiar filas/tags/commandlines ni estado instalado. Sin popup/eventos nuevos.

Comprobadas sintaxis Python por AST, PowerShell por parser (incluido comando
CIM embebido, sin ejecutarlo), manifiesto/rutas/fuentes del ZIP y verificador
desde copia extraida. No se agregaron ni ejecutaron pruebas de comportamiento
nuevas: las101anteriores pertenecen a etapa previa, no validan este enlace.
UI/CIM, bloqueo Win32, SQLite real, timeout, carreras, delegacion y fallos de
botones siguen pendientes de validacion con procesos/tareas sustituidos.

Enlace_Candidato_2026.10.25-1.zip,9archivos,17460bytes, SHA256
4203c95d96dc3f22b47c66f34a9ffdd56440c4f081e7cca41a319fc749941032.
ZIP de cierres conserva SHA62afc55c986178e8086035fa978c7d2241f715296f359cc02997db7698819a11
y operacionr3 conserva d27ef8346943fa0c6d7dab3469a6feed8d63597a198de5cc2e8b50ad377d98cf.
Destino nuevo C:\SanIsidro\EnlaceCandidato_20261025. Primer paso solicitado:
verificar paquete y ejecutar solo enlace_candidato.py salud, sin mantenimiento.
No abrir panel ni usar controles antes de revisar salida y validar candidato.
Salida Dell aun pendiente. Instalacion operativa, emisor continuo, integracion
de alertas, recuperacion/retencion/reconciliacion y deploy siguen pendientes.

## Inspeccion readonly del enlace aprobada en Dell — 2026-10-25

Usuario verifica paquete Enlace Candidato2026.10.25-1 y ejecuta solo salud con
Python32. checked_utc2026-10-25T06:58:17.285122+00:00 (00:58:17 Mexico).
Vigencias status correcto/reason null. SanIsidro-Vigencias Running/enabled true,
SanIsidro-Vigilancia Ready/enabled true. read_errors vacio y
installed_watchdog_replaced false. Confirma lectura/evaluacion de estado,
CIM/tareas y cola reales en esta ejecucion; no funcionamiento de botones.

Ensayo previo PID5396/run_id7e60c27f-54a6-4333-a815-0631e6beb164 permanece
stopped, sin errores de lector/almacenamiento. Se muestra
detenido_sin_verificar_cierre y heartbeat_age_seconds1632.297968, coherentes
con ensayo terminado a06:31:04Z: salud no vuelve a verificar ledger/lock.
Este rotulo no invalida los seis cierres y retorno a r2 aportados antes ni
demanda pausar un polling saludable para repetir la comprobacion ahora.

Cola actual leida:84mensajes acked,228respuestas, sin lote0, pendientes0,
paused false. Solo acredita cola local; no conectividad actual del transporte.
Sin SDK, Access, DPAPI, HTTP, mantenimiento nuevo, tareas modificadas ni
vigilancia sustituida. Informe propio de salud guardado por CLI en registros/
de EnlaceCandidato_20261025; usuario no aporta nombre concreto del archivo.

Siguiente etapa: validar controles con procesos/tareas ficticios (identidad,
parada/cierre, errores y transiciones) antes de abrir panel o usar botones en
caseta. Validacion de esos controles e integracion operativa siguen pendientes.

## Controles probados con procesos/tareas ficticios, enlace2 — 2026-10-25

Usuario autoriza continuar con simulacion. Agregadas41pruebas Python en
test_enlace_candidato.py; una ejecuta14comprobaciones de PowerShell mediante
tests/enlace_ficticio.ps1. Ninguno de esos41casos consulta SDK, red, Access,
DPAPI o tareas/CIM reales. Inventario y ledger sustituidos, estados/SQLite
temporales, bloqueos reales sobre archivos temporales propios, parser argv de
Windows y un hijo Python ficticio propio con salida redirigida. Verificacion
de contenido/recibos SDK ya cubierta en etapa anterior; no atribuir a mocks
una lectura de recibos del equipo ni cierre de firmware real.

Primeros26casos detectan5fallos del candidato: cambio de ejecucion durante
inventario antes de stop; inicio futuro; cambio de gate durante comprobacion;
ledger vacio pese a ciclo completado; recibos solo de otra ejecucion. Corregido
releyendo estado/identidad y orden temporal, comprobando estado final completo,
y exigiendo solicitudes de inventario de la misma ejecucion suficientes para
los ciclos declarados completados, despues de validar ledger entero. Tambien
se repite comprobacion de procesos bajo sync.lock antes de confirmar cierre.
Cinco errores de limpieza de fixtures provenian de usar contexto SQLite sin
cerrar la conexion: cambiados a contextlib.closing, no era fallo del producto.

Casos adicionales detectan clasificacion falsa de python -c con ruta .py como
entrada de ensayo. Ahora exige script despues de opciones Python admitidas,
no una ruta incidental de otro argumento. Inventario fallido, timeout, comando
ausente, PID reutilizado, procesos desconocidos, revision pendiente, fault y
lock ausente/ocupado impiden confirmacion. Exito RT/readonly no oculta last_ok
de vigencias vencido; cola readonly conserva bytes y exige identidad del agente.

enlace_funciones.ps1 concentra mapa de acciones, constructor oculto de procesos,
flujo de precondicion/hash/delegacion y mutex. mantenimiento_candidato.ps1 toma
mantenimiento_enlace.lock durante todo precheck Y delegacion; antes CLI liberaba
su mutex al terminar precheck. Funciones reales compartidas con panel/wrapper
ejercitadas con callbacks ficticios: orden/argumentos, bloqueo ante precheck/hash
fallido o no tipado, error de delegado, timeout ficticio, exclusion/liberacion
tras excepcion, cinco acciones, entorno sin SANISIDRO_* y pipes/hijo propio.
dispatch usa la misma ruta de CLI para exigir cierre/mantenimiento/hash antes
de previo_reanudar. No se ejecuto delegado de produccion ni se abrio WinForms.

Final41pruebas nuevas aprobadas en2.441s; suite completa142 en19.338s, fuera del
sandbox por HTTP loopback de Laravel en pruebas anteriores. Sin caseta/API de
produccion/Access reales; suite anterior incluye SQLite, DPAPI ficticio y
Laravel local. powershell_checks_included14 no se suma a142: esta incluido en
una prueba Python. Sin nuevos fallos/errores/omisiones. Sintaxis Python y cinco
scripts PowerShell comprobada, empaquetado y manifiesto verificados.

simular_enlace.py ejecuta solo41casos sobre fixtures, verifica paquete primero,
guarda txt y JSON en registros/ propio, temporales guardados bajo
datos/pruebas_enlace. Repetida desde ZIP extraido: simulation_ok,
41tests/failures0/errors0/skipped0,14checks PowerShell incluidos, ended_utc
2026-10-25T07:10:44.222652+00:00. No consulta estado actual de caseta ni
renueva la ultima salud real recibida del enlace1 a06:58:17Z.

Enlace_Candidato_2026.10.25-2.zip:13archivos,27993bytes, SHA256
03d16983db51a8bc421694c37e044f469e2ea33623004c1da8ade5b854de9e51.
ZIP1 conserva4203c95d96dc3f22b47c66f34a9ffdd56440c4f081e7cca41a319fc749941032;
cierres1 y operacion3 tambien conservan sus SHA publicados. No sobrescribir
EnlaceCandidato_20261025; destino nuevo C:\SanIsidro\EnlaceCandidato_20261025_r2.
Siguiente: verificar ZIP2 y ejecutar simular_enlace.py con Python32 de Dell,
sin mantenimiento. No abrir panel ni usar botones hasta revisar resultado.
Interfaz visual, operaciones reales y carreras con lanzadores externos siguen
pendientes: serializar botones propios no reserva transicion frente a otros
programas. No cambios de tareas, archivos instalados, deploy, SDK o vigencias.
Excepcion puntual binary (-text) en .gitattributes conserva bytes del manifiesto
congelado de cierres (CRLF heredado) para mantener su SHA al recuperar desde Git.

## Simulacion del enlace2 aprobada en Dell — 2026-10-25

Usuario verifica Enlace Candidato2026.10.25-2 y ejecuta simular_enlace.py con
Python32 instalado. Resultado simulation_ok, scope
controles_ficticios_sin_sdk_red_access_tareas_reales,41tests, failures0/errors0/
skipped0, powershell_checks_included14. ended_utc
2026-10-25T07:15:19.279643+00:00 (01:15:19 Mexico). Evidencia:
C:\SanIsidro\EnlaceCandidato_20261025_r2\registros\simulacion_enlace_20261025_011519_279017.json.

Confirma casos de identidad/parada/cierre/cola y funciones de delegacion/panel
con callbacks y datos ficticios en Python x86/PowerShell de Dell. No acredita
operacion real de los botones, ejecucion del gestor instalado o interfaz visual.
No se consultaron tareas, SDK o Access reales, no hubo mantenimiento ni nuevas
capturas. Ultima salud real sigue siendo la consulta de enlace1 a06:58:17Z;
esta simulacion no la renueva. Archivos/ZIP instalados y polling conservados.

Siguiente paso: abrir panel_coordinador.ps1 del enlace2 y pulsar solamente
Consultar salud, sin mantenimiento ni otros controles, revisar vista y salida.
Prueba visual/consulta desde el panel aun pendientes. Preparar/Terminar y
reanudar reales y prueba de parada desde boton requieren etapa posterior.

## Consulta desde panel candidato confirmada — 2026-10-25

Tras indicar abrir panel2 y usar solo Consultar salud, usuario aporta resultado
checked_utc2026-10-25T07:17:11.556554+00:00 (01:17:11 Mexico). Vigencias correcto,
reason null; tareas Vigencias Running y Vigilancia Ready, ambas enabled true.
Cola84acked/228respuestas, pendientes0/sin lote0/paused false, read_errors vacio,
installed_watchdog_replaced false. Ensayo5396/7e60c27f-54a6-4333-a815-0631e6beb164
permanece stopped sin errores, detenido_sin_verificar_cierre,
heartbeat_age_seconds2766.5694. Coherente con ensayo terminado a06:31:04Z;
no fallo operativo ni motivo para verificar lock con polling funcionando.

Confirma ruta de consulta desde el panel segun secuencia indicada y salida
recibida. No hay captura visual para certificar distribucion de controles;
no acredita aun botones de mantenimiento/parada/cierre ni nueva captura SDK.

Siguiente ensayo propuesto: ZKAccess cerrado y otras herramientas sin operar;
Preparar mantenimiento del panel, esperar pausa confirmada, lanzar lectura
readonly validada de cierres en otra PowerShell, solicitar parada desde panel
tras15s, esperar Cierre coordinador y retorno de su consola, Verificar cierre,
y solo con cierre_confirmado Terminar y reanudar desde panel. Comprobar dos
ciclos nuevos r2 al final. Sin tag fisico, SSH, emisor automatico, instalacion o
escrituras SDK. Ante error/no confirmacion conservar mantenimiento/evidencia y
revisar antes de continuar; ningun paso real de esta secuencia acreditado aun.

## Excepcion de ventana reportada, diagnostico pendiente — 2026-10-25

Usuario comparte final de informe WinForms: ensamblados System.Web.Extensions,
System.Web, Windows.Forms, Drawing y texto generico de Depuracion JIT. No
incluye cabecera/Texto de la excepcion, mensaje, stack de fallo ni boton pulsado.
Ese fragmento no identifica causa ni acredita una DLL faltante o un fallo SDK.
No habilitar JIT, modificar machine.config, registrar/reemplazar SDK o reinstalar
.NET basandose en ese texto. No se aplico parche especulativo.

Revisados panel_coordinador.ps1, enlace_funciones.ps1 y wrapper de mantenimiento.
Panel contiene operaciones de eventos fuera de try/catch (p.ej. consulta HasExited
del timer y construccion de ProcessStartInfo); posibles rutas de excepcion
no controlada, sin atribucion al incidente hasta obtener cabecera y accion.
Las pruebas de funciones/delegados no ejercitaron interfaz visual completa.

Solicitados boton/accion exactos, inicio del informe y estado actual de tareas,
estado.json y ultimos ciclos. No hay evidencia nueva de pausa/reanudacion,
parada del ensayo o salud de caseta posterior a consulta07:17:11Z. Detener la
secuencia de botones hasta aclararlo; no reanudar o cerrar procesos a ciegas.

Aclaracion posterior del usuario: pulso Ctrl+C en PowerShell que ejecutaba
panel_coordinador.ps1 del enlace2, no identifica la lectura SDK ni SSH como
ventana interrumpida. Ese comando mantiene ShowDialog y timer hasta cerrar
panel; prompt ocupado es esperado mientras esta abierto. Interrupcion del
host PowerShell es compatible con excepcion en WinForms, pero sin cabecera
no certificar tipo/stack exacto. Explicar cierre normal por X al terminar
controles. No consta si un boton de mantenimiento estaba en curso al pulsar
Ctrl+C; comprobar tareas/estado antes de retomar ensayo. No hubo parche nuevo,
reinstalacion ni autorizacion para reiniciar/forzar cierre de procesos.

Segunda aclaracion del usuario: habia pulsado Preparar mantenimiento antes de
Ctrl+C al host del panel; aun iba a ejecutar lanzar_cierres.ps1 -Seconds150,
no habia iniciado esa nueva lectura. Sustituye duda anterior sobre boton usado:
si hubo solicitud de pausa, pero su finalizacion no esta acreditada por salida.
No atribuir este Ctrl+C al trabajador SDK ni afirmar nuevo cierre inseguro o
capturas perdidas. Confirmar tarea/enabled, mantenimiento.json y estado del
polling antes de iniciar lector o reanudar. Mantener secuencia detenida hasta
esa comprobacion; no reinstalar componentes ni borrar evidencias/bloqueos.

## Pausa tras interrupcion del host del panel confirmada — 2026-10-25

Usuario aporta SanIsidro-Vigencias Disabled/Enabled false,
mantenimiento.json active true/wasEnabled true/inicio local
2026-10-25T12:19:34.7264830-06:00. Estado protocol2/PID9544,
run_started_utc2026-10-25T06:31:52.156041+00:00, phase stopped,
consecutive_errors0/last_error_type null, ultimo ciclo correcto
2026-10-25T18:19:05.757496+00:00 y heartbeat de parada
2026-10-25T18:19:35.495112+00:00. Confirma estado de pausa esperado y registro
de mantenimiento conservado. No aporta inventario de procesos vivos ni prueba
de lock libre: el lanzador validado exige tomar sync.lock antes de conectar.

No repetir Preparar mantenimiento. Se puede retomar la lectura readonly acotada
con lanzar_cierres.ps1 en otra PowerShell y usar panel para parada propia,
verificacion de cierre y reanudacion condicionada. Mantener abierta la consola
que sostiene panel, sin Ctrl+C; prompt ocupado mientras muestra WinForms es
esperado. Excepcion JIT sigue sin cabecera/stack exactos, no parcheada ni
atribuida a SDK. Nueva lectura, cierre, reanudacion y dos ciclos nuevos aun
pendientes de evidencia; no confundir esta parada de12:19 con ciclos previos.

## Parada por boton, cierre y retorno al polling comprobados — 2026-10-25

Usuario comparte ensayo de cierres despues de pausa12:19 y consulta del panel:
PID10540, run_id1c5afafc-4f85-4ea9-ab8f-352d655ccabd. Solicitud del boton
parada_solicitada vinculada a esa identidad. Consola del lanzador termina
normalmente, phase stopped/stop_reason requested, una comparacion readonly
completada, errores consecutivos/totales0, last_completed_utc
2026-10-25T18:27:36.569976+00:00. reader_error/storage_error null y gate sin fallo.

Verificar cierre devuelve cierre_confirmado para el mismo PID/run_id,
closures_acknowledged_total8, closures_for_current_run2 y lock_free_at_check true,
checked_utc2026-10-25T18:28:16.930202+00:00 (12:28:16 Mexico). El total8 incluye
los6anteriores, no ocho cierres nuevos. Confirma solicitud/parada cooperativa,
verificacion de recibos, ausencia de lectores segun inventario y disponibilidad
puntual de lock, no firmware/red/cliente externo ni reserva para otro arranque.
No se reporta nueva excepcion JIT durante esta secuencia; tampoco se afirma
que se haya corregido por parche la interrupcion del host observada antes.

Originales anteriores revisados228, responses siguen228, unbatched0,
messages acked84/pending1, pending_count1/paused vacio; primer pendiente
2026-10-25T18:27:36.609119+00:00. No nuevas respuestas RT guardadas en esta
ejecucion. El unico mensaje nuevo es coherente con snapshot de estado en
_queue_state y ausencia de nuevos lotes; endpoint no impreso en salida, no
acreditar entrega remota de ese mensaje sin ACK posterior. Originales/hashes
no se vuelven a certificar con esta consola; manifiesto anterior se conserva
como evidencia historica, no manifiesto nuevo de esta ventana.

Polling nuevo PID15600, run_started_utc2026-10-25T18:28:46.103056+00:00,
errores0/last_error_type null. Dos ciclos correctos nuevos12:28:49.887 y
12:29:53.479 Mexico; API838, cambios Access0/C3=0, no encontrados4, ausentes
API116 sin cambios. Parada previa12:19:35.505. Estado consultado phase cycle,
heartbeat18:30:53.480617Z/cycle_started18:30:53.480633Z y
last_ok18:29:53.478075Z: tercer ciclo en curso, no error ni cierre pendiente.
Dos ciclos correctos bastan para aceptacion del retorno de esta ventana;
no afirmar finalizacion del tercero sin su log. No se aportan nueva tabla de
tareas/registro mantenimiento inactivo ni estado de vigilancia en esta salida.

Queda aceptada secuencia de control segun resultados aportados tras instrucciones
del panel candidato, sin sustituir gestor instalado ni tareas. Se puede cerrar
panel normalmente por X al terminar controles; polling debe continuar activo.
Pendientes: mensaje de estado local, envio automatico independiente, vigilancia
integrada, recuperacion/retencion/reconciliacion y transicion permanente. No
hay nuevo deploy, aplicar fechas desde candidato ni screen/endpoints de consulta.

## Emisor automatico acotado y vigilancia preparados — 2026-10-25

Usuario indica continuar y autoriza pruebas aisladas del nuevo componente.
Preparado Envio_Vigilado_2026.10.25-1.zip en carpeta separada: padre supervisor,
hijo HTTP sin SDK/Access, cola/credencial existentes, destino fijo backend
aislado y salud de emisor separada de vigencias. Ventana5..180s, sin instalar
tarea/servicio ni sustituir vigilancia actual. No modo operativo SDK/aplicar.
33pruebas nuevas y175totales aprobadas; simulacion de ZIP extraido correcta.
Plan, limites, SHA, fuentes congeladas y evidencia en control-acceso-envio-vigilado.md.
Primero verificar y simular en Dell sin mantenimiento; recepcion Dell y envio
real con este supervisor pendientes. Ultima salud real de polling permanece
en retorno de12:28-12:30, no renovada por pruebas locales. Sigue1mensaje local
pendiente segun ultima salida, sin nuevo ACK aportado. No repetir lectura SDK.

Ensayo posterior del emisor1 termina fault/exit1 PermissionError, pero observacion
real19:47:27Z muestra vigencias correcto/tareas habilitadas, cola228respuestas/
85acked/0pendientes. No SDK ni nueva pausa. Colision de os.replace contra lector
Windows reproducida localmente, correccion acotada y diagnostico ampliado en
Envio_Vigilado_2026.10.25-2.zip;37casos/179totales aprobados localmente.
Detalle de evidencia, limites y SHA en control-acceso-envio-vigilado.md.
Validacion de ZIP2 en Dell pendiente; no considerar envio vigilado aceptado
solo por cola vacia cuando no confirmo finalizacion del hijo.

Actualizacion 2026-10-25: emisor2 separado aceptado en Dell con cierre limpio
a20:00:34Z, cola85acked/228respuestas/0pendientes y vigencias correcto;
detalle en control-acceso-envio-vigilado.md. Preparado candidato conjunto
readonly y envio HTTP aislado, con parada cooperativa, recibos y verificacion
propios; 30 pruebas nuevas/209 totales locales aprobadas. Validacion Dell
pendiente, primero solo simulacion. No usar botones del enlace2 para el nuevo
nombre/ruta: pausa y reanudacion siguen por gestor instalado, despues de FIN
y verificacion del conjunto. No instala tareas ni reemplaza vigilancia.
Detalle del paquete, limites y secuencia en control-acceso-ensayo-conjunto.md.

Aceptacion posterior 2026-10-25: ensayo conjunto150s aprobado, 3ciclos readonly
sin errores, ACK nuevos77, 300respuestas/162mensajes acumulados/cola vacia,
originales conservados y cierres SDK/HTTP confirmados. Verificacion final propia
cierre_conjunto_confirmado a21:28:45.162974Z, despues reanudacion por gestor:
SanIsidro-Vigencias Running/Enabled=true, PID12648/protocol2/idle/errores0,
last_ok21:30:22.584663Z. Dos ciclos correctos15:29:19.174/15:30:22.586 Mexico,
API838/cambios Access0/C30/no encontrados4/ausentes116 intactos. Pausa, ensayo,
cierre y retorno acreditados; no integracion permanente ni sustitucion de tareas,
gestor o vigilancia. Detalles/identidades en control-acceso-ensayo-conjunto.md.

2026-10-25: siguiente avance local, núcleo read/apply con transporte y panel
inyectados, aún sin factory SDK/CLI operativo nuevos. 31 pruebas nuevas y
240 totales aprobadas; paquete Nucleo_Vigencias_2026.10.25-1.zip solo para
simular en Dell sin mantenimiento. No se aplicaron fechas reales ni cambiaron
tareas. Evidencia, SHA, límites y siguientes pasos en transición-operativa.
