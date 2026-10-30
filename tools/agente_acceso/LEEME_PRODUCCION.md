# Lecturas de produccion 2026.10.30-1

Para Dell64/SDK32; backend y web reales ya publicados. Esta entrega conserva las
reglas y los bytes r2 de calculo/escritura de vigencias. Agrega un coordinador
exclusivo, serial confirmado por conexion, recibos de Disconnect, captura durable y
envio HTTPS. No activa el aplicador candidato ni inventa evidencia de su escritura.
No abre/cierra plumas ni modifica permisos de usuarios C3.

Raiz de paquete nueva: C:\SanIsidro\LecturasProduccion_20261030.
Raiz operativa al instalar: C:\SanIsidro\ZKSync (entrada existente y mismas tareas).
No usar los lanzadores historicos incluidos como dependencias; solo produccion_dell.py.
Conservar los ZIP/carpetas de ensayos y sus originales.

## Antes de mantenimiento

1. Verificar con verificar_produccion.ps1 usando powershell.exe -NoProfile -ExecutionPolicy Bypass -File.
2. Configurar identidad nueva mediante SSH y stdin hacia Python64 --configurar.
   La credencial va directa a DPAPI del usuario actual, sin mostrarla en pantalla.
   HTTPS definitivo fijo; una peticion vacia debe devolver422 para comprobar auth
   sin insertar eventos ficticios. No usar la credencial ni la cola de laboratorio.
3. Ejecutar Python64 -B produccion_dell.py --preflight. No pausar para esto.
   Exige fuentes r2/gestor/tareas coincidentes, espacio y ausencia de instalacion previa.

El agente de esta entrega es54d110e4-313a-45e3-bcc6-7761f3df8721,
serialCO2K225060027. La clave no forma parte del ZIP ni de esta guia.

## Instalar

Cerrar ZKAccess y lectores de diagnostico/ensayo. En el gestor habitual pulsar
Preparar mantenimiento; esperar estado stopped y tarea Disabled. No Ctrl+C.

1. Python64 -B produccion_dell.py --plan: copiar el plan_sha256 recibido.
2. Python64 -B produccion_dell.py --instalar --plan-sha256 HASH_COMPLETO.
   Recalcula fuentes/XML/plan bajo sync.lock. Si cambia, se detiene sin aprobar otro
   plan. Respalda fuentes r2 y gestor, conserva ambos XML y datos, instala el wrapper
   con retorno r2 y luego activa exclusivamente este release/configuracion/identidad.
   No inicia tareas ni abre SDK durante la instalacion. No habilitar a mano la tarea.
3. Cerrar y reabrir el gestor habitual para que cargue las guardias nuevas. Pulsar
   Terminar y reanudar. La tarea existente arranca el coordinador; no crear otra tarea.
4. Comprobar dos ciclos nuevos correctos, envio, ultima lectura y pantalla web.
   Python64 -B produccion_dell.py --estado muestra datos guardados, no inventa salud.

Si no se confirma un cierre, conservar mantenimiento, marcas, carpetas y evidencia.
No borrar locks, matar procesos ajenos, desactivar la vigilancia o sincronizar todo.
Una instalacion parcial conserva revision_instalacion.json y requiere revisar el
respaldo de esa instalacion; no repetir --instalar como si fuera una carpeta nueva.

## Operacion y capacidad

Un unico propietario conserva sync.lock. RT cierra antes del ciclo r2. El gestor
solicita parada; el ciclo r2 en curso termina con sus mismas transacciones y respaldo,
se confirman hijos/Disconnect y luego queda permitido el acceso del gestor.
El emisor es otro proceso sin SDK/ACE: HTTPS, cuerpo/UUID estables y ACK obligatorio.
Lecturas nuevas se agrupan brevemente;255 se agrupan hasta5s. Maximo90 intentos
HTTP/minuto, incluidos reintentos. No garantiza latencia fisica1..3s.

Se conservan buffers originales comprimidos, cuerpos y ACK. No hay borrado por
antiguedad. Limites: originales2GiB, outbox256MiB, ACK4GiB, cierres2GiB; aviso al80%.
RT se pausa al no poder guardar con seguridad; vigencias se evalua por separado.
Revisar los avisos y capacidad periodicamente; no prometer almacenamiento ilimitado
ni borrar SQLite/archivos para liberar espacio. Custodia/retencion futura se revisan
con los datos reales de operacion. La prueba sintetica anterior no mide dias de capacidad.

## Reversion

Preparar mantenimiento desde el gestor nuevo y esperar cierre. Ejecutar
--verificar-cierre. Con safe_to_resume:true se puede generar --plan-reversion y
ejecutar --revertir --plan-sha256 HASH_COMPLETO. Restaura exactamente entrada,
vigilancia y las dos fuentes previas del gestor; conserva tareas, configuraciones,
respaldos, originales, outbox y ACK. Cerrar/reabrir gestor y Terminar y reanudar;
comprobar dos ciclos r2 correctos. No usar rollback de migraciones de Laravel para esto.

## Visita a caseta, aproximadamente17:30

Con produccion funcionando: HDMI entrada/salida, tag presentado una vez por pluma,
nombre/mensaje/espera8s y latencia visual real. Luego prueba controlada del boton de
pared: anotar hora/pluma/resultado y revisar los eventos crudos del intervalo, tambien
los que no tengan card. Codigo y conexion C3 pendientes; no atribuirlos por suposicion.
Los originales se guardan en produccion. El ajuste de clasificacion puede hacerse
desde casa en otro deploy, solo si la prueba lo requiere.
