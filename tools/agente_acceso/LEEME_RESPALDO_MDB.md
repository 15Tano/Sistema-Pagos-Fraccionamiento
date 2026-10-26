# Respaldo MDB — 2026.10.25-1

Biblioteca candidata para copiar una MDB completa y validar su copia aislada.
Esta entrega permite solo pruebas sobre archivos ficticios. No incluye CLI para
respaldar/restaurar caseta ni se integra todavía al aplicador/polling instalado.
No requiere mantenimiento, SSH, cerrar ZKAccess ni presentar un tag para probarla.

## Comprobación en Dell

Usar Python **64 bits** ya instalado, donde está pyodbc/controlador Access.
No instalar ni registrar componentes. Una PowerShell normal, carpeta nueva:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Respaldo_MDB_2026.10.25-1.zip' -DestinationPath 'C:\SanIsidro\RespaldoMDB_20261025'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\RespaldoMDB_20261025\verificar_respaldo_mdb.ps1'
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\RespaldoMDB_20261025\simular_respaldo_mdb.py'
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\RespaldoMDB_20261025\simular_respaldo_mdb.py' --comprobar-ace
```

Esperado: simulation_ok/18 pruebas y ace_ok/7 pruebas; cero fallos/errores/
omisiones. La segunda crea MDB ficticios con contraseña conocida de prueba,
usuarios, relaciones e historial; usa ACE/ODBC, Win32 y ACL reales sobre ellos.
Incluye intento de UPDATE sobre la copia abierta readonly: debe ser rechazado.
No abre Database_PRO.mdb instalada, usa credenciales reales o conecta SDK/API.
Los temporales propios en datos/pruebas_mdb_ficticio y datos/pruebas_respaldo_mdb_ace
se limpian al terminar. Registros resumidos JSON/TXT en registros/. Compartir
solo estas salidas, no MDB/credenciales. Puede tardar alrededor de medio minuto.

## Garantías y límites de la biblioteca

- El futuro padre debe mantener sync.lock/mantenimiento y pasar guard. La
  biblioteca no pausa tareas ni demuestra por sí misma haber adquirido ese lock.
- CreateFileW solo lectura, OPEN_EXISTING y share=0: si otra aplicación tiene
  la fuente abierta, falla sin cerrar procesos ni intentar una copia compartida.
  El handle se conserva durante copia, fsync, tamaños y comparación SHA256;
  se cierra antes de abrir la copia con ACE; la fuente no se abre por ODBC.
- Carpeta UUID nueva con ACL Windows protegida desde su creación: usuario
  actual y SYSTEM, sin herencia adicional. Se verifica la ACL antes de copiar.
  No se cambian permisos del original, carpetas instaladas u otros respaldos.
  Se rechazan rutas reparse/junction/symlink mediante biblioteca previa.
- Copia binaria completa, incluido contenido no consultado, sin compactar ni
  reparar. Lectura posterior con ACE readonly, autocommit=false, rollback/close;
  verifica columnas mínimas y COUNT en USERINFO, CHECKINOUT, acc_levelset,
  acc_levelset_emp y personnel_issuecard; compara identidad/fechas del tag del
  plan. Las demás tablas se copian byte por byte, pero no se inspeccionan.
- Hash de copia antes y después de validación debe ser igual al copiado bajo
  exclusión. Recibo manifest.json exclusivo/fsync solo después de comprobar
  lectura y cierre. Fallo no devuelve copy_verified, conserva copia incompleta
  y no autoriza aplicación. No hay escritura C3/Access de origen ni Approval.
- Máximo512MiB por MDB,32respaldos/2GiB acumulados y reserva64MiB. Lee bloques
  de1MiB; no carga la base completa en memoria. Incompletos también cuentan;
  no borra respaldos para hacer espacio. Retención/exportación a definir para
  operación, límites actuales de la biblioteca candidata.

La MDB completa queda como archivo Access bajo ACL privada. **No** se añade
cifrado DPAPI al archivo completo; el snapshot selectivo previo sí usa DPAPI.
Esto no equivale a cifrado de disco ni copia externa portátil. No ofrece defensa
contra el mismo usuario/administradores que controlen Windows. No enviar a Git,
mensajería o subir a servidor ese archivo con datos personales. Documentación
y paquete contienen únicamente código y fixtures.

Las comprobaciones prueban igualdad de bytes y lectura de cinco tablas/tag;
no son una certificación de integridad de cada página/relación ni una prueba
de restauración integral. Abrir una copia histórica no la convierte en fuente
de vigencias: toda conciliación futura debe reconsultar API actual.

En ACE local, Dbq/PWD entre llaves se interpretaron literalmente al abrir una
MDB con contraseña ficticia. El conector nuevo usa ruta simple validada y PWD
sin envolver; rechaza separadores/control/espacios externos que no puede
representar con seguridad. No prueba variantes de contraseña ni modifica el
conector r2 publicado/instalado. Compatibilidad de la credencial real pendiente;
no compartirla ni ponerla como argumento de consola.

Se usa Windows PowerShell/.NET para crear/verificar ACL, sin depender de la
autocarga de Get-Acl desde otros hosts PowerShell. Procesos auxiliares no
heredan variables SANISIDRO_*. Creación ADOX solo para MDB ficticios de tests.

## Siguiente etapa

Aceptar primero las dos salidas Dell. Después unir el respaldo al padre bajo
mantenimiento, obtener copia real en una pausa coordinada y revisar su cierre
y retorno del polling. No ejecutar ahora lanzadores históricos incluidos.
Aplicación real, restauración selectiva operativa, runner continuo, vigilancia,
pantalla/endpoints nuevos y despliegue siguen pendientes.

Dependencia: Respaldo_Protegido_2026.10.25-1 completo e intacto. Ver referencias:
[CreateFileW](https://learn.microsoft.com/windows/win32/api/fileapi/nf-fileapi-createfilew),
[DirectorySecurity](https://learn.microsoft.com/dotnet/api/system.security.accesscontrol.directorysecurity?view=netframework-4.8.1).
