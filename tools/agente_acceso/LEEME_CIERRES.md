# Cierres del coordinador — 2026.10.24-1

Ensayo candidato separado: SDK instalado sin cambios, comparacion readonly y
captura RT. No reemplaza polling/gestor/vigilancia, no instala tareas, no aplica
fechas ni envia HTTP. API unica autoridad de vigencias. No incluye DLL ni SDK.

## Primero: simulacion en Dell SIN mantenimiento

Descargar ZIP a Downloads. PowerShell de Dell:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Cierres_Coordinador_2026.10.24-1.zip' -DestinationPath 'C:\SanIsidro\CierresCoordinador_20261024'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\CierresCoordinador_20261024\verificar_cierres.ps1'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\CierresCoordinador_20261024\ensayo_cierres.py' --simular
```

Esperado simulation_ok,21pruebas, errores/fallos/omisiones0. Solo datos e hijos
Python ficticios propios; SDK sustituido, sin tareas reales, HTTP, Access o DPAPI.
Temporales en datos/pruebas_cierres de esta carpeta, limpieza con guarda de ruta;
resumen y detalle .txt conservados en registros/. No presentar tags ni abrir SSH.
No ejecutar lectura real hasta revisar esta salida.

## Cambios de esta etapa

- Adaptador de vigencias invoca la misma referencia r2 verificada con
  cycle(password,False,None). Sustituye exclusivamente su worker por uno readonly
  con SDK instalado, GetDeviceParam/serial y GetDeviceData user con argumentos
  conocidos. Retiene solo CardNo/Pin/StartTime/EndTime, no Password/Group.
- El trabajador RT conserva buffer/payload/metadatos existentes antes del IPC.
  El envoltorio emite closed.json solo al volver del worker: despues de
  Disconnect y cierre de directorio. No cambia la interpretacion de eventos.
- Gate compartido en el padre: cerrar RT antes de otra comparacion y confirmar
  cierre del inventario antes de iniciar RT. Hijos sin entorno SANISIDRO_*.
- Cada hijo deja closed.json con PID, run_id, UUID propio, rol, hash SDK y fechas
  del PC. El padre exige salida0 y coincidencia del recibo, hash/tamano de respuesta
  cuando aplica, y guarda parent_ack.json antes de continuar.
- Timeout, salida no0, recibo ausente/invalido o falta de confirmacion del padre
  detienen nuevos clientes. Se traduce a UnsafeClosure, fallo fatal del coordinador;
  un error normal de datos con cierre confirmado es un ciclo fallido, no un cierre
  inseguro. Serial inesperado o error de almacenamiento tambien exige revision.
- Los recibos prueban ejecucion de la ruta de cierre y salida del proceso, no el
  estado interno de firmware/red. Mantener limitacion de clientes externos:
  ZKAccess no respeta sync.lock y debe estar cerrado durante lectura real.

## Lectura real preparada: paso posterior

Usa el almacen anterior existente, sin copiarlo ni inicializar otra identidad:
C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento\outbox.sqlite.
Agente c8d7ccdc-991f-497c-8383-92fb52921f8a, serial CO2K225060027. Los149originales
previos y ACK permanecen alli. Nuevas capturas usan el mismo directorio originales/
y UUID/formato; emisor anterior sigue compatible. No incluye credencial nueva.

Datos nuevos bajo ese mismo almacen: cierres/UUID/{request,response,closed,parent_ack}
(response solo inventario), estado_cierres.json, resultado_cierres.json y
comparacion_cierres.log. No reemplaza el estado del polling ni el viejo estado
del ensayo. Capacidad ledger64MiB, respuesta16MiB y reserva80MiB antes de cada
trabajador; RT/outbox conservan limites anteriores. No hay borrado automatico.

Al empezar se comprueba ledger anterior, fallo persistido y estado fault. Recibo
sin parent_ack bloquea reinicio aunque el hijo diga closed: el padre pudo caer.
No borrar ni editar cierre_inseguro.json, solicitudes/recibos, estado o locks
para continuar. No hay reset/force automatico: revisar procesos y evidencia.
La falta de disco puede impedir escribir la marca de fallo; un request durable
sin ACK tambien impide siguiente arranque. No garantiza cero perdida RT entre
GetRTLog y primer guardado; ni historial completo/reconciliacion.

Lectura real requiere Preparar mantenimiento confirmado por gestor, ZKAccess
cerrado, tarea deshabilitada/no Running y sync.lock instalado retenido por padre.
Cuatro fuentes r2 instaladas deben coincidir. No usar otros lectores/coordinadores
o consultas/altas del gestor durante el ensayo. Este nombre/ruta sigue sin ser
reconocido por el gestor: usar limite o parada propia, no Terminar y reanudar
mientras corre. Python x64/DPAPI Access en padre, Python32 instalado para SDK.

Tras autorizar el paso, PowerShell Dell (ejemplo150s):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\CierresCoordinador_20261024\lanzar_cierres.ps1' -Seconds 150
```

Parada propia desde otra PowerShell:

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\CierresCoordinador_20261024\ensayo_cierres.py' --detener
```

Limite180s mas operaciones en curso/cierre; timeout del hijo de inventario300s y
API/Access conservan sus timeouts. Una llamada iniciada puede demorar la parada.
No se fuerza parada ni desconexion de procesos ajenos para cumplir el plazo.

Al cierre normal: phase stopped, gate fault false, errores null, recibos
confirmados y health con pendientes locales normales (no HTTP). Usar Terminar y
reanudar del gestor y comprobar dos ciclos nuevos de r2. Ante fault o cierre sin
confirmar: no reanudar automaticamente, conservar todo y revisar. La captura RT
no renueva last_ok de vigencias: snapshot observado separado de cycle_probe.

## Alcance pendiente

Simulacion valida adaptadores y protocolos con SDK sustituido/procesos ficticios.
No certifica Disconnect de DLL/firmware real ni recuperacion de un corte durante
escritura Access/C3. Lectura real, controles desde botones del gestor y vigilancia
integrada aun pendientes. No hay modo aplicar/continuo ni transicion operativa.
