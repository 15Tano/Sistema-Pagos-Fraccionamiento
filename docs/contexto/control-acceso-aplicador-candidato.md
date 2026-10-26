# Aplicador candidato de vigencias

2026-10-25, hora de México. Usuario solicita trabajar en el aplicador local;
estimación comunicada30–45min para preparar/probar esta pieza, excluyendo
prueba real e instalación. No autorización para escribir en caseta o desplegar.
La comparación readonly previa de838registros, cierre y retorno siguen aceptados.

## Implementación local

- aplicacion_vigencias.py prepara un alcance de un tag existente en API/Access/
  C3. Reutiliza validate_api r2 verificado, conserva fechas oficiales incluso
  vencidas, START20200101 y set_valid_time=true. No inventa renovaciones,
  fechas20200102, altas, asociaciones, pagos ni reparación de niveles.
- Approval requiere confirmación explícita y hash del plan exacto, snapshot
  propio, TTL60s y uso por componente. Representa una autorización ya obtenida
  por el futuro padre; hash/booleano NO son autenticación, firma o permiso de
  backend. No hay CLI que emita una aprobación real. Tests crean solo ficticias.
- execute reconsulta API al iniciar y antes de cada componente, verifica datos
  actuales contra plan, guarda plan/backup e intenciones exclusivos con fsync
  antes de escribir. Si C3 requiere cambio, Access espera resultado verificado
  de C3. Si API cambia entre componentes, no aplica la fecha obsoleta en Access.
- AccessDates exige autocommit=false, actualiza solo tres campos USERINFO con
  WHERE optimista por USERID/CardNo/fechas/flag anterior y parámetros/IS NULL;
  relectura antes de commit, rollback si aún es posible. Commit confirmado pero
  ACK fallido puede haber persistido: no afirmar deshacerlo por llamar rollback.
- puente_sdk_fechas.py enlaza SetDeviceData con los mismos cuatro argumentos
  ctypes de c3_panel r2, antes de Connect. Loader32/hash/exportaciones existentes,
  mantenimiento y serial exacto. Envía solo CardNo,Pin original,StartTime,EndTime
  a user; compara todos los campos y permisos después. No registra otro SDK.
- run_scoped_worker acepta solo el payload exacto de un tag, SHA y respaldo/
  intención vinculados al plan ya confirmado. Marker SDK exclusivo/fsync antes
  del Set; no replay de trabajador ya intentado/cerrado. Usa recibos de cierre
  del núcleo publicado; no guarda Password en backup/payload de escritura.
- Un intento parcial/incierto queda unconfirmed/requires_review. check_evidence
  reconstruye bloqueos desde intenciones/resultado faltante, parcial o corrupto,
  aun sin marca adicional. No reset/force ni restauración global automática.
  Un plan sin diferencias no provoca una escritura para demostrar el camino.

El callback futuro panel_apply debe comprobar recibo/salida/gate antes de
devolver ok; las interfaces inyectadas no sustituyen ese transporte. El padre
autorizado debe mantener sync.lock y transmitir aprobación sin reiniciar TTL.
El respaldo implementado es de fechas e identidad, no del perfil completo.
Antes de escritura real faltan respaldo protegido del registro/permisos/MDB,
recuperación selectiva y autorización revisada de un alcance concreto.

## Preparador real solo lectura

preparar_aplicacion.py/lanzar_preparacion_aplicacion.ps1 leen API primero,
Access readonly de un tag y C3 a través del puente readonly ya aceptado. Si
falta en API/Access no consultan siguientes componentes. No instancian Approval
ni ofrecen --aplicar. Resultado plan_propuesto.json y hash, approval_issued=false.

Padre x64/DPAPI existente, trabajadores32 sin heredar SANISIDRO_*. Pausa por
gestor, lock instalado, referencia r2/hash y revisión de ledger antes de abrir;
parada propia ligada a PID/UUID. Cierre de conexión readonly en finally, recibos
y ausencia de procesos antes de stopped. Se reutiliza verificador del puente
para estado propio dentro de esta carpeta nueva; no estado_cierres anterior.
No RT, envío, outbox ni servidor/túnel de ensayo. No necesita tag físico.

Un plan rechazado con cierre SDK confirmado puede quedar stopped/plan_created
false; no implica aprobación ni fallo de cierre. Fault exige conservar
mantenimiento/evidencia. Solo cierre_puente_confirmado permite reanudar por
gestor, luego dos ciclos nuevos. No ejecutar verificación con polling activo.

## Pruebas

43 casos nuevos:33 de aplicación/binding ficticio,5 del preparador ficticio y
5 con ACE/ODBC real sobre MDB nuevos exclusivos bajo datos/pruebas_access_aplicador.
No caseta, credenciales reales ni escrituras SDK reales.

Cubren hash/confirmación/TTL/alcance, tag ausente, copia inmutable, respaldo
antes de intentar, API cambiante, snapshot concurrente, fallo C3/Access y commit
incierto, reinicio con intenciones sin resultado, resultado parcial y backup/
intento alterados. Aplicador sin cambios no escribe. Binding prueba ABI antes
de Connect, cuatro campos, permisos/Group alterados y código SDK negativo con
intento efectivamente alcanzado; no basta fallo previo del fixture.

Cinco pruebas ACE reales: update y lectura posterior conservan nombre,
privilegios, membresías y otro tag; fechas NULL/IS NULL; cambio entre SELECT y
UPDATE detectado por WHERE; rollback tras verificación fallida; commit que
persistió antes de perder confirmación no se presenta como deshecho. MDB con
datos ficticios creado por ADOX, conexiones/cursors cerrados y temporal propio
limpiado. Sin abrir la MDB de producción ni Access de caseta.

Paridad de flags/fechas contra cycle readonly r2 real con ODBC/API sustituidos,
incluyendo NULL/False/vencidos. Preparador comprueba orden API/Access/C3,
rechazos tempranos, readonly/autocommit, ninguna aprobación ni opción apply.
Suite completa final:306pruebas en44.061s, fallos0. Sintaxis Python/PowerShell y
hashes/rutas de fuentes verificados. Ejecución fuera de sandbox para pruebas
previas Laravel loopback/DPAPI ficticio; la nueva ACE local también aprobada.

## Publicación y siguiente paso

Aplicador_Candidato_2026.10.25-2.zip:56archivos,146902bytes, SHA256
d39fe1bac6809f6aad9881e20e8a05fcc0223f1967ec670f19e5f27f07c3eaa7.
55fuentes más manifiesto; incluye46archivos íntegros del Puente_Readonly1.
Nueve fuentes nuevas; la prueba ACE local no se exige ni incluye en el paquete
de simulación32. Prototipo interno1 conservado sin sobrescribir bajo
datos/paquetes_no_publicados; nunca fue entregado/ejecutado en Dell.

ZIP2 extraído y verificado en Windows PowerShell, comparación byte por byte
de dependencias y simulación final38pruebas/fallos0/errores0/omisiones0:
simulation_ok, ended_utc=2026-10-26T00:31:57.636470+00:00 (=25oct18:31México).
Primer paso Dell: verificar/simular en C:\SanIsidro\AplicadorCandidato_20261025,
sin mantenimiento/SSH/DLL/Access/red/tareas reales. Salida Dell pendiente.
Guía LEEME_APLICADOR_CANDIDATO.md con comandos exactos; no sobrescribir ZIP.

Después de revisar simulación, preparar plan real readonly de un tag. Ejemplo
12230693 fue probado físicamente; presencia API/fechas actuales no se asumen.
Si falta o todo coincide, no crear/renovar/manipular fechas/pagos para forzar un
ensayo. Revisar el plan antes de pedir autorización para cualquier aplicación.
Faltan transporte de aprobación, launcher de aplicación, recuperación protegida,
prueba real autorizada, runner continuo/gestor/vigilancia y transición. No nuevos
endpoints/pantalla o deploy en esta entrega. Última salud remota sigue siendo
PID14524/last_ok23:46:59.902633Z; pruebas locales no la renuevan.

## Simulación Dell aprobada — 2026-10-25 México

Usuario verifica Aplicador_Candidato_2026.10.25-2 y ejecuta con Python32:
simulation_ok,38pruebas/failures0/errors0/skipped0,
ended_utc=2026-10-26T00:36:21.304002+00:00 (=25oct18:36México).
Evidencia: C:\SanIsidro\AplicadorCandidato_20261025\registros\simulacion_aplicador_20261025_183621_303959.json.
Sin SDK/red/DPAPI/Access/tareas reales; no aplicación o aprobación real.

Siguiente operación indicada: pausa por gestor instalado y preparar alcance
readonly del tag12230693, conocido por captura física pero sin asumir presencia
API ni fechas actuales. Esperar FIN, verificar cierre propio antes de reanudar
y comprobar dos ciclos. No altas/recuperación/renovación para forzar plan;
no servidor SSH de ensayo. Plan real, cierre y retorno de esta pausa pendientes.

## Plan real readonly sin cambios y retorno comprobado — 2026-10-25 México

Usuario ejecuta lanzar_preparacion_aplicacion.ps1 -Tag12230693:
plan_created=true/error_type=null/phase=stopped/approval_issued=false.
API:2026-11-05 23:59:59; Access USERID1108, start2020-01-01 00:00:00,
end2026-11-05 23:59:59,valid_raw=true. C3 CardNo12230693/Pin693,
StartTime20200101/EndTime20261105. access_change=false/c3_change=false.
No fechas que aplicar; no forzar una reescritura o cambiar pagos para probar.
Plan SHA256:
709d7809d4259fb89847a2f5ef68aa15af1f69f1f3f6da9a4123fd3be2d58416.
API snapshot SHA256:
41cb69b00f166c4e6fdca6ac0bf2ba9c0372ca98b599545fb69130324836154c.

Padre PID10652/run_id=a4230256-23f4-4f6e-8e92-2eacba40c19b,
ended_utc2026-10-26T00:39:59.731896Z. Recibos17acumulados, uno de este run:
workera6912820-d6f6-40f7-9a57-d5ae8b7d4304/PID17224. Evidencia:
C:\SanIsidro\AplicadorCandidato_20261025\datos\sesiones\a4230256-23f4-4f6e-8e92-2eacba40c19b.
Confirma preparación con datos reales y cierre con recibos; no aplica cambios,
emite aprobación, consume RT o envía a ingesta.

Polling nuevo PID7264/protocol2/run_started2026-10-26T00:40:48.519232Z,
phase=idle/consecutive_errors0/last_error_type=null,
last_ok2026-10-26T00:41:56.150066Z. Dos ciclos correctos18:40:52.258 y
18:41:56.151 México25oct: API838/cambios Access0/C30/no encontrados4/ausentes
API116sin cambios. Parada anterior18:39:04.225. No se aportó tabla actual de
tareas, no inventar Enabled/State por estos datos. Retorno de proceso y ciclos
sí verificados; nueva vigilancia/estado de mantenimiento inactivo no aportados.

Falta en la salida --verificar-cierre/cierre_puente_confirmado del preparador.
Solicitar salida anterior/confirmación de si apareció antes de reanudar; no
inferir ejecución ni omisión, ni pedir repetir con polling ya activo u otra
pausa. No hay recibo final separado en esta versión: la comprobación imprime
resultado. Dato histórico pendiente; conservar polling saludable funcionando.

Comando SSH compartido devolvió /salud ensayo_listo/TEST-C3-001 y cerró sesión:
confirma servidor de ensayo existente, no un envío de este plan. Preparación no
necesita laboratorio/túnel ni usa ese marcador como identidad del controlador.

Usuario reproduce después el historial de esa ventana: simulación38casos,
SSH/salud, preparador con FIN y consulta de polling; no aparece en esa secuencia
el comando --verificar-cierre ni su salida. No prueba si se usó otra ventana;
no registrar cierre_puente_confirmado inexistente en la evidencia. No insistir
en buscar/repetir ni pedir otra pausa: conservar diferencia entre recibo SDK
del preparador + retorno correctos (verificados) y comprobación final separada
(sin documentar). No hay error actual aportado ni razón para detener r2.

## Pausa solicitada por traslado — 2026-10-25 México

Usuario pide pausar el trabajo porque debe trasladarse. Se detiene el desarrollo;
estimación comunicada15–25min pendientes para terminar/verificar la nueva pieza
local, excluyendo instalación. No tareas/ensayos activos iniciados en Dell por
este tramo. Dejar polling como quedó; no nueva pausa operativa ni prueba.

WIP local sin publicar: respaldo_protegido.py, recuperacion_selectiva.py,
puente_fechas_protegido.py y tests/test_respaldo_protegido.py. Snapshot selectivo
DPAPI con registro/permisos C3 completos y fechas Access; manifiesto público
solo con hash de cifrado/contexto, sin Password/plaintext. Hook guarda y verifica
snapshot antes del Set; recuperación genera plan nuevo contra API actual y
bloquea identidad/campos protegidos/permisos distintos. No restauración ni CLI
de escritura, ninguna DLL/C3 real contactada. ZIP2 y fuentes publicadas intactos.

Ejecución inicial de test_respaldo_protegido.py mostró33casos OK, pero10son
BindingTests importados de otra prueba: NO contarlos como nuevos. Pendiente
importar el módulo de fixtures en lugar de importar la clase TestCase para
evitar descubrimiento duplicado. Son23casos nuevos preliminares, con cifrado
y SDK ficticios. Falta revisión final, pruebas DPAPI nativas con datos ficticios,
suite completa, capacidad/retención del almacén, documentación y eventual ZIP.
No afirmar esta pieza terminada ni probada en Dell. Trabajo nuevo permanece
en archivos locales sin commit de implementación; este checkpoint sí documenta
la pausa. No reanudar hasta indicación del usuario.

## Respaldo protegido local terminado y paquete preparado — 2026-10-25 México

Usuario autoriza continuar después del traslado. Se retoma solo trabajo local;
ninguna nueva pausa, prueba, tarea o conexión a Dell/C3/producción en este tramo.
El estado remoto más reciente sigue siendo el polling PID7264 con dos ciclos
correctos18:40:52/18:41:56. Las pruebas locales no acreditan su salud actual.

Implementación nueva, sin modificar fuentes/ZIP publicados:

- respaldo_protegido.Store guarda snapshot selectivo DPAPI CurrentUser: siete
  campos user, permisos userauthorize y plan con fechas/identidad Access. No
  incluye MDB completa, historial ni membresías Access. Password solo cifrado
  o en memoria; manifiesto público vincula serial/card/UUID/plan y hash del
  cifrado. Roundtrip antes de guardar, fsync exclusivo y reapertura desde disco.
- ProtectedDatesPanel guarda snapshot y enlace durable antes del Set del
  binding candidato; fallos de cifrado/disco impiden alcanzar escritura SDK.
  Hook probado con SDK ficticio; no enlazado al run_scoped_worker anterior ni
  al polling. Futuro padre requiere sync.lock/gate, transporte de autorización
  y recibo de cierre comprobado antes de continuar. No hay CLI de escritura.
- recuperacion_selectiva.review vuelve a autenticar el snapshot y compara
  identidad/campos protegidos/permisos actuales. Si cambian, bloquea. Si solo
  difieren fechas propone plan nuevo contra API actual, incluida vencida. No
  restaura fecha vieja ni aplica/crea/repara niveles/emite Approval/resuelve
  marcadores pendientes. Es revisión de conciliación, no restaurador operativo.
- Admisión hasta1024snapshots/256MiB, reserva64MiB, snapshot1MiB/manifest8KiB.
  Rutas reparse/junction/symlink se rechazan también en ancestros. Sin borrado
  automático: incompletos cuentan y se conservan. Límite/contenido ajeno/disco
  insuficiente bloquean antes del Set. Requiere escritor único bajo bloqueo;
  no instala una política de retención ni sustituye copia portátil externa.

Corregido descubrimiento duplicado: fixtures se importan como módulo;31casos
nuevos ficticios y3DPAPI nativos,34nuevos reales en el conteo. Estos últimos
comprueban cifrado no determinista/roundtrip, reapertura desde proceso nuevo del
mismo usuario y corrupción aun con hash público actualizado. No se probó otra
cuenta/equipo/reinstalación Windows. Datos exclusivamente ficticios, ningún
Password de caseta. No prometer recuperación portátil con este respaldo.

Suite completa340pruebas,67.332s, fallos0/errores0/omisiones0; contiene las306
anteriores. Ejecución local ampliada por pruebas previas HTTP loopback/DPAPI;
sin producción/caseta. AST de fuentes nuevas y parser Windows PowerShell OK.

Respaldo_Protegido_2026.10.25-1.zip:65archivos,165098bytes, SHA256
728439c25f564b622ecd8abf06d195363ae2feec220a5cd2b483d2851e7e665b.
Incluye56archivos idénticos de Aplicador_Candidato2, ocho nuevos y manifiesto
propio de64fuentes. ZIP/manifest/rutas/dependencias comprobados byte por byte.
Extraído en datos/aceptacion_respaldo_20261025_r1: verificador PS aprobado,
simulation_ok/31tests ended_utc2026-10-26T01:52:38.649099Z y dpapi_ok/3tests
01:52:39.930906Z (=25oct19:52México), cero fallos/errores/omisiones.

Siguiente: descargar y ejecutar verificar_respaldo.ps1, simular_respaldo.py y
--comprobar-dpapi en Dell, carpeta nueva C:\SanIsidro\RespaldoProtegido_20261025.
Sin mantenimiento, SSH, SDK, MDB, credenciales instaladas o cambio de tareas.
LEEME_RESPALDO_PROTEGIDO.md contiene comandos exactos. Salida Dell pendiente.
No ejecutar lanzadores históricos incluidos para esta aceptación.

Siguen pendientes respaldo consistente MDB, recuperación operativa revisada,
transporte/launcher de aplicación autorizada y transición continua/gestor/
vigilancia. Antes de escribir realmente se requiere un alcance concreto con
diferencia y aprobación; no provocar cambios en12230693, cuyo plan coincidía.
UI/endpoints nuevos y despliegue quedan fuera de esta entrega.

## Aceptación del respaldo en Dell — 2026-10-25 México

Usuario comparte verificación correcta de Respaldo_Protegido_2026.10.25-1,
simulation_ok/31pruebas y dpapi_ok/3pruebas; en ambas failures0/errors0/skipped0.
Simulación ended_utc2026-10-26T02:09:02.949939Z y DPAPI02:09:04.282394Z
(=25oct20:09México). Evidencias:

- C:\SanIsidro\RespaldoProtegido_20261025\registros\simulacion_respaldo_20261025_200902_949888.json
- C:\SanIsidro\RespaldoProtegido_20261025\registros\dpapi_respaldo_20261025_200904_282346.json

Queda aceptada compatibilidad en Python32 de Dell: protección DPAPI nativa y
reapertura por un proceso nuevo del mismo usuario, usando únicamente datos
ficticios. SDK/cifrado sustituidos en las31simulaciones. No se abrió MDB/C3,
leyeron credenciales instaladas o cambiaron tareas/polling. Estas salidas no
actualizan la evidencia de salud del polling, no prueban otra cuenta/equipo ni
restauración real. No requiere mantenimiento ni repetir la aceptación.

Siguiente etapa pendiente: respaldo consistente de MDB y validación de su copia
aislada; después unión del transporte de aprobación/aplicación y recuperación
operativa. Mantener vigencias bajo autoridad de API, sin restaurar fechas antiguas
ni probar escrituras en un tag sin diferencias. No aplicación real autorizada
por estas salidas; preservar ZIP/publicaciones previas.

## Respaldo completo MDB candidato y validación local — 2026-10-25 México

Usuario indica continuar tras aceptar snapshot DPAPI en Dell. Se prepara y
prueba biblioteca separada respaldo_mdb.py; ninguna nueva pausa ni consulta a
caseta, SDK, API o producción. No hay CLI de respaldo/restauración real todavía.

Diseño: el futuro padre conserva sync.lock/mantenimiento y pasa guard. Fuente
abierta con CreateFileW GENERIC_READ/OPEN_EXISTING/share0, como el respaldo del
gestor revisado. Fallo por archivo abierto no cierra procesos ni hace fallback
compartido. Copia completa por bloques1MiB a UUID nuevo con ACL privada desde
creación (usuario actual/SYSTEM, herencia deshabilitada y verificación), fsync,
recuentos/tamaño y SHA256 de copia cotejado contra bytes leídos en exclusivo.
El handle se cierra antes de validar copia; fuente no abierta con ODBC.

ACE readonly/autocommitfalse abre solo la copia. Comprueba columnas mínimas y
COUNT(*) de USERINFO/CHECKINOUT/acc_levelset/acc_levelset_emp/personnel_issuecard
y compara identidad/fechas del tag contra snapshot del plan. Rollback y close
obligatorios, hash MDB igual antes/después. Recibo copy_verified exclusivo/fsync
al final; fallos conservan copia incompleta y no permiten devolver confirmación.
Plan copiado antes de callbacks; no aprobación ni fechas/C3/relaciones alteradas.
La copia conserva todas las tablas por igualdad de bytes, pero se consultan solo
las cinco indicadas. No se certifica integridad de todas las páginas ni ensayo
de restauración integral/conciliación operativa.

La MDB completa permanece como archivo Access bajo ACL, sin cifrado DPAPI
adicional de todo el archivo. Snapshot selectivo previo sí cifrado DPAPI.
No confundir ACL con cifrado de disco, portabilidad ni respaldo externo. El
archivo contiene datos personales: no versionar/subir/copiar como evidencia.
Máximo512MiB por MDB,32respaldos/2GiB y reserva64MiB; incompletos conservados y
contabilizados, sin borrado automático. Retención operativa aún por definir.

Dos incompatibilidades se reprodujeron y corrigieron solo en fuentes nuevas:

- ACE local interpreta Dbq y PWD envueltos en llaves literalmente al abrir
  MDB ficticia con contraseña. Nuevo conector usa ruta simple validada y PWD
  literal; rechaza separadores/control/espacios externos no representables.
  Contraseña nunca en argumentos/logs de operación, errores ODBC se sustituyen
  por error genérico. No prueba variantes. r2/gestor congelados intactos; este
  hallazgo no demuestra fallo en caseta ni certifica su credencial real.
- Get-Acl no autocargó Microsoft.PowerShell.Security en proceso WinPS lanzado
  desde Python bajo este host. Se usa Directory.GetAccessControl .NET para
  verificar DACL, sin depender de esa autocarga. Auxiliares no heredan SANISIDRO_*.

18tests ficticios y7nativos nuevos. Nativos con Win32/ACL/ACE/ODBC y MDB propia
creada por ADOX con contraseña conocida ficticia, dos usuarios, permisos e
historial: hash fuente/copia conservado, cinco tablas legibles, otro usuario e
historial presentes, conexión readonly rechaza UPDATE, fuente ocupada bloquea,
handle exclusivo impide nuevo lector/escritor y se libera, schema/contraseña
incorrectos no confirman, destino existente no sobrescrito. No datos reales.
Suite final365pruebas en68.505s, fallos0/errores0/omisiones0. Ejecución ampliada
para casos previos de loopback/DPAPI; nuevos casos nativos también en sandbox.
AST nuevo y parser WinPS de ambos scripts aprobados.

Respaldo_MDB_2026.10.25-1.zip:73archivos,183938bytes, SHA256
5c61899f824895a2ff1daeae6e4ecc0a370b7baadb24ce28124dbf11c0b7c99e.
65archivos de Respaldo_Protegido1 completos e intactos, siete nuevos y manifiesto
propio de72fuentes. Hashes/rutas/bytes verificados. Extraído en
datos/aceptacion_respaldo_mdb_20261025_r1: verificador PS correcto,
simulation_ok/18tests ended_utc2026-10-26T02:28:10.468450Z,
ace_ok/7tests ended_utc2026-10-26T02:28:31.834253Z (=25oct20:28México);
cero fallos/errores/omisiones. No sobrescribir publicación.

Siguiente: Dell, carpeta nueva C:\SanIsidro\RespaldoMDB_20261025, verificador,
simular_respaldo_mdb.py y --comprobar-ace con Python64 ya inventariado
C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe. No usar Python32
para ACE ni instalar driver/SDK. Sin mantenimiento/SSH/tag/cerrar ZKAccess para
esta prueba, solo MDB ficticias con limpieza propia y registros resumidos.
LEEME_RESPALDO_MDB.md contiene pasos exactos; salida Dell pendiente. No lanzar
scripts históricos incluidos. Revisión/aceptación real de MDB, unión al padre,
aplicación autorizada/recuperación y transición continua siguen pendientes.
No nueva evidencia de salud del polling por ejecutar pruebas locales.

## Aceptación del respaldo MDB ficticio en Dell — 2026-10-25 México

Usuario verifica Respaldo_MDB_2026.10.25-1 y ejecuta ambas comprobaciones con
Python64 ya instalado. simulation_ok/18pruebas, failures0/errors0/skipped0,
ended_utc2026-10-26T02:32:17.017068Z; ace_ok/7pruebas, mismos ceros,
ended_utc2026-10-26T02:32:30.207368Z (=25oct20:32México). Evidencias:

- C:\SanIsidro\RespaldoMDB_20261025\registros\simulacion_mdb_20261025_203217_017027.json
- C:\SanIsidro\RespaldoMDB_20261025\registros\ace_mdb_20261025_203230_207329.json

Aceptadas simulación y pruebas nativas ACE/Win32/ACL en Dell sobre MDB propios
ficticios, incluida contraseña ficticia, igualdad fuente/copia, exclusión,
lectura de las cinco tablas y rechazo de UPDATE en conexión readonly. No se
abrió/cambió Database_PRO.mdb instalada, consultó SDK/API, leyó credencial real
ni alteró tareas. No es aún respaldo de caseta ni aceptación de la credencial/
esquema/tamaño reales. No requiere otra simulación ni mantenimiento para cerrar
esta etapa. No renueva evidencia remota de salud del polling.

Siguiente trabajo: entrada real de respaldo bajo mantenimiento/sync.lock del
gestor, fuente/rutas fijas y credencial DPAPI existente en memoria, cierre y
recibo verificables. Preparar/probar esa unión antes de pedir pausa en Dell.
La obtención/validación de copia real, recuperación operativa y aplicación del
candidato siguen pendientes; no nuevas escrituras autorizadas por estas salidas.

## Lanzador de respaldo real preparado — 2026-10-25 México

Usuario indica seguir con la entrada real del respaldo. Implementada en fuentes
nuevas respaldo_real_mdb.py/lanzar_respaldo_real.ps1, con todas las dependencias
MDB1 intactas. No se ha ejecutado operación nueva en Dell, SDK/API o producción.

Rutas fijas: paquete C:\SanIsidro\RespaldoReal_20261025, MDB instalada y plan
readonly anterior de12230693 en AplicadorCandidato_20261025/sesióna4230256.
Se verifica el hash709d7809...58416 completo ya aceptado; no argumento de
origen/destino/clave/force/aplicar. El plan histórico solo coteja identidad y
fechas en la copia; no prueba API actual ni autoriza aplicación de su vigencia.
Si Access cambió, no forzar escritura/restauración para obtener coincidencia.

--preflight sin mantenimiento: x64/carpeta exacta, hashes r2 instalados, archivo
de plan y metadatos/tamaños de MDB/credencial/lock, capacidad del almacén. No
abre bytes MDB ni descifra credencial; no consulta SDK/API ni acredita clave/
esquema real o salud de polling. No crea estado operativo. Salida preflight_ok
pendiente de Dell, para revisar antes de pedir pausa por gestor.

Operación futura: bajo lock propio y sync.lock instalado, mantenimiento del
gestor, tarea Disabled/Enabledfalse, protocol2/stopped y PID previo ausente.
Bloquea otros lectores y revisiones/ledger SDK pendientes. Reutiliza copia
exclusiva/ACL/validación MDB ya aceptada, sin abrir C3. El lanzador descifra solo
access-password.dpapi; padre la retira del entorno y usa en memoria, limpia
SANISIDRO_* antes de auxiliares. No carga token API. No credenciales en argv,
JSON o errores. No cambia polling, vigilancia, gestor, MDB original, outbox o ACK.

Parada ligada a PID/UUID; Ctrl+C de Python solicita parada cooperativa entre
bloques. Límite180s cooperativo, no plazo duro para IO/ODBC bloqueados ni mata
procesos. Resultado propio persiste fase/éxito/error_type/cause_type/etapa sin
mensajes ODBC privados; restaura handler SIGINT. Hasta64sesiones, sin borrado.
stopped solo indica fin de esa ejecución, no comprobación final de recursos.

Después de salir Python, PowerShell limpia BSTR/entorno y llama automáticamente
--verificar-cierre con UUID fresco de ese lanzamiento. Rechaza estado/recibo
anterior aunque este intento fallara antes de crear estado. Verificador exige
padre ausente (incluye PID reutilizado), mantenimiento/exclusión, otros lectores
ausentes, fuente obtenible en exclusivo y recibo/hash de copia iguales. No pide
capacidad para otra copia al verificar la última admitida. Guarda cierre_final.json
con identidad, hash de resultado, checked_utc, source_handle_free y backup_verified;
también imprime cierre_respaldo_confirmado. Prueba puntual antes de reanudar.
Otro run requiere prueba final anterior vinculada, incluso si estaba stopped.

Si el respaldo falla pero el cierre se acredita, backup_verified=false: permite
reanudar por gestor sin alegar respaldo obtenido, pues origen nunca se escribió
y no se abrió SDK. Si no hay cierre confirmado, conservar mantenimiento y
evidencia; no borrar estados/locks ni repetir a ciegas. No habilita tareas por
código. Después de cierre: Terminar y reanudar por gestor y dos ciclos nuevos.

32tests nuevos:28controles con dependencias/copia/tareas/inspección sustituidas
y4PowerShell/DPAPI nativos con una credencial ficticia y una copia de prueba
del lanzador. Cubren referencia/x64/rutas, hash/aprobación ajenos, tarea activa,
PID/lector/revisión/ledger, limpieza de entorno, copia fallida, Ctrl+C/parada
vigente u obsoleta/límite, reintento sin prueba final, UUID repetido/ajeno, padre
vivo/reutilizado, copia alterada, fuente ocupada, lock/estado cambiado, resultado
parcial, cierre persistido y capacidad agotada tras última copia. Lanzador prueba
secreto solo en el primer proceso/sin argv, mismo UUID al verificar, clave ya
retirada, fallo de copia preservado aunque cierre0, fallo de cierre y ausencia
de credencial sin lanzar ni verificar un run viejo. Ningún dato/servicio de caseta.

Suite final397tests en70.270s, fallos0/errores0/omisiones0, incluidas365previas.
AST Python y parser WinPS de ambas fuentes aprobados. Suite fuera del sandbox
por pruebas previas loopback/DPAPI; no caseta ni producción.

Respaldo_Real_MDB_2026.10.25-1.zip:80archivos,204275bytes, SHA256
5c5857b2c23c05d93ca41bb4e5621ffa0703a1642a9a8bfc791864c442f6f74e.
Incluye73archivos MDB1 byte por byte, seis nuevos y manifiesto79fuentes. ZIP/
rutas/hashes/dependencias verificados. Extraído en
datos/aceptacion_respaldo_real_20261025_r1: verificadorPS correcto,
simulation_ok/32tests/failures0/errors0/skipped0,
ended_utc2026-10-26T02:57:35.054413Z (=25oct20:57México). No sobrescribir ZIP.

Siguiente paso Dell: verificar/simular y --preflight sin mantenimiento, SDK,
SSH o credenciales reales para la simulación; preflight solo metadatos/plan.
Compartir ambas salidas antes de coordinar pausa y lanzamiento real. Guía
LEEME_RESPALDO_REAL.md con comandos, parada y comprobación manual de respaldo
si el lanzador se interrumpe. Simulación/preflight Dell, respaldo real/cierre/
retorno aún pendientes; no se acredita salud actual de r2 con pruebas locales.
Aplicación autorizada/recuperación operativa, runner continuo, gestor/vigilancia,
UI/endpoints nuevos y despliegue siguen pendientes.

## Simulación y preflight del lanzador aceptados en Dell — 2026-10-25 México

Usuario verifica Respaldo_Real_MDB_2026.10.25-1 y comparte simulation_ok,
32tests/failures0/errors0/skipped0, ended_utc2026-10-26T03:03:23.989304Z
(=25oct21:03México). Evidencia:
C:\SanIsidro\RespaldoReal_20261025\registros\simulacion_respaldo_real_20261025_210323_989259.json.
Se aceptan controles y lanzador con credencial DPAPI ficticia en Dell.

--preflight devuelve preflight_ok, card12230693 y hash de plan exacto
709d7809d4259fb89847a2f5ef68aa15af1f69f1f3f6da9a4123fd3be2d58416.
source_bytes70127616 (aprox66.88MiB), source_opened=false, credential_read=false,
maintenance_required_for_backup=true. Quedan comprobadas rutas/archivos/plan/
metadatos/capacidad en esa consulta, sin abrir bytes MDB ni descifrar credencial.
No acredita contenido/esquema/clave reales, cierre o salud actual del polling.

Siguiente paso indicado al usuario: cerrar ZKAccess/otros lectores y preparar
mantenimiento por gestor, esperar parada, ejecutar lanzar_respaldo_real.ps1.
El lanzador obtiene copia/valida y después ejecuta comprobación final automática
con UUID propio, guardando cierre_final.json. Solo cierre_respaldo_confirmado
permite Terminar y reanudar por gestor; luego dos ciclos correctos nuevos. Si
backup_verified=false pero cierre confirmado, reanudar conservando evidencia,
sin afirmar respaldo obtenido. Sin cierre, conservar mantenimiento y revisar.
No usar Ctrl+C/cerrar ventana ni otro lector durante la operación. No SDK/API/
escritura del original. Copia real, comprobación final y retorno pendientes de
salida del usuario; no afirmar mantenimiento iniciado por compartir preflight.

## Respaldo MDB real, cierre y retorno aceptados — 2026-10-25 México

Usuario ejecuta lanzar_respaldo_real.ps1 y comparte backup_verified=true,
phase=stopped/error_type=null/approval_issued=false/sdk_opened=false.
Padre PID7692/run_id=d1ce96a9-3eed-416e-b248-266cc36a3118,
ended_utc2026-10-26T03:06:33.467170Z (=25oct21:06:33México).
Evidencia en Dell:
C:\SanIsidro\RespaldoReal_20261025\datos\sesiones\d1ce96a9-3eed-416e-b248-266cc36a3118.

Copia privada:
C:\SanIsidro\RespaldoReal_20261025\datos\mdb_reales\4f7e033d-0a4b-43a9-af2b-8547b93e7876\Database_PRO_antes.mdb.
backup_id4f7e033d-0a4b-43a9-af2b-8547b93e7876,
created_utc2026-10-26T03:06:31.107871Z,70127616bytes, statuscopy_verified,
SHA256e90d11faf5c1704cb394c174cc02b74da34e72d0a7ec56d200f1b37c63f8610e.
Contexto serialCO2K225060027/card12230693/plan_sha256
709d7809d4259fb89847a2f5ef68aa15af1f69f1f3f6da9a4123fd3be2d58416.
El hash seleccionado Access es
643bfc0f995ed02b745c2bb81f355a81b8aa26f462433afa7724295ca29034d8.

Lectura readonly de copia: USERINFO951, CHECKINOUT178794, acc_levelset1,
acc_levelset_emp950, personnel_issuecard950. Copia/bytes y cinco tablas/tag
validados con credencial existente, sin cambiar origen ni abrir SDK/API.
No inferir usuarios sin permiso ni defectos de integridad a partir de951/950;
son recuentos, no auditoría relacional individual. CHECKINOUT tampoco certifica
cruces físicos ni completitud de eventos C3. Mantener archivo con datos personales
en Dell, no subirlo como evidencia. Restauración/recuperación aún no ensayada.

El verificador automático devuelve cierre_respaldo_confirmado para mismo PID/
run_id, backup_verified=true/source_handle_free=true/sdk_opened=false,
checked_utc2026-10-26T03:06:39.079998Z. Hash del resultado:
f72e14b0d3b24f63a17f6d7636237be016c8cdb51a227b1312685bba95195710.
Según código verificado queda cierre_final.json en esa sesión. Comprobación
final anterior a reanudación, sin pendiente histórico de salida en esta etapa.

Retorno r2: PID18024/protocol2/run_started2026-10-26T03:07:08.824617Z,
phaseidle/consecutive_errors0/last_error_typenull,
last_ok2026-10-26T03:08:18.366814Z. Dos ciclos nuevos correctos21:07:12.943 y
21:08:18.368 México25oct, API838/cambios Access0/C30/no encontrados4/ausentes
API116sin cambios. Parada ordenada previa21:06:04.735. Se acepta respaldo real,
cierre final y retorno con dos ciclos; no repetir pausa/backup. No tabla nueva
de tareas ni vigilancia aportada; no inventar Enabled/State o estado del monitor.

Siguiente trabajo: unir los respaldos MDB/selectivo DPAPI al transporte del
aplicador y revisar/ensayar recuperación selectiva antes de escribir. El plan
conocido de12230693 sigue sin diferencia que justifique reescribirlo; no cambiar
fechas/pagos para forzar ensayo. No autorización de aplicación real por obtener
respaldo. Runner continuo, gestor/vigilancia, UI/endpoints y despliegue pendientes.

## Unión local de respaldos/aplicador y conciliación aislada — 2026-10-25 México

Usuario autoriza continuar. Se implementa aplicador_integrado.py en fuentes
nuevas; no se inicia otra operación en Dell ni se cambia código/ZIP publicado.
prepare_bundle vincula copia MDB verificada y snapshot DPAPI del perfil completo/
permisos C3 con hash de un mismo plan. Copia antes de Approval, sin reiniciar
TTL. Bundle.check reabre/descifra, verifica referencias UUID, recibo/copia/hash,
identidad/fechas Access y alcance. Rutas vienen del padre confiable, no del JSON.

BundledDatesPanel coteja campos completos/permisos actuales contra el perfil
protegido antes del Set, deja referencia durable y conserva payload de cuatro
campos. run_worker exige plan/respaldo/intención/operación exactos y únicos antes
de construir el panel; reutiliza core.worker/ABI/serial/cierres aceptados. Perfil
privado no se escribe fuera del cifrado. No nueva CLI para escribir en caseta.

execute reutiliza aplicacion_vigencias.execute con API nueva por componente.
Respaldo doble obligatorio si hay cambios; plan sin cambios solo hace lectura
con cierre, sin forzar copia completa/escritura. Rechaza Approval consumida o
verificada previamente y verifica de nuevo TTL después del hash de MDB grande.
Callbacks confiables deben devolver ClosedWorker producido por run_closed_worker
y carpeta propia con operación/UUID de esta transacción, respuesta/hash, cierre
y ACK durable antes de liberar gate. Se comprueba PID/salida/gate/liberación y
vínculo del snapshot antes de actualizar Access. Booleanos/hashes no autentican
al operador ni reemplazan transporte. Gate/lock operativo siguen a cargo del padre.

Índice transaction.json y resultados originales conservados. check_runs revisa
todas las transacciones anteriores para impedir eludir un fallo con otro UUID.
Corte/fallo parcial bloquea nuevos intentos; no reset/borrado de evidencia.
review_recovery genera propuesta contra API actual, incluso vencida, bloquea
identidad/permisos/campos privados cambiados o API ausente y mantiene
retry_authorized=false/approval_issued=false. No resuelve marcas operativas.

26pruebas nuevas:25 con servicios/cifrado/SDK/MDB sustituidos y1 ensayo compuesto
con ACE/Win32/ACL/DPAPI nativos en MDB ficticios propios y SDK/API ficticios.
Cubren respaldos alterados/ajenos/faltantes, TTL/replay, ACK/PID/UUID/gate,
cierre fallido, C3-only/Access-only/sin cambios, perfil modificado antes del Set,
API cambiante, fallo parcial Access, reinicio y revisión de recuperación.

Ensayo nativo: actualiza C3 ficticio a noviembre y simula fallo anterior a
escritura Access. MDB de origen ficticia conserva octubre; revisión propone
diciembre según API nueva. Se clona a OTRA MDB ficticia y se ensaya allí el plan
nuevo con aprobación ficticia, respaldos reales y AccessDates SQL real. Acceso
y C3 ficticio quedan en diciembre; otro usuario, membresías e historial conservados.
La evidencia y bloqueo del intento original permanecen intactos. Demuestra la
conciliación en laboratorio, NO una excepción de reintento en origen bloqueado.
Ninguna MDB/credencial/lector de caseta fue usada por estas pruebas.

Suite final423pruebas en110.231s, failures0/errors0/skipped0, incluidas397previas.
AST nuevo y parser WinPS aprobados. Suite ampliada por casos previos loopback/
DPAPI; sin producción/caseta. No nuevas pausas ni validación de salud remota.

Integracion_Aplicador_2026.10.25-1.zip:87archivos,223809bytes, SHA256
c8ef5cc90c533725dd816f6dcab6a1f99b338ee7d946423e2162c43d67fbed5c.
Contiene80archivos de Respaldo_Real_MDB1 íntegros, seis nuevos y manifiesto86
fuentes. Bytes/rutas/hashes comprobados. Extraído bajo datos/i1 para limitar
longitud de rutas de los fixtures ACE: verificador PS correcto,
simulation_ok/25tests ended_utc2026-10-26T04:44:29.926082Z y
lab_reconciliation_ok/1test ended_utc2026-10-26T04:44:44.113577Z
(=25oct22:44México), cero fallos/errores/omisiones. No sobrescribir ZIP.

Siguiente: verificar/simular ambas pruebas en Dell con Python64/ACE ya instalado,
carpeta C:\SanIsidro\IntegracionAplicador_20261025. Sin mantenimiento, SSH, SDK,
API, MDB instalada o respaldo real anterior. LEEME_INTEGRACION_APLICADOR.md con
comandos exactos; salida Dell pendiente. No lanzar scripts históricos incluidos.

Pendiente transporte concreto padre/x86 conservando aprobación/TTL originales,
lectura de perfil completo con cierre acreditado y política/autorización de
resolución de bloqueos antes de una recuperación operativa. Las interfaces
confiables probadas no equivalen a esos adaptadores instalados. No aplicación
real ni restauración autorizada por estas pruebas. Runner/gestor/vigilancia,
retención de índices, UI/endpoints y despliegue siguen pendientes. Última salud
remota continúa PID18024/last_ok03:08:18.366814Z y dos ciclos21:07/21:08México.
