# Corrección del recorrido del archivo local — 2026-10-31

## Incidente y recuperación observados

Usuario informa Conexión=Sin actualizar/Hace5h. PID1196 seguía sincronizando
vigencias, pero `storage_error=OperationalError` había pausado la captura. Última
captura durable31oct16:35:20.757052UTC; emisor vivo/cola vacía y último ACK20:14:35UTC.
Quick_check(1)=ok en las tres bases; un original sin archive_id. No se conoce el
mensaje/código SQLite original; no afirmar retrospectivamente SQLITE_BUSY.

Pausa por script y cierre completo confirmados; reanudación efectiva PID15660,
run_idb24b9834-0031-498c-979e-c929365c9b20. Proceso creado19:39:28Mexico; primer ciclo
correcto19:45:34. Nueva sesión con tres ciclos correctos, storage_error=null,
SDK reciente y ACK nuevos. La demora de arranque no está perfilada por fase.
El catálogo se verifica completamente antes del primer estado y también en emisor.

## Medición del usuario a19:51Mexico

Tres muestras separadas15s, entre01nov01:51:13 y01:51:43UTC:

| Muestra | Pendientes | ACK acumulados de sesión | HTTP más reciente |
| --- | ---: | ---: | --- |
| Primera | 51 | 75 | estado, .330493s,201/ACKválido |
| Segunda | 54 | 81 | estado, .313818s,201/ACKválido |
| Tercera | 56 | 85 | lotes, .317158s,201/ACKválido |

Cuarta lectura HTTP01:52:15UTC: estado,.311931s,201/ACKválido. Captura sigue avanzando
y no hay storage_error en esas muestras. La cola crece y el más antiguo acumula
más de dos minutos. Estos HTTP rápidos no perfilan todos los envíos; indican que
el tiempo de procesamiento local también debe atenderse. No declarar recuperado
tiempo real solo porque el proceso está vivo o porque hay ACK.

## Hallazgo y cambio local

`Archives.archive_one` recorre el directorio de históricos y hace `is_file()` y
`stat()` por cada ruta, dentro de una transacción de escritura de outbox. El mismo
patrón aparece al archivar cierres y calcular capacidad. Aumenta el trabajo por
envío a medida que crece el número de archivos y puede prolongar el bloqueo de
escritores. No se ha demostrado que explique por sí solo el OperationalError Dell.

Nuevo `almacen_operativo.directory_usage`: enumeración con `os.scandir`, usando
metadatos de `DirEntry`. No guarda totales entre llamadas y conserva errores de
acceso y límites. Sustituye las tres enumeraciones. El orden de persistencia,
transacciones, hashes/ACK, originales y verificación completa del catálogo queda
igual. No se modifica el motor r2, SDK, intervalos, esquema SQLite ni pantallas.

La documentación de [Python3.14, DirEntry.stat](https://docs.python.org/3.14/library/os.html#os.DirEntry.stat)
explica que Windows puede aprovechar metadatos de enumeración para archivos
ordinarios; los puntos de redirección requieren tratamiento del sistema. El
candidato conserva la semántica de seguir enlaces del cálculo anterior y las
guardias de rutas de los archivos operativos; no añade accesos de escritura.

## Medición y pruebas locales

`scripts-medicion/comparar_escaneo_archivos_20261031.py`:20000archivos ficticios,
Windows11/Python3.12.5, cinco recorridos por método con orden alternado, mismo total
140000bytes. Mediana anterior13.426671s/nueva.110359s (~121.7veces en ese tramo).
Evidencia `output/escaneo-archivos-20261031/resultado.json`. No mide rendimiento
Dell ni tag→pantalla; no presentar el factor como mejora global del sistema.

Almacenamiento16, archivo de cierres7 y guardias16:39pruebas aprobadas. Incluyen
todos los archivos al contar capacidad, directorios excluidos, total fresco entre
llamadas, fallo de lectura preservando copias calientes, ACK/hashes, corte tras
marcado, reintento/reapertura y cierre SDK incierto. ZIP final extraído: motor r2
14pruebas e instalador/reversión10pruebas aprobadas. Total63pruebas, sin fallos.
Instalador final326.160s en fixtures, no estimación del tiempo Dell; cubre cortes
parciales, reversión interrumpida, nuevo plan, drift y respaldo alterado. También
se verifica reconstrucción idéntica de fuentes/manifiesto desde base congelada.

## Candidato versionado, todavía sin desplegar

Archivo `tools/agente_acceso/Lecturas_Correccion_Almacen_2026.10.31-3.zip`:
191archivos/489333bytes/SHA256
`22647c03b7e89c464448b24eaa1df5153a23beb84bf16ec9b7ab44e0eeb3a889`.
Manifiesto`3d16ee4ff08a2844aaddfb8abcafae3795978e1d2e0054ee3a03ff3e7ef903e4`.
Base exclusiva: Display-2, manifiesto3eca5b039d106d5dbe383074b940d321fbe438b5a38a9964569a9316200e1a6e.
ZIP base intacto/SHAe130384297c7c4ea859c2d5a157fea0ed3d9d4732b994fc9bc3930605ea3a812.

Solo seis fuentes existentes diferentes: almacen_operativo, archivo_cierres,
runner_operativo, sus pruebas de almacenamiento y dos identificadores de versión
(produccion_paquete/runner_produccion). Añade actualizar_almacen.py, LEEME y pruebas
de instalación/reversión. Todos los otros bytes son idénticos a Display-2; CRC,
manifiesto completo y sintaxis Python verificados. Incluye disponibilidad RT3s del
ajuste anterior sin cambiar sus reglas. Evidencia de alcance:
`output/correccion-almacen-20261031/alcance-verificado.json`.

El instalador se materializa a partir del instalador revisado de Display-2, con
base/propósito y hashes exactos de este alcance. Código ordinario estático en el
paquete; no ejecuta parches de texto al instalar. Copia release inmutable nuevo y
respalda tres JSON de enlace bajo `actualizaciones_almacen/UUID`. Exige mantenimiento,
cierre completo, sync.lock y hash de plan; no inicia tareas ni abre SDK.
La reversión conserva datos y ambos releases, con plan propio. Las marcas parciales
se conservan hasta completar una operación verificada; no borrarlas manualmente.

Validación final extraída en
`output/correccion-almacen-20261031/61bf3aa0-915a-4ebe-acd1-5bc97944ba64/paquete`.
El candidato inicial de desarrollo se conserva aparte y no es el entregable.
Resumen de validación `output/correccion-almacen-20261031/validacion-completa.json`.

## Aceptación pendiente

Usuario autoriza el31oct: «Si, vamos a instalar el paquete correccion almacen».
Antes de aplicar: publicación versionada para transferencia, validación del ZIP
en Dell, pausa/cierre y plan. No solicitar de nuevo la misma autorización.
Después: nueva sesión, ciclos correctos, capturas/ACK avanzando, sin error de
almacenamiento, tendencia y antigüedad de cola descendentes y web actualizada.
Correlacionar también la captura anterior pendiente con su archive_id/ACK.
No elevar timeouts, borrar históricos o descartar estados para perseguir latencia.

Esta corrección no implementa las pantallas locales ni reduce turnos SDK. La
comprobación completa del catálogo durante arranque se conserva y puede tardar.
El límite de latencia física y la causa exacta del error SQLite siguen pendientes
de evidencia real; no se considera aceptada producción por las pruebas locales.

## Mantenimiento de tags solicitado — 2026-10-31

Antes de aprobar/instalar el candidato, usuario solicita mantenimiento para tags.
Se indica gestor instalado C:\SanIsidro\GestionTags\GestionTags.ps1. Al pulsar
Preparar recibe rechazo de cierre en mantenimiento.ps1:78, referencia soporte
d7d019b6baf8477aa839fb5dc2df6644. No se confirma cierre ni modificacion de tags.
Se solicita estado de tarea/marca y verify_closed completo desde Display-2 para
ver la condicion concreta, sin repetir Preparar ni reanudar. No atribuir el nuevo
fallo a la demora del lanzador o a SQLite sin esa evidencia.

Consulta posterior del usuario confirma tarea Disabled/Enabled=false,
mantenimiento active=true/wasEnabled=true iniciado31oct20:45:48.6819068-06 y
production_closure_confirmed/safe_to_resume=true/sdk_opened=false/tasks_changed=false.
Cierre completo aceptado para continuar mantenimiento de tags con gestor habitual.
Si la ventana conserva botones deshabilitados tras el error, reabrirla relee la
marca existente y detecta tarea deshabilitada/sin proceso; no volver a preparar.
Modificaciones concretas de tags y reanudacion posterior todavia no confirmadas.
En ese momento el paquete de archivo local todavia no tenia autorizacion de
instalacion; la autorizacion posterior queda registrada arriba.

Revision del boton a peticion del usuario: mantenimiento.ps1 espera desaparicion
del proceso canonico y ejecuta una sola llamada a gt_guard_operativo. El main de
la guardia captura cualquier Exception y oculta tipo/mensaje tras el aviso generico.
La ventana solo cambia paused=true cuando el resultado pause fue exitoso y no
reconcilia despues un cierre que llegue a confirmarse. Son limitaciones verificadas
del flujo/diagnostico; no prueban la causa exacta del rechazo inicial en cada caso.
Correccion propuesta del gestor: estado de espera explicito, comprobacion completa
con plazo, registro diagnostico sin credenciales y actualizacion de UI solo tras
cierre validado. No esta incluida ni implementada en el candidato de scandir.
