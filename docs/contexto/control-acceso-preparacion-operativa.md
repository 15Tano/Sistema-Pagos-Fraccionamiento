# Preparación operativa consolidada de acceso

Fecha: 2026-10-26. El usuario autoriza avanzar autónomamente en trabajo local
mientras duerme. Se preparan candidatos y pruebas; no se accede a Dell/servidor,
instala, activa, despliega o hace push durante esta etapa. No hay pantalla nueva.

## Punto de partida real

El ensayo integrado readonly ya concluyó: cierre propio, retorno a r2 con tres
ciclos correctos y entrega acumulada de 359 respuestas/184 mensajes, sin
pendientes. Detalle en control-acceso-servicio-integrado.md. No repetir esa
pausa, capturas físicas, simulaciones antiguas o lecturas SDK por esta aceptación.

Última salud remota aportada: PID13936, last_ok2026-10-26T06:30:16.802893Z.
El trabajo local posterior no actualiza esa observación. La DLL x86 instalada,
API de vigencias, tareas, MDB y credenciales remotas no se modificaron.

## Diseño preparado

Entrada canónica ZKSync/sincronizar_vigencias.py mediante wrapper reversible.
Instalación candidata conserva seis fuentes r2 y XML exactos de ambas tareas;
mantiene acciones/principal/tareas existentes y comienza en modo r2. El modo
integrado requiere configuración y aceptación expresas ligadas al release y
configuración exactos. No se entrega una CLI para instalar/activar ni un recibo
que declare aceptadas pruebas reales pendientes.

La biblioteca instalacion_operativa.py exige consentimiento consumible del hash
del plan, comprobación nativa de mantenimiento y sync.lock retenido. Recalcula
hashes/plan antes de escribir; conserva un marcador si la copia queda parcial.
Reversión restaura bytes exactos de entrada/vigilancia/gestor, rechaza deriva y
conserva todos los datos, archivos, mensajes y versiones. No rebobina MDB ni
outbox ni reconfigura tareas. El llamador futuro debe aplicar ACL privada al
respaldo; el contrato está probado con adaptadores ficticios, no instalado.

Propiedad SDK: sync.lock de toda la vida del padre, identidad nativa PID más
nacimiento/imagen, capacidad DPAPI y permiso de cada trabajador ligado a su
UUID/rol/digest. Se comprueba antes de conectar/leer; no autoriza fechas.
El worker conserva DLL/hash/serial conocidos y solo reutiliza las funciones
documentadas del SDK instalado. Las publicaciones previas quedan intactas.

Vigencias: Cycle/Bundle/Approval ya probados, API consultada nuevamente, solo
registros existentes; conserva ausentes API y permisos. Copia MDB compartida por
ciclo y perfil cifrado por tag antes de aprobar; C3, cierre, Access con
comparación/transacción y verificación. Una solicitud del gestor se atiende entre
planes: no abandona Access a medias después de C3. Approval sigue ligada a un
plan/digest y plazo; no se renueva para eludir una caducidad.

RT se cierra antes de cada ciclo de fechas. El emisor es un proceso separado sin
importar SDK ni ACE; solo HTTPS definitivo fijo, credencial DPAPI propia y agente
distinto del ensayo. Ninguna cola/credencial del ensayo puede renombrarse o
reetiquetarse como producción. El transporte definitivo no se ha probado contra
producción; el código preparado no contactó ese host.

Estado protocol2/last_ok corresponde solo a ciclos verificados. SDK/ACK recientes
no ocultan fallos de fechas. Una falta de almacenamiento de eventos pausa RT y
se señala aparte. Un fallo parcial de fechas bloquea nuevas aplicaciones y
reanudar hasta revisión. Un cierre SDK incierto conserva sync.lock, deja de
consultar y exige revisión manual, incluso si falla guardar el estado/marca.
No fuerza procesos ajenos ni reinicia para borrar la incertidumbre.

## Parche candidato del gestor

Se generan copias en tools/agente_acceso/gestor_candidato, sin editar las
herramientas locales originales ni la instalación Dell. Hashes de referencia:

- mantenimiento.ps1: 840c500933e644fb9545c88091a287416a018b7c3e16434d634138531b97b4f4,
  coincide con la evidencia Dell previa.
- gt_backend.py: 5ded829ecd5467f4f08553baf44698d3dd21afdbbf0970a8fffe8735e5e74749,
  procede de la copia local conocida y aún debe compararse con Dell.

Guardia pura sin SDK: antes de consultas comprueba recibos de Disconnect,
hashes/respuesta, identidad de controlador y reconocimiento del padre tras
salida. PID muerto o estado stopped por sí solos no prueban cierre. Una
aplicación parcial conocida permite consulta readonly para revisión, pero bloquea
escribir/reanudar; identidad/cierre inciertos bloquean también consultas SDK.

mantenimiento.ps1 candidato comprueba la guardia antes de dar por terminada la
pausa o habilitar la tarea. Con enlace instalado, un estado protocol2 ausente o
ajeno impide entrar en el antiguo fallback V1 que fuerza parada. Esto cubre la
salida abrupta del padre cuando aún podría existir un trabajador SDK. No borrar
locks, marcas o recibos para superar esos controles.

El preflight compara ambos hashes del gestor; instalación rechaza cualquier
variante. Si la copia instalada difiere, revisar el código real antes del parche.
No asumir que el hash de gt_backend ya fue certificado remotamente.

## Conservación y capacidad

Almacén operativo nuevo, separado del ensayo. originals.sqlite guarda cada
buffer completo de hasta65,536 bytes comprimido sin pérdida, metadatos y hashes,
WAL/FULL, antes del IPC. Incluye códigos negativos, binarios, ausencia de NUL y
bytes posteriores al terminador. La cola HTTP conserva el payload original.

Después de ACK válido, se crea/valida archivo inmutable de cuerpo/ACK/respuestas;
se registra en catálogo FULL antes de retirar copias calientes de la outbox.
Los buffers completos permanecen en SQLite. Se preservan secuencias por endpoint
al vaciar la cola caliente; reinicio no reencola respuestas ya archivadas.
Falta/corrupción de archivo bloquea recuperación, conservando evidencia.

Recibos SDK: solo tras cierre reconocido y transacciones verificadas, un archivo
gzip conserva todos sus bytes, incluidos permisos DPAPI. Tras archivo+catálogo
durables, el directorio cerrado se mueve atómicamente a cierres_retirados antes
de retirar copias comparadas. Un corte deja directorios completos en el ledger
activo; catálogo permite terminar la retirada sin una nueva consulta SDK.
Nunca se retira una carpeta nueva/ajena ni se elimina el archivo conservado.

Límites preparados: originales2GiB, outbox256MiB, archivosACK4GiB, recibos2GiB,
perfiles1024/256MiB y copiasMDB32/2GiB. Avisos al80% y reserva baja de disco.
No hay borrado por antigüedad. Al alcanzar límites se detiene la captura o se
rechaza un nuevo respaldo/aplicación, según componente. Es una política
conservadora candidata, no una retención permanente aceptada. Deben acordarse
custodia, capacidad y mantenimiento antes de activar servicio continuo.

Vigilancia adicional separa almacén/lector/emisor/capacidad de vigencias. Cinco
minutos de fallo y repetición15min, conserva la vigilancia r2, evita duplicar su
aviso. Sender idle sin pendientes no prueba conectividad; pausa RT durante
vigencias no se confunde con error; cierre normal confirmado no genera alarma.

## Verificación local y paquete

Suite Python final: **564 pruebas aprobadas en151.718s**, cero fallos/errores,
incluidas72 nuevas. Procesos/locks/DPAPI/SQLite Windows reales; SDK, API, tareas
y datos de caseta ficticios. Comprueba aplicación completa con el nuevo binding,
parada solicitada después de Set y Access consistente, perfiles cifrados,
Disconnect fallido/serial ajeno, cuarentena con disco fallido, aislamiento del
emisor, cortes de archivado, secuencias, deriva/consentimiento/reversión y dos
ejecuciones PowerShell candidatas que rechazan sin mutar tareas ni matar procesos.

Se detectó durante desarrollo una expectativa de prueba demasiado estricta:
tras retirar el primer directorio entero, otros recibos completos pueden seguir
calientes hasta recuperar. Se corrigió el test para comprobar integridad de
todos los restantes, no exigir ledger vacío antes de terminar recuperación.
No se ocultó ni exceptuó la comprobación de cierre.

Paquete **Preparacion_Operativa_2026.10.26-1.zip**:150entradas,385196bytes,
SHA256 fc83b5e49e8204a390e0f79bff2af5bcf0233ec95d3bdf52ab813df0bd058a0a.
Manifiesto149fuentes, SHA256
f5b9f0c6e948ea0b34c0ea4e83c482bfe7036d54c9d6d4d589f8a2c5902aab60.
Preserva las117entradas del Servicio Integrado2 byte por byte. Constructor
reproducible rechaza sobrescribir una publicación. No agregar DLL ni SDK.
Las dependencias históricas se reconstruyen desde ese ZIP congelado, no desde
un checkout parcial de sus subcarpetas. Dos manifiestos históricos cambian CRLF
por LF en Git; no se reescribieron publicaciones para normalizarlos. El paquete
conserva sus bytes exactos y se verifica extraído. Las32fuentes nuevas incluidas
en el manifiesto coinciden también con los blobs del índice Git; los atributos
nuevos conservan bytes de referencias/parches del gestor.

Extraído en tools/agente_acceso/datos/prep1 y verificado por PowerShell:
simulation_ok,72tests/failures0/errors0/skipped0,parent64/child64 local,
ended_utc2026-10-26T09:07:42.602216Z. Incluye carga de2400buffers completos:
157,286,400bytes lógicos, SQLiteoriginales2,187,264bytes,120archivosACK;
originales/cuerpos verificados, reapertura sin reencolar y secuencias continuas.
Carga27.219s. Es una carga sintética compresible, no medida de tráfico/vida útil
en Dell ni garantía ilimitada de capacidad. Sintaxis PowerShell candidata y
verificador aprobada. Registros locales ignorados; resumen en
tools/agente_acceso/VALIDACION_PREPARACION.json.

Dell aún debe ejecutar esta simulación con padre64/hijo32 y preflight readonly
del mismo paquete. No mantenimiento, SSH, SDK o datos instalados en la
simulación; preflight lee solo hashes/metadatos/estado/tareas. Comandos exactos
en LEEME_PREPARACION_OPERATIVA.md. No repetir la simulación de paquetes antiguos.

## Lo que sigue

1. Revisar una sola salida Dell: simulación nueva64/32 y preflight. Resolver
   únicamente diferencias reales de fuentes/acciones/principal/capacidad.
2. Preparar entrada de piloto acotado y plan revisable: diferencia natural de
   fecha autorizada por API, respaldo reciente y consentimiento del alcance.
   Falta esa aplicación real; no fabricar pagos/vencimientos para probar.
   Comprobar gestor/reanudación/reversión con el enlace candidato y aceptar
   transporte HTTPS/custodia. Las bibliotecas preparadas no autorizan pegarlas
   manualmente en consola ni declarar verdaderos checks de simulación.
3. Revisar Git/despliegue del backend mediante el script habitual, con aprobación.
   Crear identidad/credencial de producción separadas, aceptar el plan de
   transición y habilitar operación continua solo con evidencia requerida.

La API de consulta para la futura pantalla está preparada por separado y
desactivada por defecto; detalle en control-acceso-monitor-api.md. Puede servir
de contrato para construir la pantalla en su etapa de interfaz. No afirmar que
esta preparación completa la operación instalada, pantalla, altas/recuperaciones
o despliegue de producción. No hay estimación porcentual fiable del proyecto
completo a partir del número de paquetes o pruebas.

## Simulacion y preflight aprobados en Dell — 2026-10-26

Usuario verifica Preparacion Operativa1 y ejecuta con Python64/32 instalados:
simulation_ok,72tests/failures0/errors0/skipped0,
ended_utc2026-10-26T17:35:05.622785Z. Evidencia:
C:\SanIsidro\PreparacionOperativa_20261026\registros\preparacion_simulada_20261026_113505_622727.json.
2400buffers completos/157286400bytes logicos, SQLite2195456bytes,120archivosACK,
originales verificados/cuerpos intactos/reapertura sin reencolar/secuencia
continua. Carga157.806s; no es medicion de caudal real del controlador.

Preflight readonly: las seis fuentes r2 coinciden. Ambos archivos del gestor
coinciden, incluido gt_backend.py5ded829ecd5467f4f08553baf44698d3dd21afdbbf0970a8fffe8735e5e74749;
queda resuelta la confirmacion remota de ese hash. SanIsidro-Vigencias Running
y SanIsidro-Vigilancia Ready, ambas habilitadas; actions_verified/same_user/
highest/interactive true en ambas. Vigencias protocol2/PID13936/phaseidle,
consecutive_errors0/last_error_typenull, last_ok17:34:35.957944Z y heartbeat
17:34:35.957966Z. No se aportan aqui dos lineas de log nuevas; el preflight no
las necesita al no haber pausado/reanudado. Espacio libre1928787902464bytes.

installed_link/production_config_exists/activation_record_exists false:
preparacion no instalada ni activada. can_activate=false es el bloqueo previsto,
no un fallo de simulacion. dates_applied/tasks_changed/credential_read false.
No SDK/red/MDB/credenciales reales en estas pruebas. No actualizar con esta
evidencia la salud del backend de ensayo ni afirmar aplicacion candidata real.

Siguiente: preparar piloto de aplicacion existente-only con plan fresco,
respaldo/proteccion y consentimiento del alcance. Mantener polling normal hasta
que haya un lanzador revisado. No repetir simulacion/preflight ni pausar ahora.
