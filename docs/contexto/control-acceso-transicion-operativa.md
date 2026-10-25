# Control de acceso: transición operativa propuesta

2026-10-25. Diseño basado en el código local y en el ensayo conjunto aceptado.
Este documento prepara el siguiente cambio; no acredita una instalación nueva
ni autoriza aplicar fechas desde el candidato o desplegar a producción.

## Punto de partida verificado

El ensayo conjunto completó tres comparaciones readonly y entregó 77 mensajes
nuevos al backend aislado. Acumulado: 300 respuestas originales, 162 mensajes
confirmados, cero pendientes; cierres y retorno a r2 con dos ciclos correctos
comprobados. Evidencia completa en control-acceso-ensayo-conjunto.md.

El polling instalado sigue siendo el encargado de aplicar vigencias. Su última
salida aportada es PID12648, protocol2/idle, last_ok21:30:22.584663Z y errores0.
El recolector y emisor acotados ya terminaron; no están operando continuamente.

El usuario pide continuar con Sol Medium y que se le avise antes de recomendar
High. La revisión y este diseño se preparan en Medium; se recomienda High para
implementar/revisar la unión de escrituras SDK, exclusión y mantenimiento.
Esto es una preferencia de trabajo, no un cambio de modelo ejecutado por código.

## Hallazgos del código que condicionan el cambio

| Fuente revisada | Comportamiento real | Consecuencia para el candidato |
| --- | --- | --- |
| tools/gestion_tags/mantenimiento.ps1, Procesos-Sync | Reconoce Python/Pythonw por C:\SanIsidro\ZKSync\sincronizar_vigencias.py y --continuo. Envía detener.sync.json al PID protocol2 y espera hasta 360 s. | Conservar esa entrada y contrato al instalar. Un nuevo nombre o tarea en paralelo no queda controlado por el gestor actual. |
| tools/zkaccess/iniciar_oculto.ps1 | Descifra DPAPI en usuario Dell y arranca pythonw x64 con --aplicar --continuo. | Mantener los argumentos y credenciales existentes; un futuro instalador debe comprobar el principal y la acción reales, no asumirlos. |
| referencia_r2/sincronizar_vigencias.py, main/cycle | Un lock por proceso, ciclo API/Access/C3 y espera 60 s después de terminar. last_ok solo tras cycle exitoso. | Conservar prioridad, semántica de éxito y fechas oficiales; no actualizar last_ok por RT o ACK. |
| referencia_r2/sincronizar_vigencias.py, worker | subprocess.run con timeout300, sin recibo durable de Disconnect. | No conectar RT después de una salida de este worker sin prueba de cierre; requiere adaptador concreto para lectura y aplicación. |
| referencia_vigencias.py y adaptadores_cierre.py, SafeReferenceProbe | Fuerzan cycle(password, False, None); read_inventory acepta únicamente mode=read. | No basta cambiar False por True. Publicaciones readonly intactas; crear fuentes y pruebas nuevas para aplicación. |
| tools/zkaccess/vigilar_sync.py | Vigila heartbeat/last_ok de protocol2 y trata tarea Disabled como mantenimiento. | Conservar vigilancia actual de vigencias; salud de lector/emisor adicional, sin hacer que un ACK o snapshot la sustituya. |
| coordinador.py, Coordinator.run | Tiene límite de ensayo y estado cycle_probe separado del polling observado. | No quitar el límite y llamarlo producción. El nuevo runner necesita ciclo operativo real, parada compatible y estados propios. |

Los archivos de tools/gestion_tags y tools/zkaccess son contexto local revisado,
no una nueva certificación remota de sus bytes. Las fuentes r2 de referencia y
los ZIP publicados no se editan. Hashes remotos conocidos están en operación.

## Diseño propuesto para el candidato

1. Una entrada x64 de sincronización controla la sesión SDK, con el mismo
   sync.lock exclusivo durante toda su ejecución. En instalación final conserva
   sincronizar_vigencias.py --aplicar --continuo; no otro lector paralelo a r2.
2. El ciclo de vigencias consulta la API y conserva el algoritmo r2: solo fechas
   e indicador de validez de existentes, ausentes API intactos y sin altas ni
   reparación de permisos. Comparación previa y lectura posterior preservadas.
   No usar la outbox, un evento o el navegador como fuente de vigencias.
3. Un nuevo adaptador de workers x86 cubre inventario y aplicación. Cada turno
   acredita identidad del controlador, resultado, Disconnect, salida y recibo
   durable antes de liberar el gate. Reutilizar lógica r2 verificada donde sea
   posible; no usar el adaptador readonly para escribir. No persistir Password
   ni otros campos privados del inventario en recibos/logs.
4. Entre ciclos, RT guarda original durable antes de construir mensajes. Se
   cierra y verifica antes de cualquier turno de vigencias. Intervalos iniciales
   propuestos: vigencias 60 s después de terminar, RT 1 s, lote local 5 s y estado
   30 s, como el ensayo. No prometen latencia fija ni lectura vehicular completa.
5. El emisor HTTP es un proceso propio sin SDK/Access, con la misma outbox,
   identidad y DPAPI del agente. No retiene el gate SDK por esperar la red. Una
   falla HTTP deja pendientes; no desactiva ni cambia las vigencias oficiales.
6. Separar estado oficial protocol2 de salud de lector, disco y emisor. Un
   problema de captura/outbox pausa la lectura RT sin fingir un ciclo correcto;
   si el SDK cerró con certeza, la sincronización de vigencias puede continuar.
   Si el cierre SDK no está acreditado, bloquear nuevos turnos y alertar para
   revisión. No resolverlo borrando locks, reiniciando a ciegas o matando PIDs.
7. Al recibir la parada ligada al PID, terminar la operación de fechas en curso,
   cerrar RT/SDK con recibos y recoger el emisor por su canal propio. Publicar
   stopped solo después del cierre confirmado. Un fallo conserva evidencia y
   evita que el gestor crea disponible un equipo con un worker SDK vivo.

La integración requiere probar el tiempo de parada real frente a los 360 s
del gestor. No ampliar ese plazo ni relajar su condición de salida sin un
análisis de operaciones en curso y una prueba concreta. No usar escritura
simulada para acreditar una aplicación real.

## Entrega y aceptación por etapas

1. Implementar el contrato operativo y adaptador nuevo en carpeta local
   candidata. Pruebas aisladas de turnos read/apply/RT, recibos y fallos en las
   fronteras C3/Access; nunca importar DLL ni usar credenciales reales en ellas.
2. Probar la entrada candidata en modo readonly acotado contra el mismo
   algoritmo de comparación. Gestor instalado pausa r2; el candidato separado
   tiene su propia parada/verificación porque su ruta aún no es la instalada.
   Cerrar y reanudar r2 mediante gestor, con dos ciclos correctos.
3. Antes de permitir aplicación candidata: comparar planes r2/candidato con
   datos de prueba idénticos, probar lecturas posteriores, permisos intactos,
   fallo parcial C3/Access y cierre incierto. Preparar respaldo y recuperación
   selectiva; pedir autorización para cualquier ensayo real que escriba.
4. Preparar instalador y rollback revisables, con respaldo de código/configuración
   y XML de tareas, hashes y rutas verificadas. No copiar bases/credenciales sobre
   otras identidades ni restaurar una outbox antigua perdiendo ACK/originales.
   El rollback debe cerrar candidato, conservar datos y restaurar r2 comprobado.
5. Solo tras aceptación y confirmación de transición: instalar en mantenimiento,
   comprobar gestor/parada/vigilancia y dos ciclos reales. Probar recuperación
   tras reinicio bajo el usuario Dell; no suponer arranque antes de iniciar sesión.

El backend de ensayo sigue aislado. El endpoint definitivo, credencial operativa
y despliegue Laravel se prepararán con el script existente y confirmación antes
de producción; el túnel SSH/PHP de ensayo no es transporte permanente. Evitar
dos emisores que compitan por la misma outbox durante pruebas y transición.

Antes de producción siguen pendientes retención, capacidad y alertas concretas.
Hasta definirlas, conservar los originales y detener captura ante límites de
disco; ningún borrado automático ni promesa de duración indefinida. Reconciliación
histórica y gaps deben tratarse aparte de recibir ACK. La pantalla web y las
solicitudes de altas/recuperación siguen en etapas posteriores.

## Estado al terminar esta revisión

Diseño preparado; no nuevo runner operativo, instalador, aplicación candidata,
ZIP, tarea o despliegue por este documento. No nueva operación solicitada a
Dell y no repetir mantenimiento ni lectura del ensayo ya aceptado.

## Núcleo candidato implementado y probado localmente — 2026-10-25

Usuario indica continuar después de recomendar High. Se implementa
tools/agente_acceso/vigencias_candidato.py y sus pruebas, sin modificar r2 ni
adaptadores/ZIP publicados. No hay CLI, factory de hardware o launcher nuevo
para aplicar: panel y comando hijo son dependencias obligatorias, ficticias
en esta entrega. No afirmar aplicación real ni integración continua terminada.

- ReferenceCycle carga las cuatro fuentes r2 verificadas y conserva cycle,
  incluida consulta nueva a API por ciclo, comparación, respaldo por tag,
  ausentes API intactos, C3 antes de commit Access y error por aplicación parcial.
  Solo sustituye el transporte worker, carpeta de reportes y logging de errores
  ODBC por tipo sin mensaje de excepción. Readonly es el valor predeterminado.
- Kernel worker valida todo el lote y su SHA antes de construir un panel.
  Confirma serial/hash a través de la interfaz inyectada, envía solo cuatro
  campos de fechas y compara todos los campos/autoridades tras la escritura.
  Inventario persistido excluye Password/Group/SuperAuthorize; datos privados
  del usuario solo permanecen en la comparación temporal ficticia.
- Exchange verifica recibo/PID/rol/ejecución y vínculo SHA de operación con
  respuesta. ACK del padre durable antes de liberar gate. Timeout/salida sin
  cierre/recibo alterado bloquean SDK. Usa el mecanismo de cierre previamente
  publicado; sus timeouts terminan únicamente el hijo propio y dejan fault.
- Una operación fallida antes de escribir puede reintentarse tras volver a
  consultar datos. Si se intentó escribir y falló/verificación discrepante,
  detiene el resto del lote y conserva revision_vigencias.json. Se distingue
  ReviewRequired de cierre SDK incierto; ReferenceCycle propaga revisión para
  impedir seguir a RT/otro ciclo. El futuro runner debe respetar esa excepción.
- check_operations reconstruye esa condición desde recibos aun sin marca
  adicional, valida contenido contra hash y rechaza corrupción. Falta de ACK
  o ledger incompleto no permite otro worker. No existe reset/force.

31 pruebas nuevas aprobadas; incluyen hijos Python ficticios reales sin
SANISIDRO_* heredado y algoritmo r2 real con API/ODBC/C3 sustituidos. Casos:
solicitud alterada/lote inválido, fechas/permisos/cambio concurrente, cierre de
recursos/serial incorrecto, fallo parcial en C3 y en Access, API nueva por ciclo,
API inválida sin abrir Access/C3, ACK antes de gate, error de ACK, revisión tras
reinicio aunque falle marca adicional, timeout/recibo de otra operación y
exclusión frente a RT ya activo. Sintaxis Python y PowerShell aprobada.
Suite completa: 240 pruebas en59.732s, sin fallos. Fuera de sandbox para casos
previos Laravel loopback/DPAPI ficticio; sin caseta ni producción.

Paquete inmutable Nucleo_Vigencias_2026.10.25-1.zip: 26 archivos, 65915 bytes,
SHA256 2370108844b2276a30765746c5319180cb3c8a59f44d53066deeb453fb87ea65.
Contiene cinco fuentes propias y 20 archivos completos/intactos de cierres1,
más VIGENCIAS_SHA256SUMS.json. Comparados bytes con ZIP original, manifiesto y
fuentes. Extraído en carpeta local separada y verificado por Windows PowerShell;
simulación extraída simulation_ok,31pruebas/fallos0/errores0/omisiones0,
ended_utc=2026-10-25T23:18:39.119591+00:00. ZIP no se sobrescribe.

Siguiente paso Dell: verificar y simular con Python32 en
C:\SanIsidro\NucleoVigencias_20261025, sin mantenimiento/SSH/SDK/red real.
Guía exacta LEEME_VIGENCIAS_CANDIDATO.md. Salida Dell pendiente. No ejecutar
lanzadores readonly históricos incluidos como dependencias en este paso.

Después faltan factory SDK real y su verificación, runner/estado protocol2,
parada/gestor, vigilancia, respaldo durable/rollback, pruebas separadas y
autorización para aplicar en caseta/transición. No se acorta esa secuencia por
haber probado aplicación ficticia. Salud real sigue siendo PID12648/last_ok
21:30:22.584663Z de la aceptación anterior; estas pruebas no la actualizan.

## Simulación del núcleo aprobada en Dell — 2026-10-25

Usuario verifica Nucleo_Vigencias_2026.10.25-1 y ejecuta con Python32 instalado:
simulation_ok,31pruebas/failures0/errors0/skipped0,
ended_utc=2026-10-25T23:23:31.876571+00:00. Evidencia Dell:
C:\SanIsidro\NucleoVigencias_20261025\registros\simulacion_vigencias_20261025_172331_876525.json.
No mantenimiento ni SDK/red/DPAPI/Access/tareas reales en esta simulación.
No acredita aplicación real ni actualiza la salud remota de vigencias.

## Puente SDK readonly preparado — 2026-10-25

Se implementan puente_sdk_readonly.py y ensayo_puente_readonly.py en carpeta
candidata, sin editar núcleo1, fuentes r2, adaptadores o ZIP publicados.

- Binding reutiliza diagnostic_module/load_sdk: PE/hash x86, directorio DLL
  instalado, firmas/exportaciones documentadas y comprobadas previamente de
  Connect/Disconnect/GetDeviceParam/GetDeviceData. Serial exacto antes de leer.
  No cambia DLL ni registra SDK. Rechaza mode distinto de read antes de construir
  panel; write_dates siempre rechaza, no enlaza ni llama SetDeviceData/GetRTLog.
- Padre x64/DPAPI realiza una comparación r2 readonly y otra con ReferenceCycle
  y Exchange nuevos, apply=False. Mantiene sync.lock instalado durante ambas,
  recibe parada propia entre ciclos y verifica cierre/recibos antes de terminar.
  No necesita servidor/túnel SSH de ensayo: solo API de vigencias habitual,
  Access y C3 durante una futura pausa coordinada por el gestor.
- Dos consultas secuenciales, cada una con consulta API nueva. Se conservan CSV
  completos; comparación por tag ignora solo orden y compara vigencia API,
  existencia y flags de cambios. Diferencias requieren revisar datos/tiempos;
  no implican automáticamente un fallo del candidato o cambios de API.
- Sin lectura RT ni envío/outbox: no consume eventos, cambia originales/ACK,
  estado_cierres.json anterior o credencial. Nuevos recibos se agregan al
  ledger de ensayo existente; estado/stop/resultados propios bajo el paquete.
- Verificación final propia --verificar-cierre: UUID/PID, recibos de este run,
  ausencia de lectores/PIDs reutilizados y lock bajo mantenimiento. Watchdog
  solo exceptuado por ruta/bytes conocidos. Fault/incompleto bloquea otro run;
  sin reset/force. Un stopped con planes distintos es cierre, no comparación
  aceptada. Reanudar solo tras cierre_puente_confirmado y dos ciclos r2 nuevos.

23 pruebas nuevas aprobadas: DLL/mantenimiento/serial, inventario incompleto,
no ruta de escritura, cierres de recursos, orden/parada de comparación, CSV
inválido/diferencias, lectores/PID reutilizado/bytes watchdog, recibos, CLI sin
--aplicar, ejecución manual completa con dos workers ficticios y bloqueo tras
fault. SDK/API/Access/CIM/DPAPI/tareas sustituidos. Suite263aprobadas en72.047s;
sintaxis Python y PowerShell aprobada. Fuera de sandbox por pruebas previas de
Laravel loopback/DPAPI ficticio; sin caseta ni producción.

Puente_Readonly_2026.10.25-1.zip: 46 archivos,121001bytes, SHA256
347a629e28ba5be4bcebc7f8ed46abe9649025ff89806b241a6059fc839acd00.
Manifiesto de45fuentes más manifiesto. Contiene cierres1 completo/intacto,
envío2 completo/intacto bajo envio/, y dos fuentes núcleo1 byte por byte.
Envio2 se importa para snapshots y lector de procesos; no inicia emisor.
ZIP extraído, hashes/rutas/dependencias verificados y simulación aprobada:
simulation_ok,23tests/failures0/errors0/skipped0,
ended_utc=2026-10-25T23:36:00.885922+00:00. No sobrescribir publicación.

Primero Dell: verificar/simular en C:\SanIsidro\PuenteReadonly_20261025 sin
mantenimiento ni SSH/SDK/red real. Salida Dell y ensayo real pendientes.
Después de revisar simulación: pausa por gestor instalado, cerrar otros lectores,
lanzar_puente_readonly.ps1, FIN puente, verificación propia y reanudar con dos
ciclos. No ejecutar todavía modo real por recibir el ZIP. Guía exacta en
LEEME_PUENTE_READONLY.md. No tag físico ni otra biblioteca.

Siguen pendientes binding de aplicación real, runner operativo/gestor/vigilancia,
respaldo durable/rollback y transición autorizada. Ninguna aplicación de fechas,
instalación permanente, endpoints o UI nueva por preparar este puente.

## Simulación del puente aprobada en Dell — 2026-10-25

Usuario verifica Puente_Readonly_2026.10.25-1 y ejecuta simular_puente_readonly.py
con Python32: simulation_ok,23pruebas/failures0/errors0/skipped0,
ended_utc=2026-10-25T23:41:07.974606+00:00. Evidencia:
C:\SanIsidro\PuenteReadonly_20261025\registros\simulacion_puente_20261025_174107_974540.json.
Simulación aislada, sin hardware/red/DPAPI/tareas reales. Se indica siguiente
ensayo: pausa desde gestor instalado, verificar Disabled/active=true/stopped,
lanzar_puente_readonly.ps1, FIN puente y --verificar-cierre antes de reanudar
por gestor y comprobar dos ciclos. No necesita servidor/túnel SSH ni tag físico.
Lectura real, comparación y retorno de esta nueva pausa aún pendientes.

## Comparación readonly real aprobada; cierre final pendiente — 2026-10-25

Usuario ejecuta lanzar_puente_readonly.ps1: reference y candidate completados,
phase=stopped/stop_reason=completed/trial_passed=true/error_type=null. Ambos
planes contienen838registros, missing/added/changed=0 y sample_tags vacío.
Mismo SHA256 normalizado:
3d26b5cd8c80ea713b7b3a92a600b82e2c4bd4156e7211b7f6fd33411d1c6071.
Son planes de comparación de vigencias, no838eventos ni prueba de escritura.

Padre PID12404/run_id=c829b806-a870-4b2e-bd96-1aeff136f05d,
ended_utc=2026-10-25T23:43:50.805541+00:00. Recibos16acumulados, dos de este
run (antes14): worker41b8b3f8-71f9-4c79-bd6c-9f3ce24874b2/PID8944 y
worker97cb9966-6676-4e1f-a02b-3c7eac9b0e88/PID4556. La salida ordena por UUID,
no atribuir cada PID a referencia/candidato sin sus request.json. Evidencia:
C:\SanIsidro\PuenteReadonly_20261025\datos\sesiones\c829b806-a870-4b2e-bd96-1aeff136f05d.

Valida binding SDK readonly del núcleo, comparación contra r2 y recibos en esta
muestra. No aplica fechas, consume RT o envía/outbox. No acredita servicio
permanente, permisos de altas ni aplicación real. Solicitar --verificar-cierre
propio; solo con cierre_puente_confirmado reanudar por gestor y comprobar dos
ciclos nuevos. Verificación final y retorno de esta pausa aún no aportados.

## Retorno del polling confirmado; salida de cierre final no aportada — 2026-10-25

Usuario aporta tarea SanIsidro-Vigencias Running/Enabled=true, protocol2,
PID14524/run_started23:45:52.416609Z, phase=idle, consecutive_errors=0,
last_error_type=null y last_ok23:46:59.902633Z. Dos ciclos nuevos correctos
17:45:56.279 y17:46:59.904 Mexico: API838/cambios Access0/C30/no encontrados4/
ausentes API sin cambios116. Parada previa17:43:20.852. Retorno y salud del
polling comprobados en esa consulta; la comparación real anterior sigue igual.

La salida compartida NO incluye --verificar-cierre/cierre_puente_confirmado.
El resultado previo del ensayo contiene sus recibos válidos, pero no sustituye
esa comprobación posterior. Solicitar únicamente la salida anterior o confirmar
si apareció antes de reanudar; no pedir nueva pausa ni ejecutar ese verificador
ahora, porque exige mantenimiento y el polling ya está saludable. No afirmar
que el comando falló o que fue omitido. El verificador de esta versión imprime
la confirmación y no guarda un recibo final separado. Dato histórico pendiente.

## Verificación final anterior a reanudación confirmada — 2026-10-25

Usuario aporta la salida anterior de --verificar-cierre:
cierre_puente_confirmado, PID12404/run_id=c829b806-a870-4b2e-bd96-1aeff136f05d,
checked_utc=2026-10-25T23:45:40.454780+00:00. Es anterior al arranque del polling
23:45:52.416609Z ya aportado; queda resuelto el dato histórico pendiente.
Aceptadas comparación readonly r2/candidato de838registros, cierre final propio
y retorno a r2 con dos ciclos correctos. No solicitar otra pausa/lectura.
Esto no habilita aplicación candidata ni acredita operación permanente.
