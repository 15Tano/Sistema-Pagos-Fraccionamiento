# Servicio integrado candidato — 2026.10.26-2

Una entrada coordina vigencias, lector RT y un proceso HTTP independiente. Las
fuentes anteriores van intactas. No es una instalacion permanente ni reemplaza
el polling r2 de Dell. No instala tareas, cambia DLL, registra SDK o despliega
Laravel. La entrada Dell permite solamente un ensayo readonly de5..150s.

## Que se une

- El ciclo consulta primero la API; compara existentes en Access/C3, conserva
  fechas vencidas y deja ausentes de API intactos. No crea usuarios/permisos.
- RT cierra con recibo antes de otro turno SDK. Guarda el original antes de
  insertarlo en SQLite. Capacidad insuficiente pausa RT; no inventa exitos de
  vigencias. Cierre SDK incierto bloquea nuevos turnos.
- El emisor tiene su propio proceso, token DPAPI y canal de parada. No recibe
  password Access ni token API del padre. Red caida conserva los mismos cuerpos,
  ACK y originales. EOF del padre solicita parada; no se matan PIDs externos.
- El nucleo continuo mantiene protocol2 y parada ligada al PID para futura
  instalacion. Solo un ciclo de aplicacion verificado actualiza last_ok; la
  entrada readonly no escribe el estado instalado y reporta su comparacion aparte.
- El ciclo de aplicacion de biblioteca une los aplicadores anteriores: una copia
  MDB por ciclo con cambios, un perfil cifrado por tag, comparacion optimista,
  reconsulta API y confirmacion de C3 antes de Access. La biblioteca exige alcances
  explicitos por plan; este paquete no los emite para datos reales.

## Primero: una sola simulacion en Dell, sin mantenimiento

Extraer a C:\SanIsidro\ServicioIntegrado_20261026. En PowerShell de Dell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\ServicioIntegrado_20261026\verificar_servicio.ps1'
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\ServicioIntegrado_20261026\simular_servicio.py' --python32 'C:\Users\Dell\Python32\python.exe'
```

Prueba procesos reales, SQLite, DPAPI y una MDB ficticia con ACE. SDK/API/HTTP son
ficticios: no carga DLL, contacta C3/red, lee credenciales instaladas, abre la MDB
de caseta ni cambia tareas. Resultado esperado simulation_ok, sin fallas/errores
ni pruebas omitidas, padre64/hijo32. Conserva JSON y detalle TXT en registros/.
Compartir solo el JSON final. No preparar mantenimiento para esta simulacion.

## Ensayo readonly conjunto posterior a revisar la simulacion

Este paso consume GetRTLog real y envia al backend de ensayo ya conocido; no
necesita presentar otro tag fisico. Mantener servidor privado y tunel anteriores
activos, cerrar los otros lectores/emisores candidatos. Comprobar primero:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:18881/salud' -TimeoutSec 5
```

Preparar mantenimiento SOLO por el gestor instalado y comprobar tarea Disabled,
mantenimiento active=true y protocol2 stopped antes de iniciar. El lanzador
descifra las credenciales del usuario Dell y limpia el entorno al terminar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\ServicioIntegrado_20261026\lanzar_servicio_integrado.ps1' -Seconds 150
```

Mantener esa ventana abierta. Se verifican r2 y exclusion, recuperan originales
existentes y usan la misma outbox/identidad del ensayo anterior. La API productiva
solo se consulta para comparar; Access/C3 no reciben cambios de fechas. El
emisor solo apunta a127.0.0.1:18881, cuyo backend es la base separada del ensayo.

Para pedir parada anticipada desde otra PowerShell:

```powershell
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\ServicioIntegrado_20261026\servicio_integrado_dell.py' --detener
```

Esperar que el lanzador imprima cierre_servicio_confirmado. Guarda resultado y
cierre_final.json ligados al UUID, recibos SDK y salida del emisor. Solo entonces
Terminar y reanudar por el gestor y comprobar dos ciclos nuevos correctos. Si
falta confirmacion, conservar mantenimiento/evidencia y revisar; no borrar locks
ni marcadores. En fasefault el paquete no reanuda automaticamente.

## Limites y siguiente aceptacion

El nucleo permite duracion continua, pero no se habilita --aplicar/--continuo en
la CLI Dell. Faltan autorizacion y aceptacion de aplicacion real, instalador con
rollback, ruta canonica sincronizar_vigencias.py, gestor/vigilancia y prueba de
parada frente a360s. Tambien transporte definitivo sin SSH y retencion/alertas.
No usar el tunel y servidor PHP del ensayo como servicio permanente.

Se conservan limites anteriores de originales, SQLite y respaldos; no se borra
evidencia automaticamente. El ahorro de una MDB por ciclo no elimina la necesidad
de retencion: se conservan los topes de32copias/2GiB y1024perfiles/256MiB.
Fallo parcial de fechas conserva el bloqueo de revision; no hay rollback ciego
ni reintento automatico. La pantalla web y altas/recuperaciones siguen despues.
