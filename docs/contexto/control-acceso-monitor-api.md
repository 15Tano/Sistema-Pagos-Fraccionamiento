# Consultas del monitor de acceso, preparadas localmente

2026-10-26. Usuario autoriza avanzar de forma autonoma en preparacion y pruebas
locales mientras esta ausente; despliegue e instalacion real se revisan despues.
La entrega inicial no incluía pantalla. Se reutiliza Laravel/Sanctum existente y las
cinco tablas de ingesta; la API sigue siendo autoridad exclusiva de vigencias.

## Acceso y habilitacion

GET /api/control-acceso/monitor/estado y GET /api/control-acceso/monitor/eventos.
Autenticacion humana auth:sanctum, roles exactos admin y vigilancia, comprobados
en backend. Residente/capturista/roles desconocidos403. Credencial del agente no
autentica humanos. No mezclar token sica_ con Sanctum ni enviar uno al navegador.
Cache-Control private,no-store; throttle120/minuto. Rutas fuera del grupo de
corte.bloqueo porque solo permiten admin/vigilancia y no realizan pagos.

Deshabilitado por defecto: CONTROL_ACCESO_MONITOR_ENABLED=false. Hasta habilitar
explicitamente en despliegue aceptado, usuario autorizado recibe404; usuario sin
autenticar401. No se cambio .env, config de produccion ni /api/vencimientos.
Migracion nueva2026_10_26_070000_add_control_acceso_monitor_indexes agrega solo
indices; no renombra la de ingesta ni modifica filas existentes. Reversion
comprobada sin perder datos. Debe aplicarse despues de la migracion de ingesta.

## Estado

GET .../estado?agent_id=UUID; sin filtro devuelve hasta50controladores ordenados
porUUID con meta.truncated. UUID inexistente404. No devuelve hash/token, ACK,
payload bruto, nombre de vecino, domicilio ni perfil SDK.

Por agente: id/nombre de caseta/serial/revocacion; fechas UTC de reporte y
recepcion; snapshot acotado de vigencias/lector/SDK/emisor. Ultimo reporte se
selecciona por reported_at_utc y desempata por id; un reporte atrasado recibido
despues no reemplaza uno mas reciente del mismo PC. Fecha futura produce estado
de reloj a revisar; no se inventa frescura ni se certifica hora del dispositivo.

reporting_status: sin_reporte, sin_reporte_reciente, reporte_atrasado,
reloj_por_revisar, revocado o reciente. Umbral90s, tolerancia futura30s.
vigencias_status: sin_datos, sin_confirmar, detenido, error, reloj_por_revisar,
atrasado o correcto. Para correcto exige reporte reciente, last_ok/heartbeat
presentes y no futuros, errores0 y antiguedad<=300s. RT/ACK recientes no actualizan
last_ok ni ocultan una sincronizacion fallida/atrasada. Estos estados describen
reportes recibidos; no aseguran salud fisica ni conectividad actual de la C3.

## Eventos para consulta inicial y seguimiento

GET .../eventos?agent_id=UUID requerido. Filtros opcionales: source=rt(default),
transaction o all; door_id/card_no numericos como texto; limit1..100(default50);
after_id o before_id excluyentes.
Parametros desconocidos, limites/cursor invalidos422. No consulta toda la tabla
ni calcula un total global por cada refresco.

Sin cursor devuelve ultimosNeventos, ordenados ascendentemente por id de fila
del servidor, meta.initial_latest=true. Para seguimiento, enviar after_id igual
a meta.last_id. Si has_more=true, seguir paginando antes de esperar; no saltar al
ultimo registro global. Pagina incremental vacia conserva el cursor recibido.
after_id=0 sirve para recorrer desde el principio. before_id permite paginas de
historial hacia atras. Los IDs se devuelven como cadenas para no perder precision
en JavaScript; la hora C3 no se usa como cursor ni se convierte en UTC.

Cada fila incluye UUID de respuesta, ordinal, origen, hora cruda del dispositivo,
tarjeta/Pin/puerta/codigo/sentido/verificacion crudos y tiempos UTC de captura y
recepcion. kind=status/codigo255 no aparece en este feed. No se agrupan ni
deduplican observaciones iguales; se preservan sus IDs y posiciones. Codigos
desconocidos permanecen numericos, sin atribuir significado no verificado.
Solo para serialCO2K225060027 se etiqueta puerta1Entrada y2Salida, segun pruebas
fisicas previas; otros seriales no heredan ese mapeo. La API declara
meta.physical_passage_confirmed=false. Una fila no prueba cruce de vehiculo.

## Verificacion

Pruebas de rutas/middleware/modelo de lectura reales con SQLite en memoria y
MySQL8.4.13 aislado. Autenticacion/roles/bandera, secretos excluidos, reportes
atrasados/futuros/revocados, vigencias desfasadas pese a RT reciente, multiplicidad,
255, filtros/ceros iniciales, paginacion por id, lectura sin mutacion y reversion
de indices. No consultas SDK ni bases existentes.

MySQL:38tests/285aserciones aprobados (24ingesta+14monitor),36.786s; instancia
temporal detenida mediante SHUTDOWN del helper que valida ruta/puerto/server_id/
marcador. El primer intento detecto un fixture con fecha ISO no admitida por
DATETIME MySQL; corregido solo el fixture a fecha SQL UTC. Codigo productivo de
ingesta no requirio cambios. SQLite final:31tests/227aserciones aprobados
(17ingesta+14monitor),2.050s. Monitor queda deshabilitado por defecto.

Suite Laravel general mantiene el fallo previo ExampleTest que espera200 en /
cuando web.php headless devuelve404. No se modifico ese test ni la ruta raiz;
detalle previo ya documentado en ensayo-mysql. No presentar la suite general
como totalmente aprobada. Despliegue y validacion con cuentas humanas reales
siguen pendientes; no declarar la pantalla ni la ingesta de produccion instaladas.

## Pantalla local posterior — 2026-10-26

Primera consulta React preparada sobre estos GET, con sesión humana, filtros,
seguimiento por cursor y avisos de antigüedad/error. Ver
[pantalla del monitor](control-acceso-pantalla-monitor.md) para alcance,
validación y vista previa ficticia. Sin habilitar bandera ni desplegar a
producción; la instalación continua de caseta sigue siendo un paso separado.
