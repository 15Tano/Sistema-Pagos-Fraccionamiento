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
