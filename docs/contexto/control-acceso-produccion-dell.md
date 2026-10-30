# Lecturas permanentes en Dell — 2026-10-30

## Alcance y estado

Usuario autoriza despliegue real, con visita a caseta aproximadamente17:30 Mexico
para HDMI, tags, latencia y boton de pared. Backend7c91b73 desplegado, tres migraciones,
monitor habilitado y salud/up200. Frontend7be031c promovido por usuario a produccion.
Usuario confirma entrada admin a Vigilancia/Lecturas, todavia sin lecturas. Historial
para vigilancia deshabilitado/revision1; admin conserva historial y Buscador no cambia.
Instalacion permanente de Dell y aceptacion operativa pendientes de evidencia remota.

Agente produccion54d110e4-313a-45e3-bcc6-7761f3df8721, serialCO2K225060027.
Credencial solo en archivo privado del servidor y luego DPAPI; no copiar al contexto.

## Motor de fechas preservado

Se conservan bytes y reglas del ciclo r2 instalado y su trabajador C3 original.
Solo se sustituye transporte del trabajador por propietario nativo, comprobacion de
serial, exclusividad y recibos de Disconnect. Contrato dates_engine=r2_reference_unchanged.
No se activa aplicador candidato ni se declara aceptada una escritura candidata que
nunca ocurrio: el piloto real termino no_changes. API sigue siendo autoridad de fechas.

Coordinador retiene sync.lock; RT cierra antes de cada ciclo r2. Emisor separado sin
SDK/ACE, HTTPS definitivo, identidad nueva y outbox/originales/ACK propios, sin adoptar
colas de laboratorio. Conserva acciones/principal de tareas, lanzador DPAPI y datos
previos. Instalador respalda fuentes r2/gestor y XML, muestra hash del plan y activa
solo release exacto. No abre SDK ni inicia tareas al instalar. Cierre incierto conserva
cuarentena/evidencia; nunca borrar marcas para continuar.

## Paquete y pruebas

tools/agente_acceso/Lecturas_Produccion_2026.10.30-1.zip,185archivos,469665bytes.
SHA256:1f933dd4376833d03d08476d70a1434bd0e8f5acd9a4262963183340c7e77f60.
Manifiesto:59bf55874a0101e3c049be8d1add3285e08e5c56db4e16a58aed3f913f658dfc.
Base congelada Latencia_Candidata_2026.10.28-2.zip conservada. Destino nuevo:
C:\SanIsidro\LecturasProduccion_20261030; raiz operativa ZKSync.

Pruebas finales extraidas:27/27,0errores/fallos/omitidas. SDK/HTTPS falsos; DPAPI,
ACL y procesos Windows nativos. Cubren motor r2, hijo/recibos/archivo/reapertura,
instalacion/reversion, emisor y autenticacion sin exponer token. POST estado vacio
exige422 sin insertar eventos ficticios; recibo HTTPS ligado a credencial e identidad
caduca en1hora; una nueva comprobacion fallida invalida exito previo.
ZIP CRC/manifiesto/bytes iguales a fuentes probadas; verificador PowerShell correcto.
Sin DLL, MDB, SQLite ni credenciales instaladas en paquete.

Regresion:150casos aprobados en candidato;4errores iniciales de harness (3Laravel sin
fixture PHP en ZIP y un modulo de tests no incluido) conservados en evidencia.
Complemento desde repositorio con fixture correcto:40casos aprobados,0errores.
No atribuir errores de harness a producto ni ocultar reportes.
Evidencia:output/produccion-lecturas-20261030/produccion-final.json,
regresion-produccion.json y regresion-complementaria.json.

## Operacion y pendientes

Configurar por SSH/stdin con Python64 de Dell; preflight mientras r2 sigue normal.
Cerrar ZKAccess/otros lectores, preparar mantenimiento desde gestor, plan e instalacion
por hash. Cerrar/reabrir gestor; Terminar y reanudar. Validar dos ciclos, envio/ACK,
web y mantenimiento/parada/reanudacion reales antes de afirmar aceptacion.
Reversion conserva datos y restaura entradas r2/gestor exactas; exige cierre y hash
del plan, no rollback de tablas. No repetir instalacion sobre restos sin revisar.

Limites: originales2GiB, outbox256MiB, ACK4GiB, cierres2GiB; aviso80%. Sin borrado
por antiguedad; al no guardar con seguridad se pausa RT. Revisar capacidad real
periodicamente; pruebas sinteticas no certifican dias de almacenamiento.

**Boton fisico pendiente:** no inferir cableado ni codigo. Anotar hora/pluma/accion y
revisar eventos crudos del intervalo, incluyendo card vacio/0. Preferir evidencia del
lector unico en produccion; no abrir ZKAccess u otro SDK en paralelo. No controla
plumas ni confirma paso fisico. Ajustar clasificacion despues segun evidencia.
HDMI entrada/salida y latencia fisica hasta pantalla pendientes para visita17:30.

## Instalacion remota confirmada — 2026-10-30

Usuario transfirio ZIP PC→servidor→Dell y verifico SHA/manifiesto. Configurar devolvio
production_credential_and_https_verified,422esperado, sin eventos ficticios ni SDK.
Preflight real: seis fuentes r2, gestor, tareas y SDK coincidentes; PID11852,
last_ok_utc2026-10-30T21:09:12.349934Z. Sin cambios de tareas por estas comprobaciones.

Plan generado en mantenimiento:
54ee858124db56c8326396050f3b683e2de3d7ef2765726013e370193d9a8f8c.
Instalacion aplicada por ese hash devolvio production_activated_waiting_for_manager_resume,
installation_id43c51f89-9576-4dd2-9445-d48db8b7b92c,
release59bf55874a0101e3c049be8d1add3285e08e5c56db4e16a58aed3f913f658dfc,
dates_engine=r2_reference_unchanged, dates_applied=false y tasks_changed=false.
Respaldo y plan bajo ZKSync/instalaciones/43c51f89-9576-4dd2-9445-d48db8b7b92c.
Instalado/activado no acredita servicio en ejecucion: falta cerrar/reabrir gestor,
Terminar y reanudar, dos ciclos nuevos, envio/web y prueba de parada/reanudacion.
Boton y HDMI siguen pendientes, sin codigo supuesto ni otro lector en paralelo.

### Primer arranque real confirmado

Salida --estado aportada por usuario: PID6912, run_iddd001d82-064e-44e9-bad6-eb7e60d2f9f1,
inicio2026-10-30T21:13:16.958228Z, heartbeat21:14:37.145764Z. Dos ciclos completados,
0errores; ultimo21:14:26.658149Z: API841, cambios Access0/C30, no encontrados4 y
ausentes114 sin cambios. Motor r2 original en modo apply; no escritura por no haber
diferencias. RT status_observed, SDK reciente, sin errores lector/almacen/emisor,
gate activo rt y sin fault. closures_confirmed=false mientras corre es esperable,
no evidencia de cierre fallido. Emisor PID15232 vivo,70outcomes acked y ACK reciente
21:14:35.574833Z. Cola caliente3respuestas sin agrupar recientes, no bloqueada;
no confundir conteo caliente con total historico archivado. Capacidad sin avisos.

Arranque de produccion y entrega HTTPS confirmados. Pendientes comprobacion humana
de web, mantenimiento/parada/reanudacion del nuevo servicio y HDMI/boton fisicos.

Usuario confirma despues que la web real ya muestra lecturas. Recorrido C3→Dell→API
de produccion→web acreditado, sin medir aun presentacion fisica hasta pantalla.
Parada por gestor seguida de --verificar-cierre devolvio production_closure_confirmed,
safe_to_resume=true, sin abrir SDK ni cambiar tareas. Reanudacion posterior solicitada;
su resultado aun pendiente. No repetir instalacion ni crear otro agente.

Prueba fisica preparada en docs/PRUEBA_CASETA_20261030.md. Revisor adicional
tools/agente_acceso/revisar_boton_produccion.py lee originales SQLite en modo readonly,
sin SDK/red/credenciales, incluyendo eventos sin card. Salida oculta tag/PIN y no
atribuye significado a codigos.7pruebas aprobadas con fixtures, incluida lectura WAL
con escritor activo, original alterado, ventana por reloj PC, identidad ajena y
truncamiento. No modifica el ZIP/release instalado. Copia entregable:
output/prueba-boton-20261030/Revisar_Boton_20261030.py,
SHA25617e5db6cf5747d686258a13b33f3ae96e350268324af551562bba79e017e13c7.
Transferencia a Dell y pulsacion fisica todavia pendientes.
