# Envio vigilado — 2026.10.25-2

Candidato manual acotado; no instala servicio/tareas, no reemplaza polling,
gestor o vigilancia. No importa/carga SDK ni Access, no modifica vigencias.
API sigue siendo autoridad. Backend destino exclusivo: ensayo aislado mediante
tunel127.0.0.1:18881; no produccion. Limite5..180s,120s predeterminado.

## Primero: simulacion sin mantenimiento

Descargar ZIP a Downloads de Dell. PowerShell:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Envio_Vigilado_2026.10.25-2.zip' -DestinationPath 'C:\SanIsidro\EnvioVigilado_20261025_r2'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\EnvioVigilado_20261025_r2\verificar_envio.ps1'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnvioVigilado_20261025_r2\simular_envio.py'
```

Esperado37pruebas,0fallos/errores/omisiones, simulation_ok. Sin SDK/red/DPAPI/
Access/tareas reales. Estados/CIM/transporte/credencial ficticios, SQLite/locks
temporales y trabajadores Python ficticios propios. No presenta tags ni abre
panel/SSH. Temporales bajo datos/pruebas_envio con limpieza guardada por ruta;
detalle txt/resumen JSON en registros/. Primero compartir salida y revisarla.

ZIP2 corrige colision local reproducida: Windows rechaza os.replace cuando un
lector mantiene el JSON abierto sin permiso de borrado. Reintenta solo el
reemplazo21intentos/20esperas de50ms (hasta1s), conserva destino anterior si
persiste el fallo y limpia solo su temporal cuando es posible. No reenvia HTTP
ni cambia ACK/cuerpos por ese reintento. Nuevos diagnosticos: etapa, errno/
winerror y rol/operacion del snapshot, sin texto de excepcion/rutas/secretos.
La incidencia Dell aporto solo PermissionError, sin etapa/codigo: la colision
se verifico localmente, no certificar que sea unica causa remota. Conservar
carpeta/ZIP1 y su evidencia; no sobrescribirlos ni reiniciar la outbox.

## Implementacion candidata

- Padre supervisor inicia un solo hijo HTTP sin SDK. Credencial DPAPI existente
  se descifra solo en ese hijo, nunca por argumentos/entorno/archivos en claro.
- Reutiliza Delivery y cuatro bibliotecas publicadas, verificadas por SHA. Base
  existente C:\SanIsidro\CoordinadorEnsayo_20261024\datos\lectura_mantenimiento,
  agente c8d7ccdc-991f-497c-8383-92fb52921f8a/serial CO2K225060027 exigidos.
  No crea otra identidad/base ni reinicializa una cola faltante.
- Agrupa y envia automaticamente durante la ventana; max120intentos/minuto,
  HTTP timeout5s por IO, ACK limitado/validado, sin proxy ni redirects. Respeta
  leases60s, espera progresiva y pausa persistente existentes. No desbloquea
  errores permanentes, no renumera ni elimina mensajes/originales/ACK.
- Padre e hijo tienen PID/run_id y canal stdin propio: handshake y EOF/parada.
  Al finalizar, padre cierra canal, espera15s y confirma salida/recibo ligado a
  identidad/codigo/reporte. Puede matar solo SU hijo HTTP si excede plazo;
  ese caso queda fault, pendientes/leases conservados, no cierre confirmado.
  No se mata polling, tareas o trabajadores SDK por este componente.
- EOF por muerte del padre solicita salida del hijo tras operacion en curso.
  Limite por reloj monotono propio. No garantizar parada instantanea de una
  llamada de red/SO bloqueada; timeout de IO no es deadline total de respuesta.
- Mutex propio durante supervisor; varios emisores/versiones o envio manual
  comparten leases de outbox, no este mutex. No borrar locks/leases para forzar.
- Vigila cada10s el estado real del polling/lector/cola con inspector congelado
  de enlace2. Emisor, envio pendiente y vigencias se evaluan por separado; RT o
  ACK no renuevan last_ok de fechas. Cola vacia sin ACK nuevo no acredita red.
  Error de inventario queda desconocido y no detiene el hijo por defecto.
- CIM puede demorar hasta25s; se ejecuta en padre separado de polling y envio.
  Parada puede esperar esa observacion y despues el cierre del hijo, ademas de
  la ventana solicitada. No confundir ensayo120s con SLA estricto de salida.
- Evidencia propia en datos/sesiones/UUID: request.json, sender.json,
  closed.json, vigilancia.json, resultado.json. estado_envio.json y peticion
  detener_envio.json fuera de sesiones. No escribe estado de vigencias instalado.

## Envio real acotado: etapa posterior a simulacion aprobada

Necesita servidor aislado18880/tunel18881 activos y la DPAPI ya configurada para
Dell. No importar nueva credencial ni imprimirla. Polling sigue funcionando;
no requiere mantenimiento. No ejecutar lector/ensayo de cierres simultaneo en
esta primera aceptacion. Emisor automatico no genera capturas/eventos ficticios.

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnvioVigilado_20261025_r2\envio_vigilado.py' --ensayo --seconds 120
```

Otra PowerShell para pedir parada propia, si hace falta:

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnvioVigilado_20261025_r2\envio_vigilado.py' --detener
```

Esperar resultado; no usar Ctrl+C para una parada normal. Tras final normal:
worker_closure_confirmed true, forced_own_sender_exit false, worker_exit_code0,
sender_report con salud/ACK/manifiesto de originales conservados. Sin pendientes
no implica capturas nuevas; ultima observacion real228respuestas/85mensajes
acked/0pendientes. El ensayo1 termino con PermissionError pese a cola vacia;
no se considera cierre confirmado. No crear eventos para probar otro envio.
ACK reportados no sustituyen inspeccion SQL remota independiente.

No ejecutar botones del enlace mientras este candidato este activo: su detector
anterior considera estos procesos nuevos como herramientas desconocidas y
bloquea cierre por precaucion. Terminar primero este ensayo y revisar su salida.

## Limites pendientes

Vigilancia integrada aqui guarda diagnostico durante ensayo, no reemplaza tarea
independiente, no registra alertas popup/EventLog ni notificaciones. Servicio
permanente, integracion al coordinador SDK/entrypoint operativo, compatibilidad
de botones con nuevos procesos, almacenamiento/retencion/reconciliacion y
transicion/rollback siguen pendientes. No endpoint nuevo ni pantalla web.
