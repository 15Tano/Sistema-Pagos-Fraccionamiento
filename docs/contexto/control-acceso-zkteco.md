# Control de acceso ZKTeco y futura pantalla web

Contexto al 23 de octubre de 2026. Diferenciar propuestas, codigo local y pruebas
reales de caseta. Este documento no certifica el estado actual de produccion.

## Punto para retomar

El usuario quiere evaluar/integrar una pantalla de Control de acceso dentro de
la app existente: estado de caseta, consulta de tags, lecturas/rechazos,
identificacion de tags sin numero impreso y, posteriormente, altas/recuperaciones.
Se explico y el usuario acepto conceptualmente ampliar el backend Laravel actual;
no hace falta otra API desplegada ni otro servidor para esta arquitectura.
Estado actual: lectura real y correlacion RT/historial verificadas en caseta;
backend de ingesta implementado y validado localmente en SQLite y MySQL aislado.
Emisor/outbox validado localmente y cliente manual en Dell con entrega de fixtures
al backend aislado confirmada por ACK; sin recolector permanente instalado.
Pantalla, coordinador SDK y cola de operaciones siguen pendientes. No hay autorizacion
de despliegue de esta ampliacion. Entorno Dell compatible con SQLite en disco y
DPAPI segun preflight; entrega al servidor de ensayo remoto comprobada tras
reintento sin conexion. Siguiente etapa: integrar lectura SDK con coordinador
en carpeta separada, sin cambiar aun la instalacion operativa.

Las secciones siguientes conservan la secuencia historica de decisiones y pruebas;
consultar los cierres al final para distinguir pendientes anteriores ya resueltos.
Reloj exacto sigue sin certificar. Pruebas fisicas del 24 octubre vinculan DoorID 1
con entrada y DoorID 2 con salida. Reanudacion verificada tras ambas capturas.
Equivalencia de nombres Pluma 1/2 pendiente (ver cierres).

## Base operativa comprobada

- Caseta Windows, usuario Dell; operacion remota manual del usuario mediante
  AnyDesk. Este chat no tiene acceso directo a esa computadora.
- C3-200, SN CO2K225060027, IP 192.168.1.201, puerto 4370, comunicacion sin clave.
- SDK de 32 bits: `C:\Program Files (x86)\ZKTeco\ZKAccess3.5\NewSDK\plcommpro.dll`.
- MDB: `C:\Program Files (x86)\ZKTeco\ZKAccess3.5\Database_PRO.mdb`.
  Tiene contrasena; no registrarla en documentos, comandos ni logs.
- Python DLL: `C:\Users\Dell\Python32\python.exe`.
- Python Access/API: `C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe`.
- Polling instalado: `C:\SanIsidro\ZKSync`, release 2026.10.14-r2.
- Gestor independiente: `C:\SanIsidro\GestionTags`, ultima entrega operativa
  GestorTags-2026.10.14-2, con diagnostico de niveles adicional de solo lectura.
- Fuentes locales: `tools/zkaccess/` y `tools/gestion_tags/`.
- Ultimo estado remoto saludable aportado: 18 octubre 16:56:52 Mexico,
  SanIsidro-Vigencias Running, pythonw PID 14488, phase idle, errores 0,
  ultimo ciclo correcto 16:56:32; API 830, cinco no encontrados, 119 ausentes API.
  No atribuir ese estado al 23 de octubre sin nueva consulta.

## Reglas que se mantienen

- API unica autoridad de vigencias, endpoint `/api/vencimientos` con
  `{card_no, expiration}`. Access guarda fin completo y set_valid_time=True;
  C3 guarda fechas YYYYMMDD. Inicio 2020-01-01.
- Quitar un tag de la API NO lo desactiva: polling conserva lo ultimo guardado.
  Asi se explico expresamente el 20 de octubre. No introducir bloqueo/eliminacion
  por ausencia sin nueva decision del usuario.
- Polling solo actualiza fechas/indicador; no crea tags ni repara niveles/permisos.
- Usuario confirma que todos los tags deben tener nivel ALTAS Y BAJAS. Lectura
  real del 18 octubre: ID del nivel 1, referencia 6344928 con horario 2/puertas 3.
  Resolver por nombre y validar referencia real, no fijar IDs a ciegas.
- Alta/recuperacion sin vigencia API crea o recupera vencido; datos ya existentes
  fuera de API se conservan. Asociacion/registro del vecino se hace en la web,
  sin modificar dinero ni cortes para habilitar una prueba.
- No cambiar horarios, puertas u otras configuraciones con el polling de fechas.
- Un evento autorizado no demuestra por si solo que un vehiculo cruzo.
- Los tags con numero impreso borrado se pueden intentar identificar presentandolos
  en la antena de la pluma y leyendo el numero del evento; no es una programacion
  fisica del tag. Captura por nuestra herramienta aun no implementada.

## Concurrencia y operacion de caseta

- Tarea principal SanIsidro-Vigencias, Dell interactivo, Highest, arranque al
  iniciar sesion. No hay inicio automatico de sesion confirmado; PC encendida no
  garantiza polling tras reinicio si nadie inicia sesion.
- Tarea SanIsidro-Vigilancia: comprueba salud; alerta a los 5 min, repite a los
  15 min, ventana hasta 20 s solo en falla, autorizada por el usuario.
- Polling normal oculto para no cubrir las camaras; espera 60 s entre ciclos.
- `sync.lock` es bloqueo de Windows mantenido durante todo el proceso continuo;
  no basta intentar consultar durante su espera ni borrar el archivo.
- Preparar mantenimiento desde el gestor antes de utilidades manuales; despues
  Terminar y reanudar. r2 tiene parada cooperativa y estado protocol 2.
- ZKAccess no respeta nuestro bloqueo. Su boton de sincronizacion general recarga
  configuracion amplia; no usarlo como mecanismo normal de actualizacion de fechas.
- Backups protegidos por DPAPI para Dell/equipo; preservar siempre
  `ZKSync\respaldos\depuracion_20261014_001046_900359`.

## Incidente de niveles: evitar repetir un diagnostico descartado

El usuario reporto tags sin nivel. Se identifico una fragilidad del gestor: para
usuarios existentes no completa niveles, recuperados conservan los historicos y
altas nuevas copian referencia sin exigir el nombre ALTAS Y BAJAS.
Sin embargo, la lectura real NO confirmo que faltaran niveles en los ejemplos:

- Diagnostico de 27: 26 con nivel y permisos esperados; 12206282 falta Access/C3.
- 6704458, 5326541 y 12211817: nivel ALTAS Y BAJAS y permisos 2/3 presentes.
- 6704458 tenia vigencia API/Access/C3 hasta 2026-11-05; usuario no lo probo
  fisicamente recientemente, no hay rechazo actual confirmado.
- 5326541 y 12211817 primero estaban fuera de API/vencidos; ciclo del 18 octubre
  16:56:32 aplico y verifico sus nuevas vigencias desde API. Fecha nueva exacta y
  paso fisico no mostrados en ese extracto.

No preparar reparacion masiva ni afirmar fallo general del gestor por nivel
faltante sobre esos registros. El endurecimiento de esa validacion sigue pendiente.

## Propuesta de arquitectura web, aun por desarrollar

Pantalla web <-> backend Laravel existente <-> agente de caseta <-> SDK/C3.
El agente envia estado/eventos al backend y recoge solicitudes autorizadas.
La pantalla consulta backend; no necesita acceso directo del navegador a la DLL
o a la IP privada de la controladora.

Funciones propuestas:
1. Salud, ultimo ciclo correcto, errores y datos con fecha de ultima comprobacion.
2. Consulta de tag: asociacion web, vigencia API, existencia/fechas/nivel/permisos
   realmente leidos y cambios pendientes.
3. Eventos recientes e historial, identificando motivo y lectora cuando se conozcan.
4. Captura de numero al presentar tag en antena, con seleccion y confirmacion del
   operador para no asociar otra lectura del trafico normal.
5. Altas/recuperaciones mediante solicitudes y resultados verificables.

Recomendacion por etapas: primero lectura/estado/consulta; luego captura y
operaciones. Estados de operaciones propuestos: solicitado, pendiente, aplicado
y verificado o error. No mostrar exito solo porque la web acepto una solicitud.
Diseñar autenticacion propia del agente y permisos de admin/vigilancia en backend,
registro de operaciones, reintentos, persistencia local ante falta de Internet y
deduplicacion. No se han elegido contratos, tablas, transporte ni frecuencias.

## Codigo existente inspeccionado el 23 de octubre

- `frontend/src/pages/VistaVigilancia.jsx` y `frontend/src/pages/Tags.jsx`:
  ya existen; no son la nueva pantalla ni monitorean actualmente estos eventos.
- `backend/app/Http/Controllers/Api/ZkApiController.php` calcula vigencias.
- `backend/routes/api.php` expone GET `/vencimientos` sin middleware de token en
  esa ruta, pese a comentario de token separado. No suponer autenticacion actual
  ni copiar esa exposicion a funciones nuevas. No se modifico esa ruta.
- No se encontraron endpoints de ingesta de eventos/estado o cola de comandos en
  el archivo de rutas inspeccionado.
- Reutilizar instancia Axios, diseno y estructura pages/[PageName]/hooks/components.
- Hay cambios locales y tools sin seguimiento; inspeccionar Git y preservar trabajo
  ajeno antes de editar. No se hicieron commits ni despliegues en este cierre.

Para historia detallada ver `learnings.md`; manuales de caseta y herramientas estan
en `tools/zkaccess/`. Las lecturas reales se documentan por salidas compartidas
por el usuario, no por acceso directo de este entorno a la caseta.

## Lector diagnostico aislado — 2026-10-23

Autorizado por el usuario preparar la lectura usando solo la DLL x86 instalada,
con pausa/reanudacion desde el gestor; pantalla y endpoints excluidos por ahora.
Preparado localmente `tools/diagnostico_eventos/`, release 2026.10.23-1.
Manual con fuentes y comandos en `LEEME.md`: firmas de PullSDK v2.0 contrastadas,
preflight sin conexion exige PE x86, hash del inventario conocido y exportaciones.
No se descargaron ni registraron SDK/bibliotecas. Soporte efectivo del firmware
y estado remoto actual siguen pendientes de comprobar en caseta.

El lector toma sync.lock durante la sesion, exige mantenimiento activo y tarea
deshabilitada/no Running, consulta transaction filtrada (opciones vacias) y RT.
Usa procesos A/B independientes, invierte orden de lectura, compara relecturas,
consulta historial antes del RT del otro cliente y reconecta con un proceso C.
Conserva buffers originales completos, payload, retornos, hashes y tiempos UTC;
separa estado 255 de eventos, sin inferir paso fisico ni mapa de plumas.
Siete pruebas simuladas locales aprobadas (sin DLL/red/hardware), incluyendo
conservacion ante error y cierre de clientes. La primera ejecucion encontro una
restriccion del sandbox sobre temporales; corrida completa fuera de el aprobada.

Pendiente: capturas de tag conocido, comparar tupla exacta y
persistencia historica, estado del polling y dos ciclos correctos tras reanudar.
No afirmar que consultar no consume cache ni que otros clientes no se afectan.
La prueba cubre nuestros procesos; ZKAccess, New Record y concurrencia con el
polling instalado quedan sin validar. No abrir ZKAccess para una prueba conjunta
sin revisar antes sus ajustes de sincronizacion de hora/configuracion.

Preflight real confirmado por salida del usuario el 2026-10-23 19:50:59 Mexico
(2026-10-24T01:50:59.480286+00:00): paquete 2026.10.23-1 verificado;
DLL instalada x86 con SHA256 esperado 82bda08dbbab24b918ebe7de68eeb3e4fb952f275eecc992cb9148c5384a413a;
Python x86 3.13.13 en Dell; exportaciones Connect, Disconnect, GetRTLog,
GetDeviceData, GetDeviceParam y PullLastError disponibles. No hubo conexion C3.
Pausa del gestor, lectura de eventos y reanudacion siguen pendientes de evidencia.

Actualizacion de alcance confirmada por usuario el 2026-10-23: opera remotamente,
no esta fisicamente en caseta. La captura con presentacion controlada queda
pendiente de colaboracion presencial. Preparado release local 2026.10.23-2 del
lector, con --historial para consultar transaction por numero sin presentar tag
ni llamar GetRTLog. Conserva cinco respuestas (A, relectura A, B, A tras B y C tras
reconexion), compara filas con multiplicidad e informa vacios sin afirmar evento.
Ocho pruebas simuladas aprobadas, sin DLL/red/hardware. ZIP release 1 preservado;
release 2 se entrega para carpeta separada. Mantiene DLL instalada, hash, firmas,
bloqueo y mantenimiento desde el gestor. Ejecucion historica real y efectos en
clientes/RT siguen pendientes; no inferirlos de las pruebas simuladas.

Primera consulta real release 2 compartida por usuario, 2026-10-23 19:55:53 Mexico:
tag 6344928, paquete verificado, evidencia en
`C:\SanIsidro\DiagnosticoEventos_20261023_r2\registros\20261023_195553_026248`.
Interrumpida con A_0004_GetDeviceData_transaction, retorno SDK -2 (sin respuesta).
La secuencia del codigo situa esa llamada en A_after_B: A habia consultado y
releido, y B habia conectado/consultado sin abortar. No se aportan aun filas ni
conteos; no afirmar eventos encontrados. Posible interferencia de sesiones,
no causa demostrada por una sola ejecucion. Revisar resumen y buffers conservados
antes de repetir; reconexion C no alcanzada. Se solicito reanudar desde el gestor;
reanudacion y dos ciclos correctos siguen pendientes de evidencia.

Evidencia posterior del usuario, 2026-10-23: A_first=121, A_reread=121 y
B_after_A=121, retornos SDK 121. Lectura real de transaction para 6344928 confirmada;
campos Cardno, Pin, Verified, DoorID, EventType, InOutState, Time_second.
Muestra Pin 666670 / Verified 4: DoorID 2, EventType 0, InOutState 1,
Time_second 861719592; DoorID 1, EventType 0 y 20, InOutState 0,
Time_second 861722858. Conversion segun anexo 4 PullSDK: 2026-10-23 14:33:12 y
15:27:38 del reloj del controlador, sin certificar zona/desfase actual.
Anexo 6: 0=Normal Punch Open, 20=Too Short Punch Interval. No inferir vencimiento
por codigo 20, ni paso fisico por 0. Mapeo fisico de plumas aun pendiente.
Igualdad de conteos no demuestra igualdad de contenido: comparar originales
guardados antes de concluir que releer preserva todos los eventos.

Reanudacion comprobada en esa misma salida: parada ordenada 19:54:40.520,
nuevo proceso PID 9452 iniciado 19:56:40 local; ciclos correctos 19:56:45.005
y 19:57:48.300, API=838, cambios Access/C3=0, no encontrados=5, ausentes API=117.
estado protocol=2, phase=idle, consecutive_errors=0, last_ok_utc
2026-10-24T01:57:48.297630+00:00. Polling saludable en ese momento; no se aporto
estado de vigilancia. Persiste sospecha de interferencia entre sesiones al
retornar a A tras B; RT, reconexion C y clientes externos siguen sin validar.

Comparacion original compartida por usuario el 2026-10-23: payloads A_0002,
A_0003 y B_0002 identicos por SHA256
DC04CB75A5D19EAF59F501BEEFDC1746C08F448BF4881F59DB9EE979717C7B70.
Confirma relectura y lectura desde B del mismo historial de 121 filas, sin consumo
de esos registros en la muestra. No prueba independencia de sesiones ni del cursor
incremental. Payload A_0004 con retorno -2 tiene hash
A099256903EE084BBCD238DA525987EF29A47FF5BD5EDEC1D8544C72E5A5467F;
sus bytes se conservan como evidencia de error, no como eventos validos.

Preparado localmente release 2026.10.23-3, modo --historial-secuencial: A consulta
y relee, cierra y confirma salida; B consulta y relee, cierra; C reconecta y consulta.
Mismo SDK instalado, reglas de mantenimiento y bloqueo. Imprime hashes/conteos
al guardar cada respuesta. Nueve pruebas simuladas aprobadas, incluida ausencia
de solapamiento de clientes y cierre ante fallo. ZIP anteriores preservados.
Consulta secuencial real y comparacion tras reconexion siguen pendientes; no
repetir de momento la prueba de sesiones simultaneas. Polling instalado sin cambios.

Aceptacion real del historial secuencial compartida por usuario el 2026-10-23,
20:04:08 Mexico, release 2026.10.23-3 verificado. Evidencia:
`C:\SanIsidro\DiagnosticoEventos_20261023_r3\registros\20261023_200408_814207`.
A_first, A_reread, B_after_A, B_reread y C_after_reconnect devolvieron 121 filas
del tag 6344928; cinco payloads con el mismo SHA256
dc04cb75a5d19eaf59f501beefdc1746c08f448bf4881f59db9ee979717c7b70.
Todas las comparaciones missing=0 y added=0. Lectura de historial filtrado con
opciones vacias y persistencia tras relectura/cierre/reconexion verificadas en esta
muestra. No equivale a validar RT, cursor New Record ni concurrencia con otros
programas; mantener una sesion propia a la vez y polling pausado para diagnosticos.
La muestra conserva dos eventos distintos (0 y 20) para el mismo tag/puerta/segundo:
no deduplicar futuras ingestas solo por tag y fecha. Reloj/zona y mapa fisico de
plumas siguen sin comprobar. Se solicito Terminar y reanudar; estado y dos ciclos
posteriores a ESTA prueba pendientes de recibir, sin reutilizar la evidencia de
19:57 como certificacion de la nueva reanudacion. No se modifico backend/pantalla.

Reanudacion posterior a release 3 comprobada por salida del usuario: PID 13864,
run_started_utc=2026-10-24T02:04:41.144103+00:00 (=20:04:41 Mexico del 23 octubre),
phase=idle, consecutive_errors=0 y last_ok_utc=2026-10-24T02:05:47.943564+00:00.
Parada ordenada 20:04:03.461; ciclos correctos 20:04:44.814 y 20:05:47.944,
API=838, cambios Access/C3=0, no encontrados=5 y ausentes API=117. Polling saludable
en ese momento. Estado de vigilancia no aportado.

Preparado localmente release 2026.10.23-4 con --observar-rt --seconds 60:
lectura base/relectura RT y observacion de trafico normal, sin pedir presencia
fisica ni numero conocido. Un cliente a la vez; conserva originales, distingue
muestra posterior a base / solo base / sin evento de tarjeta. Si hay muestra,
relee, consulta historial de su numero, cierra A, reconecta B y compara RT/historial.
No interpreta ausencia en cache como borrado historico ni acredita paso fisico;
correlacion exacta RT/historial y reloj aun pendientes. Once pruebas simuladas
aprobadas (sin DLL/red/hardware), incluida distincion de resultados y cierre ante
error. Mismo SDK instalado y protocolo de mantenimiento; sin cambios al polling.
Paquete preparado para ejecucion real remota; RT todavia sin validar.

Primera lectura real GetRTLog compartida por usuario el 2026-10-23, release 4
verificado. Evidencia:
`C:\SanIsidro\DiagnosticoEventos_20261023_r4\registros\20261023_201151_598029`.
Resultado rt_after_baseline_pending_review; muestra card=6348076, pin=724,
device_time_raw=2026-10-23 19:49:05, door_raw=2, event_code=0,
direction_raw=1, verification_raw=4. Identificacion/parseo de evento RT reales
confirmados; la tupla no reaparece en relectura ni tras reconexion secuencial.
Historial del tag antes/despues=179, missing=0, added=0. No inferir por ello
borrado de historial, consumo global de cache ni comportamiento de ZKAccess.

Observacion temporal: hora del evento anterior en unos 23 minutos a la carpeta
de inicio (20:11:51 segun PC). Puede ser evento acumulado o diferencia de reloj;
no afirmar lectura recien generada ni desfase del controlador sin revisar estados
RT y tiempos de llamada. Correlacion exacta con historial pendiente: la formula
documentada convierte 2026-10-23 19:49:05 a Time_second=861738545, sin asignar zona.
Se solicito reanudar por gestor; estado y dos ciclos posteriores a release 4
pendientes. No cambiar/sincronizar reloj ni repetir captura hasta revisar originales.

Correlacion RT/historial confirmada por salida posterior del usuario: history_A
contiene Cardno 6348076, Pin 724, Verified 4, DoorID 2, EventType 0,
InOutState 1, Time_second 861738545, exactamente la tupla RT seleccionada
2026-10-23 19:49:05 tras conversion documentada de fecha.
Primera fila de cada respuesta: baseline=19:48:32/codigo 0;
baseline_immediate_reread=19:49:05/0; observation referencia esa misma respuesta;
immediate_reread=19:49:06/20; rt_after_reconnect=19:49:31/0.
Son eventos diferentes, no reapariciones de la tupla seleccionada. Secuencia
compatible con entrega de registros pendientes; no prueba reloj desfasado ni
generacion durante la ventana. Revisar tiempos UTC de llamadas o estado/reloj
del dispositivo antes de certificar frescura. No se alcanzo estado RT 255 en las
primeras filas compartidas; no afirmar que se vacio la cache.
El modo release 4 termina al encontrar un evento distinto de la base, por lo que
--seconds 60 es una ventana maxima y no significa que haya esperado 60 segundos.
Recepcion/parseo RT y correlacion historica comprobados en esta muestra; quedan
pendientes frescura/cola, reloj, mapa fisico, clientes externos y reanudacion
posterior a release 4. Futuro diseno debera conservar fecha de equipo y recepcion
por separado y coordinar un unico lector propio; aun sin endpoints ni pantalla.

Tiempos de llamadas compartidos por usuario, misma prueba release 4:
- baseline: PC 2026-10-24T02:12:01.717890+00:00, evento 19:48:32.
- baseline_immediate_reread: PC 02:12:01.854246 UTC, evento 19:49:05.
- immediate_reread: PC 02:12:01.971783 UTC, evento 19:49:06/codigo 20.
- rt_after_reconnect: PC 02:12:06.822938 UTC, evento 19:49:31.
Los eventos avanzan 33 segundos entre llamadas separadas por 0.136356 segundos;
el conjunto avanza 59 segundos en unos 5.105 segundos de recepcion. Hay entrega
de registros pendientes, no flujo generado al ritmo de recepcion. Esto no prueba
que el reloj este correcto ni permite atribuir los ~23 minutos a desfase real.
Cache vacia/estado actual, reloj y mapeo fisico siguen pendientes de comprobar.

Reanudacion posterior a release 4 verificada: PID 16496, arranque
2026-10-24T02:12:18.530857+00:00, phase idle, consecutive_errors=0,
last_ok_utc=2026-10-24T02:16:34.998501+00:00. Parada ordenada 20:11:47.465;
cinco ciclos correctos 20:12:22.143, 20:13:25.578, 20:14:28.800, 20:15:31.852
y 20:16:35.000 Mexico. API=838, cambios Access/C3=0, no encontrados=5,
ausentes API=117. Polling saludable al ultimo instante aportado. Vigilancia sin
nueva evidencia. La prueba no modifico archivos operativos ni configuro reloj.

## Diseno propuesto tras las lecturas reales — aun sin implementar

Propuesta tecnica derivada de las muestras, pendiente de validacion del usuario
antes de implementar varios componentes. No autoriza despliegue ni reemplazo
del polling instalado.

- Un coordinador de caseta serializa todas las operaciones propias del SDK.
  No agregar un lector continuo independiente compitiendo con r2: su sync.lock
  se mantiene durante todo el proceso y se observo un -2 tras una segunda sesion.
  Una proxima version debe coordinar fechas y lectura de eventos, con un solo
  acceso SDK a la vez, conservando prioridad de vigencias y parada del gestor.
- Separar salud de PC/agente, salud del polling, comunicacion C3 y frescura de
  eventos. Una consulta SDK correcta no acredita que la cola este al dia.
- Guardar respuesta original y campos de evento comprobados, equipo de origen,
  hora sin interpretar del controlador, recepcion UTC en caseta y recepcion UTC
  en backend. No corregir timestamps originales ni llamar paso fisico a codigo 0.
- Persistir en caseta antes del envio HTTPS; Laravel confirma recepcion durable
  por lote/evento. Reintentos identificados con IDs locales persistentes. No
  imponer unicidad solo por tag/fecha; estrategia para solapar recuperacion
  historica pendiente, conservando multiplicidad y todos los campos reales.
- Agente con credencial propia revocable, permisos de ingesta definidos en
  backend; no copiar exposicion actual de /vencimientos. Envio saliente HTTPS
  al Laravel existente. Inventario/estado del dispositivo no decide vigencias.
- API sigue siendo unica autoridad de vigencias; ausencia conserva politica
  vigente. Ingesta de evento no crea asociaciones, pagos ni autorizaciones.

Etapas propuestas:
1. Completar comprobacion de fin de cola/estado actual, reloj sin escribirlo y
   mapa fisico de puertas; ya estan verificadas extraccion y correlacion historica.
2. Disenar y validar coordinador/almacen local en carpeta separada, con reintentos,
   reconexion, ejecucion serial y conservacion de la sincronizacion de fechas.
3. Ingesta autenticada de estado y eventos en Laravel existente, con confirmacion
   durable, limites de lotes y reintentos sin duplicar entregas.
4. Consulta web y captura asistida, distinguiendo lecturas acumuladas de las
   posteriores a armar la captura. Presencia de una tarjeta desconocida no basta
   para asociarla automaticamente por el trafico normal.
5. Solicitudes de alta/recuperacion autorizadas por backend, resultados leidos y
   verificados en caseta y conciliacion de fallos; no declarar exito al encolarlas.
   Sin permisos/fechas arbitrarios desde el navegador. Diseno detallado pendiente.

No se eligieron aun nombres definitivos de tablas/rutas ni se implementaron
endpoints, pantalla o agente permanente. Para ahora, conservar polling reanudado.

## Siguiente diagnostico autorizado — 2026-10-23

Usuario autoriza continuar con fin de cola/reloj/mapa. Sobre plumas solo recuerda
nombres en el sistema Pluma 1/Pluma 2; no confirma asociacion con DoorID ni su
correspondencia fisica entrada/salida. Mantener este punto pendiente.

Preparado release local 2026.10.23-5, --revisar-cola --seconds 60
--max-consultas 300: una sesion, consultas RT espaciadas 200 ms mas su duracion,
originales conservados, parada por dos respuestas 255 separadas al menos un
segundo sin eventos/vacios/mixtos entre ellas, o por limite. No borra historial.
No afirmar fin de cola si solo hay respuesta vacia o se llega al limite.
Guia PullSDK v2.0 anexo 2 marca DateTime Write only: no se intenta lectura no
documentada ni sincronizacion de hora. Usa hora de estado 255 para comparacion
relativa con PC (inicio/fin local con offset, UTC, clave de zona Windows leida),
sin certificar NTP del PC ni zona/DST del controlador. Ninguna escritura SDK.
Trece pruebas simuladas aprobadas, incluyendo limites, estados y cierre ante
error. Mismo hash/DLL32 instalada, mismo mantenimiento y bloqueo. Paquete nuevo
en carpeta separada; no sustituye polling, gestor ni bibliotecas. Ejecucion real
y aceptacion de esta etapa aun pendientes, sin endpoints ni pantalla nuevos.

Resultado real release 5 aportado por usuario el 2026-10-23. Paquete verificado;
evidencia `C:\SanIsidro\DiagnosticoEventos_20261023_r5\registros\20261023_202558_934759`.
56 consultas RT, 51 filas de eventos recibidas y 5 filas de estado; resultado
two_status_responses_pending_clock_review. Se alcanzo estado 255 y se confirmo
de nuevo sin eventos intermedios segun criterio del lector. Confirma un punto
sin eventos temporales a entregar en esas consultas; no garantiza que la cola
permanezca vacia ni identifica 51 eventos unicos. Respuestas originales conservadas.

Muestras de estado:
- Cola_A_0053: device_time_raw=2026-10-23 20:26:21; PC local
  20:26:25.722796-06:00 a 20:26:25.819634-06:00; diferencia relativa -4.771 s.
- Cola_A_0057: misma hora de estado 20:26:21; PC local
  20:26:26.938073-06:00 a 20:26:27.034915-06:00; diferencia relativa -5.986 s.
- Zona Windows leida: Central Standard Time (Mexico), llamadas de unos 0.097 s.

La hora del estado se repite identica mientras el PC avanza unos 1.215 segundos.
Por ello no certificar un desfase fijo del RTC de 5/6 segundos ni tratar el campo
como reloj continuamente actualizado. Puede tener resolucion/actualizacion propia;
semantica exacta pendiente. No se escribio/sincronizo hora. La entrega anterior
de eventos con ~23 minutos de antiguedad no sirve para medir desfase del reloj.
Fin de cola temporal observado y correlacion RT/historial ya comprobados; reloj
interno exacto, zona/DST del controlador y mapa fisico de plumas quedan pendientes.
Se solicito Terminar y reanudar; estado y dos ciclos posteriores a release 5
pendientes de evidencia. No dar por vigente el estado de 20:16:35 para esta prueba.

Reanudacion tras release 5 confirmada por salida del usuario: PID 13060,
run_started_utc=2026-10-24T02:26:37.427664+00:00 (=20:26:37 del 23 octubre),
phase idle, consecutive_errors=0, last_ok_utc=2026-10-24T02:27:44.291472+00:00.
Parada ordenada 20:25:53.230; ciclos correctos 20:26:40.870 y 20:27:44.292,
API=838, cambios Access/C3=0, no encontrados=5 y ausentes API=117.
Polling saludable al ultimo momento aportado; vigilancia sin nueva consulta.

Propuesta concreta de coordinador/contrato de ingesta preparada en
[control-acceso-diseno-integracion.md](control-acceso-diseno-integracion.md),
basada en cycle()/worker()/main(), protocolo 2, mantenimiento y rutas/modelos
Laravel inspeccionados. Incluye rutas/entidades propuestas, autenticacion separada,
ACK durable y deduplicacion de entregas distinta de reconciliacion historica.
Ninguna ruta, tabla, pantalla o agente permanente implementados. Nombres y
parametros del diseno son propuestas, no estado actual. Confirmar el diseno antes
de desarrollar varios componentes y conservar la instruccion vigente del usuario
de no implementar pantalla ni endpoints durante la validacion de lectura.

## Primera entrega Laravel confirmada e implementada localmente — 2026-10-23

Tras cerrar la validacion de lectura y revisar el diseno, usuario confirma con
"Confirmo" la primera entrega: backend local para estado/eventos, autenticacion
del agente, almacenamiento y pruebas. Esta decision habilita esos endpoints
locales; pantalla, operaciones de alta/recuperacion y despliegues siguen fuera.

Implementados POST /api/control-acceso/agente/estado y /lotes, middleware propio,
comando control-acceso:agente crear/rotar/revocar y migracion de cinco tablas
control_acceso_*. Credencial aleatoria por agente/controlador, solo hash en BD,
sin cuentas humanas. Reportes de estado separados, respuestas SDK originales en
base64/SHA256 y filas derivadas por Laravel; 255 como estado, formatos desconocidos
conservados sin inventar eventos, tiempos del dispositivo sin asumir UTC.
ACK durable transaccional e idempotencia por reporte/lote; no colapsar filas por
tarjeta/segundo. No hay escrituras en tags, asociaciones, vecinos, pagos o vigencias.

Evidencia local: 17 pruebas nuevas / 128 aserciones aprobadas en SQLite en memoria,
incluidos rollback ante fallo durante insercion, revocacion entre middleware y
transaccion, separacion de autenticacion humana, limites, hash/bytes y reintentos.
Suite completa: 32 pruebas, 180 aserciones, 31 aprobadas y fallo del ExampleTest existente: espera 200 para GET /
y obtiene 404; routes/web.php ya estaba vacio en HEAD por arquitectura headless.
No modificar ese test como parte de acceso.

No se ejecutaron migraciones sobre bases existentes ni se instalaron cambios en
caseta. /api/vencimientos y polling permanecen sin modificaciones. MySQL de ensayo,
concurrencia real, provision de credencial, emisor/outbox, coordinador y despliegue
autorizado pendientes. Contrato y ejemplos ficticios en
[control-acceso-api-v1.md](control-acceso-api-v1.md).

## Ensayo MySQL completado — 2026-10-23

Usuario autoriza validar en MySQL aislado. XAMPP solo incluye MariaDB 10.4.32;
se preparo MySQL Community 8.4.13 desde ZIP oficial verificado, en carpeta ignorada
backend/storage/app/control-acceso-mysql-ensayo, solo 127.0.0.1:33379, sin servicio.
Base nueva sanisidro_ca_ensayo_4ddd6d01fa69 y credencial SQL aleatoria restringida.
No se cambiaron .env, bases existentes, endpoints de vigencias ni polling.

24 pruebas / 186 aserciones aprobadas: las 17 originales reutilizadas en MySQL,
mas concurrencia por procesos, reporte/lote repetidos, conflicto simultaneo,
revocacion/rotacion durante bloqueo, cinco tablas InnoDB, migracion reversible,
microsegundos y claves foraneas. Esperas verificadas mediante performance_schema;
ACK y rollback comprobados sin persistencia parcial. No hizo falta cambiar el
codigo de produccion de ingesta. Suite habitual excluyendo mysql-ensayo mantiene
32 pruebas / 180 aserciones, 31 aprobadas y fallo previo ExampleTest de GET /.

MySQL temporal apagado limpiamente: Shutdown complete 2026-10-24T04:44:12.918626Z.
Datos/resultados conservados localmente, secretos excluidos de Git y documentacion.
Detalle y repeticion en [control-acceso-ensayo-mysql.md](control-acceso-ensayo-mysql.md).
Pendientes emisor/outbox con servidor de ensayo y, despues, coordinador SDK y
transicion operativa autorizada. Produccion y caseta sin despliegues.

## Versionado local por etapas — 2026-10-23

Usuario confirma separar el trabajo en commits locales antes de continuar.
Lector diagnostico: 286aa62. Backend de ingesta: 83d78e1. Ensayo MySQL y contexto
se agrupan en un tercer commit. No se autorizo push ni despliegue. Cambios anteriores
de otros trabajos se conservan fuera de estos commits; credenciales y datos de la
instancia SQL temporal siguen ignorados por Git.

## Emisor y almacen local preparados — 2026-10-23

Usuario autoriza continuar con el emisor y sus pruebas. Implementado en
tools/agente_acceso, Python estandar, sin dependencias del polling ni SDK:
SQLite WAL/FULL, originales y lotes inmutables, reintentos con plazos persistentes,
leases, ACK validado contra identidad/hash/contadores y pausa ante errores que
requieren intervencion. Estado recibido como snapshot explicito; no se recolectan
archivos operativos todavia. DPAPI del usuario actual para secreto de ingesta.

23 pruebas aprobadas, incluidas tres con Laravel real/SQLite aislado, ACK perdido
despues del commit, reinicio, salida abrupta de proceso, SQLITE_FULL, rollback,
conflicto 409 y DPAPI real con secreto ficticio. Servidores temporales detenidos.
No cambios al backend, caseta, tareas ni vigencias. Disponibilidad SQLite/DPAPI en
Dell y prueba remota controlada pendientes. Detalle, limites y repeticion en
[control-acceso-emisor-local.md](control-acceso-emisor-local.md).

## Compatibilidad inicial del emisor en Dell — 2026-10-23

Usuario comparte ejecucion de Python32: Python 3.13.13, SQLite 3.50.4,
Consulta SQLite: 1 con una base en memoria. Importacion y consulta basica
confirmadas; SQLite en disco/WAL y DPAPI aun pendientes en esa computadora.

Paquete aislado Preflight_Emisor_2026.10.23-1.zip preparado en tools/agente_acceso,
SHA256 de69437863757601c3fdcaddc80be12b07e1356936153f8a37f669086a750159.
No importa SDK, usa red, modifica tareas ni solicita credenciales reales. Comprueba
WAL/FULL/FK, original y lote tras reapertura, leases, ACK simulado, integridad y
DPAPI del usuario actual en carpeta temporal propia; conserva resumen sin secretos.
13 comprobaciones aprobadas localmente en Python 3.12.5 x64, temporales retirados.
Ejecucion Dell pendiente. No se necesita Preparar mantenimiento para este paquete.

Resultado Dell confirmado posteriormente por salida del usuario:
PAQUETE VERIFICADO, status=compatible_local, Python 3.13.13 x86,
SQLite 3.50.4 y windows_user=Dell. Las 13 comprobaciones son true, incluidos
WAL/FULL/FK, originales/lotes recuperados, leases, ACK simulado, integridad SQLite
y cifrado/recuperacion DPAPI. temporary_files_removed=true. Inicio UTC
2026-10-24T05:14:22.225259+00:00; fin 05:14:22.616747+00:00 (=23:14:22 Mexico).
Evidencia C:\SanIsidro\PreflightEmisor_20261023\registros\20261023_231422_bb300c43.
Sin SDK, red, tareas, cambios de reloj ni credenciales reales. No se requirio pausa.
Esto no certifica entrega HTTP, otro usuario/Python ni arranque como tarea.
Siguiente pendiente: servidor/credencial de ensayo para enviar desde Dell; se
consulta disponibilidad de terminal SSH o alternativa, sin desplegar produccion.

Servidor: usuario confirma acceso SSH y comparte PHP CLI 8.4.20 (NTS, OPcache),
PDO mysql/sqlite. Prompt root@san-isidro-back en
/home/sanisidro-back/htdocs/api.sanisidro.info. El nombre deploy no produjo salida
en type -t; usuario identifica /root/deploy-sanisidro.sh como su comando real.
Contenido de ese script y estado de /root/repo-sanisidro pendientes de lectura.
No se ejecuto deploy ni se preparo instancia remota. Preservar ese flujo para el
despliegue final autorizado; ensayo en carpeta/base separadas antes de aplicarlo.

Script de deploy recibido posteriormente: fetch/pull en /root/repo-sanisidro,
backup de codigo, rsync --delete al docroot, Composer, cache, migraciones con
confirmacion y reload PHP-FPM. Solo apunta a produccion. Estado remoto informado
limpio: refactor-headless...origin/refactor-headless; hash remoto no aportado.
Usuario confirma SSH root@api.sanisidro.info. Preparado paquete de ensayo con
fuentes locales confirmadas y guardas de ruta/manifiesto/espacio/dependencias;
SQLite propia y servicio solo loopback mediante tunel SSH. Instalacion y envio
remotos aun pendientes. Ver [ensayo remoto](control-acceso-ensayo-remoto.md).

## Backend de ensayo preparado en servidor — 2026-10-24

Usuario comparte ejecucion correcta del paquete desde SSH: archivo presente de
82 KiB en /root, SHA256 OK, FUENTES VERIFICADAS y package:discover correcto.
Se crea tabla de migraciones y se aplica unicamente
2026_10_23_210000_create_control_acceso_ingestion_tables. ENSAYO PREPARADO,
serial TEST-C3-001 y agent_id=6b293548-0312-4d06-9c1d-3a7e79c9c5a0.
Configuracion/SQLite propias de /root/sanisidro-ensayos/acceso-20261023-1;
credencial informada en datos/credencial-ensayo.json, solo root, secreto no compartido.
La preparacion previa pegada por error en PowerShell no llego a ejecutarse;
la salida posterior desde root@san-isidro-back confirma esta preparacion real.
Siguiente: iniciar_ensayo.sh en primer plano y comprobar /salud por otra conexion
SSH. Arranque, tunel y entrega autenticada desde Dell pendientes. No se ejecuto
deploy, no se cambio la API de vigencias ni se contacto C3.

## Salud del ensayo remoto comprobada — 2026-10-24

Usuario arranca PHP de ensayo en 127.0.0.1:18880 y obtiene desde Dell por SSH/curl
/salud = ensayo_listo, device_serial TEST-C3-001. Luego Ctrl+C detiene PHP;
reiniciar y mantener terminal abierta para enviar. Esta evidencia no certifica
autenticacion del agente ni entrega de lotes. Cliente manual de fixtures preparado
en ensayo_dell.py, con identidad/destino limitados e importacion SSH directa a
DPAPI. No lee C3 ni estado real de ZKSync; no requiere mantenimiento. Importacion
real, tunel 18881, ACK y conteos pendientes. Ver ensayo-remoto para pasos/evidencia.

## Presentacion controlada preparada — 2026-10-24

Usuario confirma estar fisicamente en caseta con tag 12230693 y quiere probarlo.
Tambien comparte importacion SSH a DPAPI del cliente de ensayo: CONFIGURADO;
entrega remota por emisor todavia pendiente, sin secreto compartido.

Preparada captura_controlada.py, paquete Captura_Tag_C3_2026.10.24-1.zip en
tools/diagnostico_eventos, SHA256
4c4d10cfe73e5e31e9e446226584792b2c44750952ff9d7975c00b118eb01a33.
Reutiliza lector_eventos.py sin modificar firmas, DLL, hash, serial, bloqueo ni
guardas de mantenimiento. Una sola sesion a la vez; evita el ensayo antiguo con
A/B simultaneos que dio -2. Pausa/reanudacion exclusivamente desde el gestor.
Historial previo, base de dos estados 255 separados >=1 s sin eventos/vacios
intermedios (preparacion <=60 s/300 llamadas), ARMADO y una presentacion del tag
en hasta 60 s. Seleccion solo del numero solicitado; conserva todos los originales.
Relectura RT, historial posterior/relectura, cierre A antes de reconexion B y
consulta RT/historial. Compara tupla completa con Time_second y aumento de
multiplicidad respecto a antes, sin filas historicas faltantes. Nota fisica del
operador queda separada del evento; no demuestra cruce ni vigencia API.

18 pruebas simuladas aprobadas, incluidas 5 nuevas para tupla, multiplicidad,
historial antiguo/vacio, otro tag, base no confirmada, cierre/error y no solapar
clientes. Sin SDK/red/hardware. Primer intento bloqueado por permisos de temporales
del sandbox; repeticion fuera de este aprobada. Manifiesto y verificador PowerShell
correctos; ZIP anteriores preservados. No se modifico polling, emisor ni backend.
Captura fisica, correspondencia de pluma, respuesta real y reanudacion posterior
siguen pendientes de salida del usuario. No atribuir vigencia ni rechazo al tag
antes de obtener evidencia. Instrucciones en LEEME_CAPTURA.md dentro del paquete.

## Captura fisica de salida confirmada — 2026-10-24

Usuario comparte paquete verificado y captura_controlada.py --tag 12230693,
pluma observada salida. Evidencia remota conservada por el lector en
`C:\SanIsidro\CapturaTag_20261024\registros\20261024_185410_959611`.
Tras preparacion de base y ARMADO, evento recibido: device_time_raw
2026-10-24 18:54:41, card 12230693, pin 693, DoorID 2, EventType 0,
InOutState 1 y Verified 4. Operador anota "18:54 si abrio".
Asociacion fisica observada: DoorID 2 = pluma de salida en este controlador y
esta prueba. No inferir DoorID 1 = entrada ni equivalencia con nombres Pluma 1/2.

Tupla completa corresponde a Time_second 861821681 en transaction. Conteos de
esa tupla: history_before=0, history_after=1, history_reread=1,
history_after_reconnect=1. Ninguna fila historica previa faltante en las tres
comparaciones. Resultado rt_and_new_history_confirmed_pending_operator_review;
nota del operador recibida permite cerrar correlacion de la presentacion, evento
nuevo, persistencia y apertura observada. El evento no reaparece en relectura RT
ni RT tras reconexion; sigue en historial. No prueba entrega independiente a
clientes simultaneos/ZKAccess, cursor incremental ni ausencia universal de consumo.
Originales y metadatos quedan en carpeta remota, no transferidos a este repositorio.

Se confirma apertura reportada, no cruce del vehiculo, vigencia web ni exactitud
del reloj/zona del controlador. No se cambiaron pagos, permisos o vigencias con
el diagnostico. Emisor/backend de ensayo aun no recibieron este evento.
Lector muestra Cierre diagnostico. Solicitado Terminar y reanudar por el gestor;
reanudacion y dos ciclos correctos posteriores a ESTA captura pendientes de
salida del usuario. No reutilizar cierres saludables anteriores como evidencia.

Primera reanudacion posterior comprobada por salida del usuario: parada ordenada
18:53:44.510; nuevo proceso PID 11376 iniciado 2026-10-25T00:56:05.337368+00:00
(24 octubre 18:56:05 Mexico). Estado protocol=2, phase=idle, errores consecutivos 0,
last_ok_utc=2026-10-25T00:56:09.273568+00:00. Primer ciclo correcto 18:56:09.276:
API=838, cambios Access/C3=0, no encontrados=4, ausentes API conservados=116.
No atribuir la diferencia frente a los conteos historicos 5/117 al diagnostico:
4/116 ya figuraban antes de la pausa. Los ciclos 18:48-18:52 son anteriores a
esta captura; no cuentan para su cierre. Segundo ciclo posterior y estado de
vigilancia todavia pendientes de evidencia; no afirmar aceptacion de dos ciclos.

Cierre posterior confirmado por salida del usuario: ciclos correctos 18:56:09.276,
18:57:12.535 y 18:58:15.691 del 24 octubre, todos posteriores a reanudacion y
captura fisica. Los tres mantienen API=838, cambios Access=0/C3=0,
no encontrados=4 y ausentes API conservados=116. Requisito de dos ciclos cumplido;
prueba de lectura fisica de salida y reanudacion aceptada para esta ventana.
Estado de vigilancia no aportado. DoorID 1/entrada, equivalencia Pluma 1/2 y
entrega del emisor al backend de ensayo siguen pendientes; no se instala servicio
lector ni se modifica produccion por este cierre.

## Captura fisica de entrada confirmada — 2026-10-24

Usuario ejecuta el mismo paquete con --tag 12230693 --pluma entrada --seconds 60.
Evidencia remota: `C:\SanIsidro\CapturaTag_20261024\registros\20261024_190024_686953`.
Tras base RT y ARMADO se recibe evento device_time_raw 2026-10-24 19:01:04,
card 12230693, pin 693, DoorID 1, EventType 0, InOutState 0, Verified 4.
Operador anota "19:01 si abrio". Queda observado DoorID 1 = entrada, junto a
DoorID 2 = salida de la prueba previa, en este controlador. No se certifican los
nombres visibles Pluma 1/2 ni se generaliza direction_raw a otros controladores.

Correlacion completa con transaction Time_second 861822064. Conteos de tupla:
history_before=0, history_after=1, history_reread=1, history_after_reconnect=1.
Las tres comparaciones tienen cero filas historicas faltantes. Resultado
rt_and_new_history_confirmed_pending_operator_review, con nota fisica recibida.
No reaparece en relectura RT ni RT tras reconexion; el registro nuevo persiste en
historial. Lectura fisica, correlacion nueva y apertura reportada confirmadas;
no acreditar cruce, vigencia web, reloj exacto ni independencia de clientes.
Respuestas originales/metadatos quedan en Dell, sin transferencia al repositorio
ni envio al backend de ensayo. No se alteraron vigencias/permisos por la captura.

El lector termino con Cierre diagnostico. Solicitado Terminar y reanudar desde el
gestor; estado y dos ciclos correctos posteriores a ESTA captura de entrada
pendientes. Los ciclos 18:56-18:58 cerraron salida y no certifican esta reanudacion.

Cierre de entrada confirmado por salida posterior del usuario: parada ordenada
19:00:13.614, proceso nuevo PID 7468 iniciado 2026-10-25T01:01:32.009440+00:00
(24 octubre 19:01:32 Mexico). Estado protocol=2, phase=idle, consecutive_errors=0,
last_ok_utc=2026-10-25T01:02:38.941578+00:00 y last_error_type=null.
Dos ciclos correctos posteriores a entrada: 19:01:35.441 y 19:02:38.944;
ambos API=838, cambios Access=0/C3=0, no encontrados=4, ausentes API sin cambios=116.
Reanudacion aceptada para esta ventana. Ambas pruebas fisicas de entrada/salida
quedan cerradas con evento nuevo, historial persistente, apertura reportada y
polling reanudado. No se aporto estado de vigilancia; no se certifica reloj,
cruce fisico ni comportamiento de clientes externos. Siguiente etapa autorizada
pendiente: entrega ficticia del emisor Dell al backend aislado mediante tunel SSH,
sin volver a pausar polling ni consultar SDK para esa prueba.

## Entrega ficticia Dell a servidor validada — 2026-10-24

Tras fallo de conexion esperado y conservacion de pendientes, usuario comparte
envio por ruta privada de ensayo: acked/acked/idle, despues idle. Dos mensajes
confirmados, cero pendientes, tres originales con mismos UUID/bytes/hashes.
ACK lote informa 3 respuestas, 2 filas (1 evento y 1 estado255) y 1 error SDK
ficticio conservado sin interpretar. ACK received UTC 2026-10-25T01:29:58.934905Z;
estado a 01:29:59.460732Z. Entrega y reintento comprobados para fixtures, no para
los eventos reales del tag 12230693. Detalle en control-acceso-ensayo-remoto.md.
Se solicita detener servidor temporal y tunel con Ctrl+C al concluir; no tocar
polling ni borrar evidencias. Coordinador, tareas nuevas y despliegue pendientes.
