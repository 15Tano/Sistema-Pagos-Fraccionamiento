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
