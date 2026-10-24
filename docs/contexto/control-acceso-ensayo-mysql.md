# Control de acceso: ensayo MySQL aislado

2026-10-23. Usuario autoriza realizar la validación MySQL propuesta. Resultado:
**24 pruebas / 186 aserciones aprobadas**, MySQL Community Server **8.4.13**.

## Entorno y alcance verificados

- XAMPP disponible incluye MariaDB 10.4.32; no había servidor en 3306.
- Se descargó el ZIP oficial de MySQL 8.4.13 y se verificó el MD5 publicado:
  `7b94489d5524dea9b27097068bea25a8`. Fuentes:
  [descarga oficial](https://dev.mysql.com/downloads/mysql/8.4.html?os=3) y
  [inicialización del directorio de datos](https://dev.mysql.com/doc/refman/8.4/en/data-directory-initialization.html).
- Instancia independiente en `backend/storage/app/control-acceso-mysql-ensayo/`,
  vinculada a `127.0.0.1:33379`, `server_id=231026`, MySQL X deshabilitado.
  No se registró servicio de Windows ni se cambió XAMPP, `.env` o producción.
- Base nueva `sanisidro_ca_ensayo_4ddd6d01fa69`, InnoDB, utf8mb4, modo estricto.
  Usuario SQL aleatorio con permisos sobre esa base y lectura de dos tablas de
  performance_schema para observar esperas. Secretos solo en configuración local
  ignorada por Git; no se incluyen aquí ni en resultados. Bootstrap retirado.
- Fixtures ficticios. Cada prueba recrea únicamente las cinco tablas de acceso y
  dos tablas auxiliares del ensayo. No usa migraciones generales ni datos de vecinos.
- Se ejecuta el kernel HTTP de Laravel en procesos PHP independientes, con rutas,
  validación y middleware reales. No se levantó un servidor web ni se comprobó HTTPS.

## Comprobaciones aprobadas

Las 17 pruebas de ingesta SQLite también se ejecutaron sobre MySQL: autenticación,
estado, eventos, originales/hash, 255, formatos desconocidos, límites, reintentos,
conflictos, rotación/revocación y rollback ante fallo durante inserción de filas.

Siete comprobaciones adicionales:

1. Tres procesos con el mismo lote: un 201, dos 200, mismo ACK y una sola copia.
2. Dos procesos con contenido distinto para el mismo lote: un 201, un 409 y sin
   respuestas/filas sobrantes del perdedor.
3. Dos reportes de estado iguales: un 201, un 200 y un solo registro.
4. Revocación confirmada mientras dos peticiones esperan: ambos 401, sin ingesta.
5. Rotación confirmada mientras esperan: la credencial anterior recibe ambos 401.
6. Cinco tablas InnoDB; reversión y reaplicación de la migración sin errores.
7. Microsegundos UTC conservados y error MySQL 1451 al intentar borrar un agente
   referenciado, preservando su historial.

En concurrencia, el proceso principal mantiene el bloqueo del agente y consulta
`performance_schema.data_lock_waits`/`data_locks`. Solo lo libera después de comprobar
que todos los workers están esperando en esta base. No se infiere concurrencia de
peticiones enviadas una detrás de otra ni de una demora arbitraria.

El código de producción de ingesta no requirió cambios por el ensayo. Los cambios
se limitan a pruebas, helpers y documentación. Se adaptaron los fixtures para
reutilizarlos con ambos motores y reconocer las comillas SQL de MySQL en el fallo
simulado de rollback.

## Protección y repetición

`ControlAccessMySqlTrial` exige configuración en la ruta exacta del ensayo, nombre
de base/usuario con prefijo restringido, versión MySQL 8.4, puerto, server_id,
directorio de datos y marcador coincidentes. La prueba se omite si no se habilita
explícitamente; no toma la base ni credenciales de `.env`.

Conservar la carpeta local preparada para repetir. Desde PowerShell:

```powershell
Set-Location 'C:\Users\kungl\Documents\San Isidro\sistema-pagos-SanIsidro_PRUEBAS 2.0\backend'
$mysqlEnsayo = Join-Path (Get-Location) 'storage\app\control-acceso-mysql-ensayo'
$mysqlArgumentos = @(
    '--no-defaults', '--console',
    ('--basedir="' + (Join-Path $mysqlEnsayo 'mysql-8.4.13-winx64') + '"'),
    ('--datadir="' + (Join-Path $mysqlEnsayo 'data') + '"'),
    '--bind-address=127.0.0.1', '--port=33379', '--mysqlx=OFF',
    '--server-id=231026', '--innodb-buffer-pool-size=64M', '--max-connections=30'
)
Start-Process -FilePath (Join-Path $mysqlEnsayo 'mysql-8.4.13-winx64\bin\mysqld.exe') -ArgumentList $mysqlArgumentos -WindowStyle Hidden -RedirectStandardOutput (Join-Path $mysqlEnsayo 'repeticion.stdout.log') -RedirectStandardError (Join-Path $mysqlEnsayo 'repeticion.stderr.log')
Get-Content -LiteralPath (Join-Path $mysqlEnsayo 'repeticion.stderr.log') -Tail 5
```

Cuando el log muestre `ready for connections`, ejecutar:

```powershell
php tests/Support/control_acceso_mysql_trial.php run
php tests/Support/control_acceso_mysql_trial.php stop
```

El comando `run` habilita solo esta clase de pruebas; conserva salida sin secretos
en `resultado-phpunit.txt` dentro de la carpeta ignorada. `stop` valida la instancia
y solicita `SHUTDOWN`; conserva datos. `prepare` se usó una sola vez con el bootstrap
inicial; no repetirlo ni reinicializar un directorio de datos ya preparado.

Suite habitual, sin habilitar ensayo MySQL:

```powershell
php vendor/phpunit/phpunit/phpunit --exclude-group=mysql-ensayo
```

Resultado habitual: 32 pruebas / 180 aserciones, 31 aprobadas y el fallo previo
`Tests\Feature\ExampleTest` (espera 200 en `/`, ruta headless vacía devuelve 404).

## Cierre y pendientes

Log del servidor confirma `SHUTDOWN` y `Shutdown complete` a
`2026-10-24T04:44:12.918626Z` (22:44:12 del 23 de octubre en México).
Instancia temporal apagada; paquete, base y resultados locales conservados.
No hay agente emisor conectado ni credencial operativa instalada en caseta.

Siguiente etapa: emisor/outbox local, primero con fixtures y servidor de ensayo,
incluyendo Internet interrumpido, ACK perdido y reinicio. Coordinador SDK y transición
del polling son etapas posteriores. La versión/configuración real de MySQL del
servidor de producción no se certifica mediante este ensayo local.
