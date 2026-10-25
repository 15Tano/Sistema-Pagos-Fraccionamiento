# Puente SDK readonly — 2026.10.25-1

Conecta el nuevo núcleo al inventario C3 mediante la DLL32 instalada, sin
habilitar escritura. Compara un plan readonly de r2 con otro del candidato,
secuencialmente, bajo el bloqueo instalado. Sin RT ni envío HTTP/outbox.
No sustituye polling, gestor, tareas, bibliotecas o credenciales.

## Primero: verificar y simular, sin mantenimiento

PowerShell de Dell:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Puente_Readonly_2026.10.25-1.zip' -DestinationPath 'C:\SanIsidro\PuenteReadonly_20261025'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\PuenteReadonly_20261025\verificar_puente_readonly.ps1'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\PuenteReadonly_20261025\simular_puente_readonly.py'
```

Esperado simulation_ok, 23 pruebas, fallos/errores/omisiones0. SDK/API/Access,
DPAPI/tareas/CIM sustituidos: ninguna llamada real. Temporales con limpieza
guardada bajo datos/pruebas_puente_readonly. Compartir salida antes del ensayo.

## Ensayo real posterior, solo tras revisar la simulación

No necesita caseta física/tag ni servidor/túnel SSH de ensayo. Necesita conexión
a la API de vigencias habitual, Access y C3. Cerrar ZKAccess/otros lectores y
paneles candidatos; conservar el gestor instalado para pausar/reanudar.

1. Preparar mantenimiento desde el gestor instalado. Confirmar tarea
   SanIsidro-Vigencias Disabled/Enabled=false, mantenimiento activo y polling
   stopped. No usar altas/consultas del gestor mientras corre el ensayo.
2. Ejecutar en PowerShell de Dell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\PuenteReadonly_20261025\lanzar_puente_readonly.ps1'
```

Esperar FIN puente y regreso al prompt; no Ctrl+C ni reanudar mientras corre.
Son dos ciclos secuenciales, no ventana150s. Las consultas API/Access/C3 pueden
demorar; una llamada de inventario admite hasta300s. No matar SDK por demora.
La parada propia desde otra PowerShell es:

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\PuenteReadonly_20261025\ensayo_puente_readonly.py' --detener
```

Se atiende entre comparaciones; no interrumpe un ciclo en curso.

3. Tras phase stopped y retorno al prompt, comprobar cierre:

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\PuenteReadonly_20261025\ensayo_puente_readonly.py' --verificar-cierre
```

Solo con cierre_puente_confirmado: Terminar y reanudar por gestor instalado y
comprobar dos ciclos correctos nuevos. Si phase fault/cierre no confirmado,
conservar mantenimiento y evidencia. No borrar marcas/recibos para continuar.

## Qué observar

trial_passed true exige ambos planes completos e iguales y recibos verificados.
Comparación ignora solo el orden de filas; conserva vigencia API, existencia y
banderas de cambio. Una diferencia no prueba un fallo del candidato: API/Access/
C3 pueden cambiar entre consultas. Se guardan ambos CSV, hashes y conteos para
revisar. SDK cerrado y planes distintos son resultados separados: una phase
stopped permite verificar/reanudar, pero no aceptar la comparación como igual.

Evidencia por UUID en datos/sesiones, estado/resultado JSON y carpetas
referencia/candidato. Nuevos recibos se agregan al ledger existente de ensayo:
C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento\cierres.
No se toca outbox.sqlite, originales RT, ACK ni estado_cierres.json anterior.
Estado/stop nuevos: estado_puente.json y detener_puente.json. No botones del
panel candidato anterior para esta ruta nueva; usar los comandos propios.

El worker nuevo valida paquete, Python32, mantenimiento, SHA DLL y serial;
rechaza cualquier payload distinto de mode=read antes de abrir SDK. No enlaza
SetDeviceData; write_dates siempre rechaza. Reutiliza declaraciones y lectura
GetDeviceParam/GetDeviceData del diagnóstico publicado, sin registrar SDK.
Solo persiste cuatro campos de inventario; no Password ni datos personales.

El padre usa x64/DPAPI existente para comparar Access, sin password en argumentos.
Los trabajadores no heredan SANISIDRO_*. Se exige recibo, salida y ACK durable
antes de otro turno. Cierre final comprueba PID/UUID/recibos, ausencia de lectores
según inventario y lock bajo mantenimiento. Watchdog r2 solo se exceptúa con
ruta/hash conocidos; PID reutilizado o Python desconocido impiden confirmar.

Dependencias publicadas intactas: cierres1 completo, dos fuentes del núcleo1 y
envío2 completo. El envío2 se importa para publicar snapshots y consultar
procesos, sin arrancar emisor. No ejecutar sus lanzadores históricos en este paso.
Faltan runner operativo, aplicación real autorizada, vigilancia/rollback y
transición. Este ensayo no habilita fechas ni certifica operación permanente.
