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
