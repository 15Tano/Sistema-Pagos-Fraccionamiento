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
