# Preflight aislado del emisor — 2026.10.23-1

Comprueba el Python que lo ejecute: SQLite en disco con WAL/FULL/FK, originales,
reapertura, leases, ACK simulado y cifrado/lectura DPAPI del usuario actual.
Solo utiliza archivos temporales propios junto al paquete. Los retira al terminar
y conserva `registros/<ejecucion>/resumen.json` sin secretos.

No solicita credenciales reales, conecta por red, carga el SDK ZKTeco, consulta C3,
toca Access, cambia el reloj ni instala tareas. **No pausar el polling** para esto.
El ACK es ficticio: aprobar este diagnóstico no certifica una entrega al backend.

Extraer en carpeta nueva y verificar antes de ejecutar:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Preflight_Emisor_2026.10.23-1.zip' -DestinationPath 'C:\SanIsidro\PreflightEmisor_20261023'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\PreflightEmisor_20261023\verificar_preflight.ps1'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\PreflightEmisor_20261023\preflight_dell.py'
```

Compartir la salida de verificación y el resumen impreso. Resultado esperado:
`status=compatible_local`, checks en true y `temporary_files_removed=true`.
Si aparece incomplete, conservar el reporte; no modificar programas de caseta.
La prueba queda asociada al Python, arquitectura y usuario que figuren en el resumen;
no certifica otro usuario/equipo ni el arranque mediante una tarea programada.
