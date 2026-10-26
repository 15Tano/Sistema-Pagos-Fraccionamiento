# Piloto de aplicacion de vigencias existente-only

2026-10-26. Tras aprobar simulacion Dell64/32 y preflight de Preparacion1, usuario
pide continuar y estimacion. Se prepara un solo piloto, sin instalar/activar
servicio permanente, publicar backend, tocar DLL o consumir eventos RT. API
habitual /api/vencimientos sigue siendo unica autoridad. No aplicacion remota
de este piloto todavia.

## Comportamiento

Fuentes nuevas separadas: piloto_vigencias.py (flujo), piloto_vigencias_dell.py
(adaptador/entrada), piloto_sdk_worker.py (hijo x86 con recibos). Reutilizan
CycleBundle, Approval, aplicador_integrado, respaldo MDB/perfil y transporte
cerrado previos. No cambian modulos ni ZIP publicados.

Un tag numerico explicito; falta en API/Access/C3 implica rechazo, no alta ni
recuperacion. Plan fresco con antes/despues, APIsha y hash del plan. Si todo
coincide: no_changes/dates_applied=false, no Approval, respaldo extra, Set o
UPDATE. No inventar diferencia, pago o vencimiento para probar una escritura.

Si hay diferencia natural: copia MDB privada verificada y perfil C3 completo con
permisos cifrado DPAPI. Access se cierra antes de la copia exclusiva. Publica solo
plan/IDs de respaldo, nunca Password/perfil bruto. Solicita literalmente
APLICAR tag SHA256 del plan; ENTER cancela, tiempo120s. Relee API/Access/C3 y
verifica bundle tras la espera humana. Solo entonces emite Approval por60s;
instante original se conserva en permiso DPAPI del trabajador, sin renovarlo.

Aplicacion solo de componentes que difieren: C3 se coteja, escribe cuatro campos
de fechas/identidad, conserva perfil/permisos y confirma cierre/ACK antes de
Access. SQL limitado a fechas/validez con comparacion optimista, transaccion y
lectura posterior. API se consulta otra vez en el aplicador. Rechazos/races no
autorizan fuerza o reintento de una escritura incierta. Ctrl+C cancela antes de
aplicar o se atiende al terminar la transaccion del tag; no abandonar Access a
medias tras C3.

## Coordinacion y limites

Solo raiz C:\SanIsidro\PilotoVigencias_20261026, padre64/hijo Python32 instalados,
r2/gestor con ocho hashes exactos ya confirmados. Exige proceso actual elevado
(IsUserAnAdmin y comprobacion PowerShell): Highest de la tarea no demuestra
elevacion de una consola manual. Evita repetir el fallo historico de C3 aplicado
y escritura MDB denegada por Program Files. Preflight solo metadatos/hash/
elevacion, sin SDK/red/MDB/credenciales; repite controles bajo el lock y antes
de emitir el alcance. No admite enlace integrado instalado.

Pausa previa por gestor original: tarea Disabled, active=true y protocol2stopped.
Se retiene sync.lock instalado y se excluyen lectores ajenos mediante inventario
readonly; no fuerza/cierra procesos ajenos. Padre conocido por PID+nacimiento/
imagen de kernel y capacidad DPAPI privada. Cada hijo requiere permiso ligado
a UUID/rol/digest de operacion/worker-run y hash de capacidad; exige padre vivo,
estado running, lock retenido y mantenimiento. Solo rol vigencias: no GetRTLog.
CLI trabajador x86 verifica paquete antes de abrir SDK instalado y serial exacto.

Antes de abrir SDK crea su marca propia de revision en GestionTags para bloquear
reanudacion y otras escrituras. Las guardias permiten solo esa marca exacta,
rechazan revisiones ajenas. No retirar marcadores manualmente. Un SDK incierto
conserva exclusion aun si publicar estado falla; no iniciar otra conexion para
comprobarlo. El gestor original no se parchea/instala durante el piloto.

PowerShell usa credenciales DPAPI instaladas solo en memoria del padre, limpia
variables/BSTR; SANISIDRO_* no se hereda a hijos SDK. Copias/datos bajo
datos/sesiones/UUID con ACL usuario+SYSTEM; max64sesiones, sin borrar evidencia.
No toca outbox/originales/credencial de ensayo ni usa SSH/tunel.

## Cierre y reanudacion

Cada lanzamiento tiene UUID generado por PowerShell y pasado a Python. Al salir
ese proceso, el mismo lanzador verifica exactamente ese UUID, resultado/PID,
ausencia de procesos previos, recibos/ACK, transacciones verificadas, lock y
handle de lectura exclusivo de la MDB libre. No carga SDK para verificar.

Conserva prueba de recursos, coteja/retira solo su marca exacta y guarda
cierre_final.json con cierre_piloto_confirmado/safe_to_resume=true y SHA del
resultado. Solo entonces Terminar y reanudar por gestor y comprobar dos ciclos.
Un run nuevo exige cierre anterior confirmado; otro UUID no elude aplicacion
parcial o falta de evidencia. No reset/force/rollback automatico de fechas.

verified/dates_applied=true solo acredita componentes/tag/fecha mostrados.
no_changes/declined son cierres sin escritura, no validacion de Set/UPDATE.
Error tras consentimiento declara changes_may_have_occurred y dates_applied=null
hasta revision; no afirmar que no se escribio. Fasefault/SDK incierto o
transaccion parcial impide confirmar cierre/reanudar. Perfil y respaldo quedan
para conciliacion con API actual, no restauracion a ciegas.

## Verificacion local

Suite final:600tests aprobados en195.606s, incluidas36pruebas nuevas.
Casos: aplicar, coincidencia sin escritura, cancelar/consentimiento no booleano,
cambios de API/Access/C3 durante espera, respaldo corrupto, API ausente, tags
invalidos, parar antes/durante respaldo, parada despues de Set completando
Access, error Access parcial y evidencia bloqueada. Confirmacion exacta y
caducidad de espera, transaccion/conexion cerradas ante error, elevacion previa.

Procesos SDK ficticios reales: DPAPI/nacimiento/lock/entorno sin secretos,
aplicacion una vez, padre sustituido/cerrado o lock libre rechazados antes de
Connect. MDB/ACE/DPAPI nativos de prueba: fabrica SQL nueva confirma solo fecha
API y conserva otro usuario. Entrada nativa completa y verificador sobre entorno
ficticio aplican una vez y segunda ejecucion no_changes/sin pedir confirmacion.
Pruebas de UUID/recibos/fault/handle MDB abierto/revision ajena/partial aseguran
que no se retire una marca ni se confirme un lanzamiento diferente. Fuente
PowerShell verificada por AST. No caseta, red real o datos instalados.

Paquete entregable Piloto_Vigencias_2026.10.26-2.zip:163entradas/417225bytes, SHA256
4cfe4062655d6da51be3cc7501d6bf303d98d043598ba7fcf98f22a9aa5dfa76.
Manifiesto162fuentesSHA
f0bade43b65ba515dd6f34616a40f1e2bc9a40e58e18ed49d9526c8ca17114b9.
Conserva las150entradas de Preparacion1 byte por byte; no sobrescribir ZIP.
Guia exacta LEEME_PILOTO_VIGENCIAS.md.

Al extraer la revision interna1 se detecto que el fixture de entrada nativa
anidaba una ruta MDB mas larga de lo admitido por ACE: destino212caracteres mas
UUID/nombre del MDB. La ruta real prevista Dell es menor. Se corrigio SOLO ese
fixture a un temporal corto con prefijo si-pilot- en TEMP y retirada tras
comprobar ruta/prefijo; no modificar LongPaths ni instalacion. ZIP1 interno no
entregado conservado en datos/piloto_revision_interna1, SHA
2f91a62c8171615a2847004bbb467eef82ce64675d80577de7fa1c7b92af77ae.

Revision2 extraida en datos/piloto2, verificacion PowerShell y simulacion:
simulation_ok,36tests/failures0/errors0/skipped0,parent64/child64 local,
ended_utc2026-10-26T18:15:41.664196Z. Primera ejecucion sandbox nego crear el
temporal AppContainer; repetida fuera del sandbox con exito, sin caseta/red.
No se redujo alcance ni omitio el test. La suite600 anterior paso antes de
acortar ese fixture; los36casos del paquete actual se repitieron tras el ajuste.
Resumen y hashes de registros en VALIDACION_PILOTO.json. Dell64/32, preflight
nuevo y piloto real siguen pendientes. No nueva salud remota certificada aqui.

## Siguiente paso Dell

Sin mantenimiento: verificar paquete, simular con padre64/hijo32 y preflight
desde PowerShell como administrador. No repetir carga2400 ni paquetes previos.
Tras revisar esa salida, coordinar una sola pausa por gestor y lanzar piloto
para12230693 u otro tag existente elegido explicitamente. El propio piloto
solicita consentimiento solo ante un plan con diferencia real. Si no hay
diferencia, registrar no_changes y reanudar; no declarar aplicada una fecha.

Transporte HTTPS definitivo, enlace/gestor permanente, capacidad/retencion y
despliegue del backend siguen siendo etapas separadas no autorizadas por crear
este paquete. Monitor API local existe con bandera desactivada; pantalla y
altas/recuperaciones web aun no se implementan en esta etapa.

## Simulacion Dell64/32 y preflight aprobados — 2026-10-26

Usuario verifica Piloto Vigencias2 y ejecuta simulacion con Python64 padre y
Python32 hijo: simulation_ok,36tests/failures0/errors0/skipped0,
ended_utc2026-10-26T18:23:37.922984Z. Evidencia:
C:\SanIsidro\PilotoVigencias_20261026\registros\piloto_simulado_20261026_122337_922929.json.
Preflight_ok/elevated=true/dates_applied=false/tasks_changed=false y
maintenance_required_for_pilot=true. Segun el codigo, acredita ruta, dependencias,
elevacion y ocho hashes instalados; no SDK/API/MDB/credenciales reales ni salud
nueva del polling/backend. No se aplicaron fechas por estos comandos.

Siguiente autorizado: piloto del tag12230693, con pausa por gestor instalado,
lanzador exacto de la guia y consentimiento solo ante plan con diferencia real.
Sin SSH ni tag fisico. El lanzador valida parada y verifica cierre automaticamente.
Reanudar solo tras cierre_piloto_confirmado/safe_to_resume=true y comprobar dos
ciclos nuevos. Salida real, cierre y retorno de esta pausa todavia pendientes.
No repetir simulacion/preflight por esta aceptacion ni atribuir una escritura
a no_changes. Si el plan no es claro, ENTER cancela y se revisa la evidencia.

## Piloto real sin cambios y cierre confirmados — 2026-10-26

Usuario ejecuta lanzar_piloto_vigencias.ps1 -Tag12230693. Paquete2/preflight
elevado correctos; PID15656/run_idd0b12171-eb70-4b9e-85ea-620ad13259ec.
Plan: API2026-11-05 23:59:59, Access mismo fin/inicio2020-01-01/USERID1108/
valid_rawtrue; C3 CardNo12230693/Pin693/StartTime20200101/EndTime20261105.
SerialCO2K225060027, access_change/c3_change false. PlanSHA:
709d7809d4259fb89847a2f5ef68aa15af1f69f1f3f6da9a4123fd3be2d58416.
APIsha41cb69b00f166c4e6fdca6ac0bf2ba9c0372ca98b599545fb69130324836154c.

statusno_changes/phasestopped/dates_appliedfalse/approval_issuedfalse,
components_verified vacio y backup_verifiedfalse. Es la salida prevista para
coincidencia: no se solicita consentimiento ni se crea un nuevo respaldo,
Set o UPDATE. No interpretar backup_verifiedfalse como respaldo fallido.
No acredita la ruta de escritura ni validacion de un respaldo nuevo.

Un recibo SDK de este piloto: workere1b43051-47c4-4ec1-8899-0d864c17b85e,
PID7812/closureSHA51b61cfeefa444c1ec7aa2d405e8ea0cb09d0b1ecde663db3c588f9ec854f9b5.
sdk_closedtrue/tasks_changedfalse; ended_utc2026-10-26T18:29:13.788470Z.
Evidencia:C:\SanIsidro\PilotoVigencias_20261026\datos\sesiones\d0b12171-eb70-4b9e-85ea-620ad13259ec.

Verificador posterior del mismo lanzador: cierre_piloto_confirmado,
safe_to_resumetrue/source_handle_freetrue/dates_appliedfalse,
checked_utc2026-10-26T18:29:18.901367Z, mismoPID/run; resultSHA
0bef1bd4a96571384238961292d6ce3e0d83597da70dd5eb15ee763c4ba0cce2.
Conforme al codigo, solo despues del cierre/transacciones verificadas retira
su marca exacta. No revisar/eliminar manualmente revision_pendiente por verla
en el resultado anterior al cierre.

Aceptados lectura real del piloto, coincidencia de fechas y cierre final.
Ahora Terminar y reanudar por gestor y comprobar dos ciclos nuevos. Retorno r2
todavia no aportado; no afirmar salud actual a partir de este piloto ni renovar
la salud del emisor/backend. No repetir esta pausa ni alterar fechas para probar
una escritura. Aplicacion candidata ante diferencia natural sigue pendiente.
