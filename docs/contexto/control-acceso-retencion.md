# Retención del monitor de acceso

## Decisión y diagnóstico — 2026-10-31

Usuario autoriza empezar la implementación de la propuesta de 7 días técnicos y
90 días de eventos. Posteriormente confirma «Si» al despliegue y activación:
despliegue y primera limpieza autorizados, sin pedir otra aprobación por el mismo
alcance. Ejecución remota pendiente por acceso SSH rechazado.

Consultas de producción aportadas por el usuario: 38,987 filas status/255 y
1,539 eventos (1,124 código 0, 387 código 20 y 28 código 27). No atribuir paso
físico a estos registros. SHOW TABLE STATUS suma aproximadamente 91.9 MiB de
datos e índices: estados 47.6, respuestas 23.1, filas 11.6, lotes 9.5. Son muestras
de momentos distintos; Rows es estimado. El motor reportado es InnoDB, pero la
versión exacta del servidor de producción no fue consultada.

## Implementación local

- Retención calculada con CarbonImmutable UTC y fecha de RECEPCIÓN del servidor,
  no reloj C3 ni captura del PC. Umbral estricto: exactamente 7/90 días se conserva.
- Estados: a los 7 días reemplaza payload por `{}`, conservando identidad,
  hash y ACK original. Excepción permanente para el último reporte de cada agente,
  ordenado por reported_at_utc e id, igual que el monitor.
- Filas status: elimina las mayores de 7 días. Filas event: mayores de 90 días.
  Conserva la última lectura RT válida por agente y puerta 1/2 con los mismos
  predicados del display. IDs sobrevivientes nunca se renumeran.
- Respuestas: retira raw_payload_base64 solo después de 7 días y si ya no quedan
  filas asociadas. Una respuesta mixta mantiene los bytes completos mientras
  sobreviva cualquier evento; respuestas vacías, errores SDK y desconocidas
  también tienen 7 días para diagnóstico.
- Migración aditiva `2026_10_31_230000_add_control_acceso_retention_markers` agrega
  marcas UTC explícitas e índices para no confundir datos retirados con payloads
  originalmente vacíos. Reversión del esquema se rechaza si ya hay marcas: recuperar
  desde respaldo requiere una operación explícita, no reconstrucción ficticia.
- Identidades/ACK de estados, respuestas y lotes se conservan indefinidamente.
  Reintentos antiguos siguen devolviendo el mismo ACK y conflictos siguen dando409.
  El ACK describe la aceptación original, no promete conservación perpetua tras
  vencer la retención. Esta versión reduce detalle; NO acota el tamaño total ni
  elimina todo crecimiento: los comprobantes siguen acumulándose. Un límite total
  requerirá acordar una ventana máxima de reintentos y modificar el protocolo.
- No realiza OPTIMIZE ni promete devolver espacio inmediatamente al sistema de
  archivos; InnoDB puede reutilizar espacio liberado. Índices nuevos también ocupan
  espacio. El almacenamiento y ritmo residual deben medirse después de aplicar.

## Ejecución y límites

Desde backend local o raíz Laravel desplegada, después de migrar:

```bash
php artisan control-acceso:retencion
php artisan control-acceso:retencion --apply
```

Sin --apply solo consulta y calcula candidatos, incluidos los bytes que podrían
retirarse tras eliminar las filas planificadas; no modifica tablas. Cada página
comparte el bloqueo de agente con la ingesta y actualiza/elimina hasta500registros.
Por defecto20páginas por fase/agente; máximo10,000candidatos por fase/agente/ejecución.
Los conteos son acotados a esa ejecución, no totales de la base. Si hay más,
repetir; las corridas son idempotentes. El plan es una muestra, no una reserva
de los IDs: al aplicar se vuelve a comprobar elegibilidad bajo bloqueo. No cambia
el programa de Dell ni la frecuencia de captura.

Tarea Laravel horaria con withoutOverlapping, apagada por defecto:
`CONTROL_ACCESO_RETENTION_ENABLED=false`. Habilitar a true solo después de
validar el primer plan y la primera aplicación. La bandera controla el scheduler;
la aplicación manual exige --apply y funciona independientemente de ella.
Comprobar cron/schedule:run y cache compartida real para el mutex en producción.

## Despliegue pendiente

1. Revisar diff y publicar solo archivos de esta función por el flujo Git habitual.
2. Inspeccionar SELECT VERSION(), respaldo recuperable de la base, cron y cache.
3. Ensayar migración/comando en una base separada; nunca probar --apply con el
   .env de producción apuntando a su base desde una carpeta de ensayo.
4. Autorización de despliegue y activación recibida. Usar
   /root/deploy-sanisidro.sh; no modificar código del docroot a mano.
5. Migrar, ejecutar `php artisan control-acceso:revisar-despliegue` y plan readonly;
   comprobar monitor/ACK. Aplicar primera tanda revisada y medir nuevamente.
6. Habilitar tarea, reconstruir cache de configuración por el flujo de despliegue
   y verificar ejecución real y estado del monitor después de una hora.

Con solo dos días de operación normalmente no habrá detalle elegible todavía.
No se aplicó migración ni limpieza de producción. Publicación Git se registra
por separado: nunca equivale a backend desplegado.

### Intento de despliegue autorizado — 2026-10-31

Rama local refactor-headless-final siguiendo origin/refactor-headless, referencias
remotas comprobadas antes de publicar. Se conservaron cambios ajenos sin incluirlos.
SSH BatchMode a root@api.sanisidro.info devuelve Permission denied
(publickey,password); no hay clave privada en ~/.ssh ni agente SSH disponible.
No hay terminal de la app adjunta al chat. No se ejecutaron respaldo, ensayo remoto,
script de despliegue, migración, aplicación ni activación del scheduler en producción.
La autorización persiste; falta resolver acceso autenticado, no otra confirmación.

### Preflight y respaldo comunicados por el usuario — 2026-10-31 México

Sesión SSH del usuario disponible; ejecución remota mediante bloques que comparte
y devuelve. Repo remoto limpio en refactor-headless, seis commits hasta3b7a6f7;
diff backend limitado a retención. Migraciones productivas hasta2026_10_30 aplicadas.
Servidor MariaDB10.11.14 (Ubuntu24.04), cache database, timezoneUTC,13GB disponibles.
Cron de sanisidro-back ejecuta artisan schedule:run cada minuto; root sin entrada.
Ensayo previo local MySQL8.4 no certifica por sí solo compatibilidad MariaDB.

Acceso MariaDB root por socket sin contraseña rechazado1045. Alternativa usando
la configuración Laravel y archivo cliente temporal privado produjo respaldo:
`/root/backups-sanisidro/retencion-20261101-043736-4a7bc9/sanisidro-db.sql.gz`,
7.03MiB. Salida del usuario confirma dump exitoso, gzip -t y generación SHA256;
archivo cliente temporal eliminado en finally. Sin credenciales en documentación.
Esto verifica generación/compresión, NO restaurabilidad todavía. Creación de base
separada, restauración de ensayo, despliegue, migración y activación pendientes.

### Restauración aislada confirmada por salida del usuario — 2026-10-31 México

SHA256 del dump coincide. CloudPanel no admite --help en esta instalación;
db:add con nombres anteriores fue rechazado sin crear base. Sintaxis consultada
en documentación oficial; nombres alfanuméricos cortos aceptados. Base y usuario
exclusivos `sicar5502802b`, carpeta `/root/ensayo-retencion-5502802b`, conexión
localhost por127.0.0.1. Credenciales solo en cliente.cnf privado de root, no aquí.
Restauración completada con ese usuario limitado:41706filas/29257estados y
CHECK TABLE QUICK de filas, estados, respuestas y lotes devuelveOK. Esto verifica
restauración del respaldo en MariaDB10.11.14, todavía sin aplicar retención.

Preparado ejecutor `tools/retencion/ensayar.php` fuera del backend desplegado:
exige ruta /root/ensayo-retencion-XXXXXXXX, backend sin.env/cache de configuración,
base/usuario sicarXXXXXXXX y MariaDB coincidentes. Usa dependencias de su propia
copia; nunca comparte vendor/bootstrap con producción. Migra solo la nueva
migración. Compara plan/aplicación y estado/display; simula+100días solo con reloj
PHP, limpia por tandas hasta quedar idle y prueba ACK/rechazo409 con fixture nuevo.
No publica HTTP, no ejecuta workers ni envía comunicaciones. Lint y rechazo fuera
de carpeta aislada comprobados localmente; resultado real del ensayo pendiente.

### Ensayo MariaDB aprobado por salida del usuario — 2026-10-31 México

Ejecutor44397f0 extraído en carpeta aislada con vendor propio. Identidad verificada:
sicar5502802b, MariaDB10.11.14. Migración2026_10_31_230000 DONE. Fecha actual:
0estados/0status/0eventos/0respuestas retirados. Fecha PHP+100días (sin cambiar reloj
del servidor):29256estados compactados,40146status eliminados,1559eventos eliminados,
41705respuestas compactadas. Incluye un agente/respuesta status sintéticos nuevos.
Monitor de salud y última lectura de cada pluma idénticos antes/después; ACK real
idéntico tras retirar bytes; identidad modificada rechazada409; repetición idle.
Salida final ENSAYO MARIADB APROBADO. Esto sustituye el pendiente del párrafo
anterior. Producción todavía sin migración ni retención aplicada/activada.
Siguiente paso autorizado: script habitual, solo migración nueva de retención,
revisión de despliegue/plan productivo y activación posterior al resultado.

### Estructura productiva y primer plan confirmados — 2026-10-31 México

Usuario comparte ejecución desde docroot real de revisar-despliegue: estructura
backend_structure_ready=true, rutas correctas, sin columnas/migraciones faltantes,
ambos índices nuevos y anteriores presentes, configuración válida, monitor activo
y permiso historial vigilanciafalse. Esto confirma migración aplicada y archivos
nuevos presentes; no se recibió el log completo del script de despliegue ni prueba
de SHA exacto del docroot. Plan productivo04:47:28UTC del1nov: cuatro contadores0,
límites técnicos25oct04:47:28UTC/eventos3ago04:47:28UTC. Sin datos vencidos.
Primera ejecución manual --apply y activación efectiva de bandera pendientes.

### Activación productiva confirmada por salida del usuario — 2026-10-31 México

Primera ejecución manual con usuario sanisidro-back04:48:50UTC del1nov termina
mode=apply y los cuatro contadores0 (sin datos vencidos), límites UTC correctos.
Configuración .env actualizada mediante reemplazo atómico con propietario/grupo/
permisos conservados y respaldo privado previo en /root/backups-sanisidro/;
config:clear termina correctamente. config:show control_acceso confirma
retention_enabled=true, technical_days7, event_days90 y monitor_enabled=true.
schedule:list como sanisidro-back confirma0 * * * * control-acceso:retencion --apply,
próxima en11minutos (05:00UTC1nov=23:00México31oct). Cron cada minuto ya verificado.
No se recibió aún evidencia de una corrida automática real: registro y habilitación
confirmados, primera ejecución automática no observada. No cambiar esa distinción
sin salida nueva. Los pendientes de activación anteriores quedan resueltos.

Conservados respaldo y copia de ensayo privada /root/ensayo-retencion-5502802b
con base/usuario sicar5502802b y resultado; limpieza de esos recursos no ejecutada.
La copia fue alterada por ensayo de+100días y no debe confundirse con respaldo
intacto. Identidades/ACK productivos siguen acumulándose; no se prometió tamaño
total constante ni reducción inmediata de archivos InnoDB. Aún no se midió ahorro
productivo: no había datos elegibles y los índices agregados ocupan espacio.

## Verificación local

SQLite en memoria y MySQL8.4.13 aislado con helper que exige puerto33379, datadir,
server_id y marcador de ensayo. Cobertura: plan sin cambios, presupuesto de páginas,
límites estrictos, bytes mixtos, reportes atrasados, últimas lecturas y salud del
monitor, repetición de limpieza, ACK idéntico y conflictos después de retirar
detalle, migración reversible antes de limpiar y bloqueo de rollback posterior.
Resultado final: SQLite81pruebas/662aserciones (ingesta, monitor, revisión de
despliegue y retención); MySQL27pruebas/169aserciones (retención y regresiones
heredadas de ingesta), todas aprobadas. Formato Pint de los seis archivos nuevos
o formateados aprobado; diff --check de los cambios rastreados sin errores. MySQL
de ensayo detenido con helper validado al terminar, evidencia conservada. No
certifica concurrencia InnoDB con procesos
simultáneos ni versión/configuración de producción.
