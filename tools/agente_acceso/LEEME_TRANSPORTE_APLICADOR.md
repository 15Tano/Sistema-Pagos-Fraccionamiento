# Transporte concreto padre/hijo — 2026.10.25-1

Reutiliza integración/respaldos anteriores íntegros. Conecta procesos reales,
incluida captura readonly del perfil C3 con Python32/DLL instalada. No emite
aprobaciones ni ofrece launcher de escritura real o restauración. No sustituye
SDK/bibliotecas, registra componentes, instala tareas o modifica el polling.

## 1. Comprobar en Dell sin mantenimiento

Carpeta nueva. Python64 controla y Python32 trabaja; no se carga la DLL en estas
pruebas. DPAPI y procesos sí son reales, con datos/SDK/API/MDB ficticios:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Transporte_Aplicador_2026.10.25-1.zip' -DestinationPath 'C:\SanIsidro\TransporteAplicador_20261025'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\TransporteAplicador_20261025\verificar_transporte_aplicador.ps1'
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\TransporteAplicador_20261025\simular_transporte_aplicador.py' --python32 'C:\Users\Dell\Python32\python.exe'
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\TransporteAplicador_20261025\transporte_aplicador.py' --preflight
```

Esperado simulation_ok/21tests, parent_bits64/child_bits32, cero fallos/errores/
omisiones y preflight_ok. Preflight exige rutas/x64/Python32/plan y hashes r2,
revisa ledger/revisiones anteriores sin conectar SDK. No lee contraseña Access
o token API. No abrir/cerrar ZKAccess, presentar tag o usar SSH para estos pasos.
Temporales propios bajo datos/pruebas_transporte y datos/pruebas_integracion_aplicador
con limpieza. Registros JSON/TXT. Compartir ambas salidas antes de mantenimiento.

## 2. Recorrido real readonly después de aceptar lo anterior

Una sola sesión SDK: Connect/serial/GetDeviceData user y userauthorize del tag
12230693, guardar snapshot DPAPI, Disconnect, salir Python32, validar recibo y
ACK antes de liberar gate. No GetRTLog, SetDeviceData, MDB, API o aplicación.
Plan histórico ya revisado, hash709d7809...58416 completo comprobado. Si fechas/
identidad cambiaron, no forzar coincidencia ni restaurar datos para leer el perfil.

Cerrar ZKAccess y otros lectores/paneles. En gestor instalado: Preparar
mantenimiento, esperar parada. Se exige tarea Disabled, protocol2/stopped, PID
previo ausente, sync.lock existente y ausencia de revisiones/lectores ajenos.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\TransporteAplicador_20261025\lanzar_perfil_transporte.ps1'
```

Esperar prompt, sin cerrar ventana/Ctrl+C. El lanzador verifica cierre después
de terminar el padre, con el mismo UUID. Esperado profile_verified=true,
dates_applied=false y cierre_transporte_confirmado. Se guarda cierre_final.json
junto al resultado en datos/sesiones/UUID. Solo con cierre confirmado: Terminar
y reanudar desde gestor, después dos ciclos correctos nuevos. Si perfil falla
pero cierre se confirma, reanudar conservando evidencia. Sin cierre, mantener
mantenimiento/evidencia; no borrar marcas/locks ni matar PIDs/repetir.

Snapshot cifrado queda en
C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento\perfiles\UUID.
Recibos se añaden al ledger SDK existente; no cambian outbox, originales RT o
ACK de ingesta. Salida pública solo contiene identidad/fechas del tag, cantidad
de permisos e identificador del snapshot; nunca Password/Group/permisos privados.
No compartir snapshot.dpapi ni objetos descifrados. No certifica API actual,
paso físico, niveles correctos o reloj del controlador.

Timeout SDK120s. Si hay interrupción/timeout, solo se recoge el hijo creado por
el transporte y se conserva fallo de gate/cierre_inseguro; no se abre otro SDK.
Ctrl+C del padre solicita terminar el turno antes de concluir; no es mecanismo
para detener una operación nativa inmediatamente. Verificación exige PIDs
ausentes, recibos iguales y snapshot descifrable antes de confirmar recursos.

## Aplicación concreta dentro de la biblioteca

Transport.read_child/apply_child son los callbacks concretos del aplicador.
run_closed_worker filtra SANISIDRO_* y espera salida/Disconnect/recibo, guarda
ACK fsync antes de liberar gate. Perfil es readonly y no enlaza SetDeviceData.
Ledger genérico valida también esas respuestas públicas de perfil cifrado.

apply_child requiere Approval ya obtenida por padre autorizado, intención y
bundle MDB/DPAPI. Transmite plan/hash/instante original/UUID/operación/rutas de
respaldo en grant.dpapi CurrentUser, nunca clave o datos privados en argv.
Trabajador rehidrata exactamente el instante original: no renueva TTL60s,
rechaza autorización vencida/ajena y no repite request cerrado. Padre consume
el componente al despachar, incluso si luego falla iniciar el hijo. SDK verifica
serial/hash/perfil/permisos y solo envía cuatro campos autorizados.

El archivo cifrado vincula un permiso del padre confiable; no es firma de
backend ni autenticación frente al mismo usuario de Windows. No hay opción CLI
para emitir aprobaciones, force, contraseña o elegir otra DLL. La CLI interna
--worker es el receptor del transporte, no un launcher humano de aplicación.
La ruta humana entregada solo permite lectura. Resolver autorizaciones/bloqueos
operativos sigue pendiente antes de habilitar una aplicación real.

Tests incluyen procesos reales de lectura/perfil/aplicación simulada; controlan
arquitectura, ausencia de secretos heredados, cifrado, expiración, operación y
UUID ajenos, ACK/gate antes de Access, captura y prueba final, PID vivo/reutilizado,
snapshot alterado, serie incorrecta y desconexión fallida. SDK ficticio vive solo
en tests/sdk_proceso_ficticio.py; producción no tiene flag para activar fixtures.

## Pendientes

Aceptar recorrido readonly real, autorización de una diferencia concreta y su
aplicación revisable, resolución operativa de fallos, runner continuo y conexión
al gestor/vigilancia. No forzar cambios en12230693, cuyo plan no requería cambios.
Retención, UI/endpoints nuevos y despliegue no se implementan en esta entrega.
