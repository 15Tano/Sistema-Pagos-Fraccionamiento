# Preparación del despliegue de Lecturas

2026-10-30. Usuario pide avanzar sin depender de la prueba física del botón.
Se prepara revisión local y verificación de estructura; no se hace push, despliegue,
SSH, cambio de configuración de producción ni instalación en Dell.

## Separar las tres entregas

1. **Web/API:** pantalla, consultas, permisos, configuración y migraciones. Puede
   revisarse y desplegarse sin que el lector de Dell esté activado. Sin datos nuevos
   debe mostrar el estado real, no simular conexión. El historial para vigilancia
   comienza deshabilitado; administración lo conserva.
2. **Operación Dell:** capturar, guardar y enviar continuamente a HTTPS con una
   identidad propia de producción. El deploy de Laravel no instala esta parte.
3. **Botón físico:** identificar conexión/evento/puerta. No bloquea preparar la web,
   pero sigue pendiente; no implementar una clasificación por suposición.

La última aceptación del piloto de fechas fue no_changes. No es una escritura real
del candidato. La preparación operativa exige evidencia de aplicación, gestor,
reversión, transporte HTTPS y capacidad; no rellenar esos checks con true por haber
pasado simulaciones. El ensayo de latencia es readonly y usa agente/backend aislados.
No reutilizar sus credenciales/outbox como producción ni sustituir polling r2 por él.
Hace falta cerrar y publicar el instalador operativo para la versión final elegida,
incorporando el ajuste de latencia y su corrección de reinicio con pruebas de regresión.

## Orden de revisión y publicación

### A. Revisar el conjunto exacto antes de un push

La referencia local observada sigue en refactor-headless-final, tracking local
origin/refactor-headless, adelantada73 commits, con modificaciones sin commit.
No se consultó remoto en esta revisión. No hacer pull sobre este árbol ni añadir
todo con git add .; existen scripts/datos/publicaciones de otras etapas.

El script /root/deploy-sanisidro.sh hace pull de TODA refactor-headless y rsync
backend/ al docroot plano. No despliega únicamente los archivos de esta función.
Antes de publicar, revisar el alcance total contra el commit realmente desplegado,
reconciliar cualquier cambio del remoto y preparar commits con rutas explícitas.
No emitir un SHA final hasta cerrar esa revisión. La instantánea local de output
es una evidencia de archivos, no un release aprobado ni un backup de producción.

Frontend está documentado con publicación automática en Vercel al push. Verificar
el enlace y la rama actuales; coordinar una publicación controlada para no dejar
frontend nuevo y backend antiguo durante la actualización. La demo Sites pública
es ficticia y no interviene en Vercel ni en este despliegue.

### B. Ensayo separado del backend

Preparar ruta/base exclusivas, sin reemplazar la carpeta de ensayo anterior ni la
base del sitio. Instalar las dependencias del lock. Ejecutar migraciones del release
contra esa base y las comprobaciones de API/roles de esta versión. No ejecutar las
pruebas PHPUnit contra la base productiva ni copiar tokens de ensayo a producción.
La instancia MySQL de validación local no es la base del droplet.

### C. Ventana de despliegue, tras aprobación del usuario

Conservar commit anterior y copia de código, configuración y base conforme al
procedimiento del servidor. El tar de código del deploy no reemplaza una copia
consistente de MySQL. Verificar recuperación de esa copia antes de cambios de esquema.

El release necesita estas tres migraciones en este orden, además de revisar TODAS
las otras migraciones pendientes que muestre el deploy:

- 2026_10_23_210000_create_control_acceso_ingestion_tables
- 2026_10_26_070000_add_control_acceso_monitor_indexes
- 2026_10_30_010000_create_control_acceso_monitor_settings

La última crea la configuración con historial_vigilancia=false e índice por puerta.
Mantener CONTROL_ACCESO_MONITOR_ENABLED=false durante preparación del backend.
Usar el deploy habitual, con confirmaciones revisadas; no editar PHP en el docroot.
Comprobar migraciones, rutas y esquema con el comando nuevo descrito abajo.

Después coordinar frontend compatible y habilitación explícita de la bandera mediante
la configuración habitual del servidor, limpiando su caché de configuración. No ejecutar
la habilitación desde un preflight ni asumir que /up demuestra salud de Lecturas.
El flujo completo de autorización todavía debe probarse con cuentas humanas reales:
admin con lista/configuración, vigilancia sin lista y con Buscador/última lectura,
cuentas ajenas rechazadas, token de agente sin acceso humano. Luego probar el toggle
en ambas direcciones. Revertirlo a deshabilitado para vigilancia salvo nueva decisión.

### D. Activación Dell separada

No hace falta que el usuario presente tags para preparar código, pero la instalación
operativa necesita una ventana coordinada de mantenimiento y evidencia actual de Dell.
Usar agente nuevo para CO2K225060027, credencial privada DPAPI del usuario correcto,
HTTPS definitivo, almacén nuevo y paquete/versiones revisados. Conservar r2 y sus tareas
para retorno. No activar un wrapper o cambiar tareas a mano para saltar controles.
El monitor no deberá presentar el backend instalado como lector funcionando si no hay
reportes. Tampoco prometer latencia física nueva con los resultados históricos.

## Comando nuevo: revisión de solo lectura

**Todavía no está en el servidor.** Después de publicar el código correspondiente,
ejecutar en bash, desde el backend plano:

```bash
cd /home/sanisidro-back/htdocs/api.sanisidro.info
php artisan control-acceso:revisar-despliegue --no-ansi
```

No requiere ni muestra tokens. Consulta metadatos de columnas/índices, nombres de las
tres migraciones ejecutadas y solo el ajuste del historial. Revisa método, controlador
y middleware declarados de las siete rutas de ingesta/monitor. No lee vecinos, tags,
buffers, estados ni agentes. No crea tablas/agentes, ejecuta migraciones, modifica
permisos, habilita monitor, vacía cachés, consulta C3 o cambia tareas.

- status=backend_structure_ready y salida0: estructura esperada presente. Puede tener
  monitor_enabled=false; es válido durante preparación. No autoriza activación.
- status=review_required y salida1: revisar checks; no corregir automáticamente.
  columns enumera columnas faltantes; indexes y routes deben ser true;
  migrations_missing debe estar vacío y settings_valid debe ser true.
- database_review_failed: no imprime excepción SQL, host, credenciales ni ruta privada.
  Revisar conexión/privilegios de metadatos mediante el procedimiento del servidor.

Es una comprobación acotada, no una auditoría de todos los constraints/tipos, proxies,
CORS, TLS, cuentas, datos, UI, caudal o hardware. El éxito no valida todas las otras
migraciones de la aplicación ni implica que el monitor reciba lecturas.

## Volver atrás sin borrar evidencia

Si falla la web/API, deshabilitar la bandera mediante configuración y publicar la
versión compatible anterior de frontend/backend por el mismo flujo. No ejecutar
migrate:rollback de forma global: puede eliminar las tablas de ingesta y sus originales.
Conservar esquema y datos nuevos durante el retorno de código; revisar diferencias
antes de cualquier restauración de base. No abrir permisos de vigilancia como solución
a un403 esperado ni quitar autenticación para que aparezcan las lecturas.

Si falla Dell, pedir parada cooperativa, comprobar hijos/recibos/locks y usar reversión
revisada al enlace r2. No matar procesos ajenos ni borrar marcas para reanudar.
Cierre SDK incierto requiere revisión; no declara recursos libres. Tras retorno válido,
reanudar mediante gestor y comprobar dos ciclos nuevos correctos de vigencias.
No eliminar outbox, originales ni archivos ACK para volver atrás.

## Verificación local de esta preparación

- SQLite:54pruebas/489aserciones aprobadas (ingesta, monitor y11 nuevas del verificador).
- MySQL8.4.13 aislado:11pruebas/92aserciones nuevas aprobadas. Reutiliza la guardia de
  instancia/datadir/base/usuario/marcador del ensayo. No se usó MySQL de producción.
  Instancia apagada; log despliegue-20261030.stderr.log confirma Shutdown complete
  2026-10-30T16:21:20.764812Z; PID de ensayo49316 ya no existe.
- Pruebas incluyen esquema completo con bandera apagada/encendida, tabla/columna
  ausente, registro de migración faltante, índice con columnas en orden incorrecto,
  ajuste inválido, rutas sin auth/controlador antiguo, errores sin secretos y consultas
  estrictamente readonly. Comando devuelve fallo cuando requiere revisión.
- No se cambió frontend ni la demo durante esta preparación; siguen sus48pruebas previas.
- Evidencia local: output/preparacion-despliegue-lecturas-20261030/.

Pendientes remotos: revisión del commit desplegado y Vercel, autorización de despliegue,
validación en servidor y autenticación humana, instalación/activación Dell y botón físico.

## Despliegue real autorizado y estado remoto recibido — 2026-10-30

Usuario autoriza «Vamos a hacer el deploy» y confirma visita a caseta aproximadamente
17:30 America/Mexico_City. Objetivo: instalar flujo real antes de validar HDMI, tags,
latencia y botón; ajustar después según evidencia. El botón no bloquea esta publicación,
pero sigue pendiente: no inferir código ni etiquetarlo como autorización de vecino.

Servidor, salida aportada2026-10-30T19:31:32Z: repositorio limpio en refactor-headless,
HEAD07d1c49a3b8f907f2b405020e01dede40794a621. Fetch local confirma mismo origen.
Todas las migraciones listadas hasta2026_10_14_120000 están Ran; las tres de acceso
todavía no aparecen. route:list --path=control-acceso no encuentra rutas. No se ha
ejecutado deploy por esta consulta. Usuario dispone de PowerShell en Dell por AnyDesk;
se solicitó preflight actual sin mantenimiento para comparar instalación/tareas.

La autorización de despliegue sustituye la etapa previa de preparación local. No
autoriza inventar evidencia de escritura candidata ni checks operativos verdaderos.
Pendiente preparar/validar instalador final y retorno de Dell, además de publicar web/API.

### Backend publicado y comprobado

Commit backend7c91b731c2c5c5c1ce1bbba78513dbb9de2545cf publicado en origen.
Predeploy separado/root/sanisidro-predeploy/lecturas-20261030-qRVlVqc5 validó rutas,
autoload y requisitos PHP8.4.20, sin migrar ni cambiar el sitio. Copia privada con
.env: no compartir ni publicar su contenido. Usuario ejecutó después el deploy normal:
backup y rsync, Composer sin cambio de dependencias, tres migraciones DONE,
permisos y reloadPHP-FPM. Deploy20261030-194050. Raíz API404 no es fallo por sí sola.

Diagnóstico posterior aportado: backend_structure_ready=true, las siete rutas válidas,
columnas/índices correctos, migrations_missing vacío, settings_valid=true,
history_for_guards=false/revision1 y monitor_enabled=false. Salud HTTPS/up200.
No acredita captura ni envío continuo. Código/backend ya en producción, bandera aún apagada.

Identidad de producción creada con CLI habitual, token guardado solo en
/root/sanisidro-produccion-20261030/agente.txt (privado); no incluido en conversación.
UUID54d110e4-313a-45e3-bcc6-7761f3df8721 para CO2K225060027, distinto del ensayo.
No crear otra identidad ni rotarla por repetir instrucciones.

Frontend final7be031c guardado aparte y publicado después de confirmar backend.
Comprobación de publicación y habilitación todavía en curso. Dell observado en
preflight19:33:58UTC: fuentes/gestor coincidentes, tareas activas, PID11852idle,
0errores; enlace/configuración/activación no instalados. No se pausó r2 por este preflight.

Usuario confirmó promoción a producción/Ready del frontend7be031c en Vercel.
Configurador privado habilitar_monitor.php SHAaf37ba1bede9e8479c4018d483be8aa40afb7d0bbcaec969de827db1271e645e
ejecutado por el usuario: .env respaldado en/root/sanisidro-produccion-20261030/env-antes-monitor,
solo bandera modificada, propietario/permisos conservados y config:clear correcto.
Diagnóstico efectivo backend_structure_ready=true/monitor_enabled=true,
history_for_guards=false/revision1. No instalar lector por este resultado; datos nuevos pendientes.

Comprobacion publica posterior: www.sanisidro.info sirve bundle index-BQ_LbOfs.js
con monitor/actual, ajuste de historial y acceso admin. Consultas sin autenticacion
a estado/actual devuelven401. Usuario confirma entrada real con cuenta admin y
pantalla sin lecturas, esperable antes del lector Dell. No se publicaron datos en demo.

Paquete permanente final preparado y probado conservando motor r2 original, sin activar
aplicador candidato. Detalle y SHA en control-acceso-produccion-dell.md. Instalacion
Dell, parada/reanudacion y pruebas fisicas siguen pendientes; no confundir web publicada
con flujo continuo aceptado. Boton y HDMI permanecen en el plan de visita17:30.
