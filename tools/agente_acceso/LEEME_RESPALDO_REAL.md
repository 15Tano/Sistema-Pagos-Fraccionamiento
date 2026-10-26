# Respaldo real MDB — 2026.10.25-1

Entrada de respaldo independiente. No aplica/restaura fechas o perfiles, abre
SDK/C3, consulta API, instala tareas ni sustituye archivos operativos. Usa la
biblioteca MDB ya aceptada en Dell y sus límites de512MiB/32copias/2GiB/reserva64MiB.
La copia completa mantiene ACL privada, sin cifrado DPAPI adicional del archivo.

## Primero: instalar carpeta separada y comprobar, sin mantenimiento

Usar Python64 ya instalado. No cerrar ZKAccess ni pausar polling para estos pasos:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Respaldo_Real_MDB_2026.10.25-1.zip' -DestinationPath 'C:\SanIsidro\RespaldoReal_20261025'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\RespaldoReal_20261025\verificar_respaldo_real.ps1'
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\RespaldoReal_20261025\simular_respaldo_real.py'
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\RespaldoReal_20261025\respaldo_real_mdb.py' --preflight
```

Esperado simulation_ok/32tests/failures0/errors0/skipped0 y preflight_ok.
Simulación:28controles con tareas/SDK/archivo/creación de respaldo sustituidos;
4pruebas reales de PowerShell y DPAPI sobre credencial ficticia creada en un
temporal propio. Se ejecuta una copia de prueba del lanzador con rutas ficticias,
sin credenciales instaladas ni MDB de caseta. Temporales guardados y limpiados
bajo datos/pruebas_respaldo_real y datos/pruebas_lanzador_mdb; registros JSON/TXT.

Preflight real: exige carpeta exacta indicada/x64, hashes instalados r2,
existencia/tamaño de archivos requeridos y capacidad. Lee el plan readonly
guardado previamente en AplicadorCandidato_20261025, sesión
a4230256-23f4-4f6e-8e92-2eacba40c19b; hash exacto
709d7809d4259fb89847a2f5ef68aa15af1f69f1f3f6da9a4123fd3be2d58416.
Solo coteja archivo de plan/código y metadatos de MDB/credencial/lock. No lee
contenido de MDB ni credencial, no acredita contraseña/esquema reales, salud
de polling o cierre. Compartir ambas salidas antes de la pausa coordinada.

Si falla, no iniciar mantenimiento ni editar el plan/hashes, recrear un archivo
de credencial o mover la base instalada. Revisar la causa sin exponer secretos.

## Respaldo real, después de aceptar los pasos anteriores

No requiere SSH, túnel, presentar tag ni cambiar pagos/vigencias. Cerrar ZKAccess
y otros lectores/paneles antes del respaldo. En el gestor instalado pulsar
Preparar mantenimiento y esperar confirmación de parada. Se exige tarea
SanIsidro-Vigencias Disabled/Enabled=false, protocol2/stopped y PID anterior
ausente; revisiones/ledger SDK sin pendientes y sync.lock existente adquirido.
No realizar consultas del gestor ni abrir otros lectores mientras corre.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\RespaldoReal_20261025\lanzar_respaldo_real.ps1'
```

El lanzador descifra access-password.dpapi del usuario actual, pasa el secreto
solo en entorno al padre Python64, que lo retira del entorno y usa en memoria.
No carga token API; auxiliares no heredan SANISIDRO_*. Ninguna clave en argumentos,
salidas o JSON. Tras terminar el padre, PowerShell limpia BSTR/entorno y ejecuta
automáticamente --verificar-cierre ligado al UUID nuevo del lanzamiento.
Nunca aceptar cierre de una ejecución anterior si este lanzamiento falló.

La fuente es Database_PRO.mdb instalada, ruta fija. Destino fijo dentro de
esta carpeta: datos/mdb_reales/UUID/Database_PRO_antes.mdb, con ACL privada para
usuario actual y SYSTEM. No modificar permisos/bytes del original. Usa snapshot
histórico del tag12230693 solo para cotejar identidad/fechas en la copia; no es
vigencia actual certificada ni autorización para futuras escrituras. Si ya no
coincide, el respaldo no se confirma; no restaurar/modificar datos para forzarlo.

Esperar regreso completo al prompt. Éxito de respaldo: backup_verified=true.
Éxito separado de cierre: cierre_respaldo_confirmado, mismo pid/run_id,
source_handle_free=true. Se guarda cierre_final.json junto a resultado.json
en datos/sesiones/UUID, además de la impresión. Fase stopped del primer proceso
por sí sola no es comprobación final. El verificador exige padre ausente incluso
si el PID fue reutilizado, tarea aún deshabilitada, exclusión propia e instalada,
sin otros lectores, fuente libre y recibo/hash de copia sin cambios. Comprobación
puntual: mantener otros lectores cerrados hasta terminar mantenimiento.

Solo con cierre_respaldo_confirmado: Terminar y reanudar en el gestor y revisar
dos ciclos nuevos correctos. Si backup_verified=false pero el cierre sí se
confirma, no se obtuvo respaldo verificado; el verificador permite reanudar,
porque no se escribió la fuente ni abrió SDK. Conservar evidencia para revisar.
Si NO confirma cierre, conservar mantenimiento/evidencia; no matar procesos,
borrar locks/estados, iniciar otro intento o usar force/reset. Cierre no inicia
tareas automáticamente y no autoriza aplicación/recuperación.

## Parada propia y comprobación manual

Preferir esperar al lanzador. El límite de180s es cooperativo entre bloques y
etapas; una llamada ODBC/IO en curso puede prolongarlo. No promete plazo duro
ni mata procesos. Ctrl+C en Python solicita parar entre lecturas; no usarlo para
cerrar la PowerShell del lanzador. Si se necesita, otra PowerShell:

```powershell
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\RespaldoReal_20261025\respaldo_real_mdb.py' --detener
```

Esperar FIN y verificación automática. Si el lanzador no imprimió verificación,
solo después de terminar el padre y manteniendo mantenimiento:

```powershell
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\RespaldoReal_20261025\respaldo_real_mdb.py' --verificar-cierre
```

Esta forma manual comprueba la última ejecución y guarda su prueba. El lanzador
siempre exige además su UUID, incluso si el intento no llegó a generar estado.
Un fault/incompleto o stopped sin prueba final vinculada bloquea otro respaldo;
no editarlo para habilitar reintento.

## Alcance y pendientes

No ofrece argumentos de origen/destino/contraseña/force/aplicar. Estados propios
estado_respaldo.json/detener_respaldo.json; no reescribe estados oficiales r2,
outbox, ACK, ledger SDK o mantenimiento del gestor. Hasta64sesiones propias,
sin borrado automático. Una copia fallida puede dejar carpeta privada incompleta;
se conserva y cuenta para el límite del almacén MDB.

La verificación de la copia comprueba bytes y cinco tablas/tag; no es ensayo de
restauración completa ni certificación de cada página/relación. Archivo con
datos personales, mantener en Dell y no compartir MDB/DPAPI como evidencia.
La API seguirá siendo la única autoridad de vigencias. Próximas aplicaciones
necesitarán plan/API frescos y autorización concreta. Recuperación operativa,
unión al aplicador continuo, gestor/vigilancia, UI/endpoints y despliegue siguen
pendientes. Dependencias previas de Respaldo_MDB1 completas e intactas.
