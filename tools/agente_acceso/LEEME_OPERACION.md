# Integracion Operativa — candidatos 2026.10.24-3

Esta entrega prepara contratos de mantenimiento, salud y turnos SDK. No instala
el coordinador operativo ni reemplaza ZKSync, GestionTags o vigilancia. No incluye
DLL/SDK, credenciales, bases ni instalador; no envia HTTP ni inicia el emisor.
La API sigue siendo la unica autoridad de vigencias.

## Componentes

- control_operativo.py: identidad PID/run_id, peticion de parada, comprobacion
  de parada y reanudacion. Legacy r2 requiere opcion explicita; un estado readonly
  no acredita arranque operativo. Estas funciones no estan enlazadas al gestor.
- salud_operativa.py: vigencias y lector/envio independientes. Vigencias usa su
  heartbeat y ultimo ciclo correcto; nunca los reemplaza por exito RT/HTTP.
  Componentes ausentes/ajenos a la ejecucion quedan desconocidos. RT255 no prueba
  reloj o trafico; sin pendientes no significa un ACK reciente.
- trabajador_controlado.py: gate compartido para turnos RT/vigencias y ejecucion
  de un hijo propio con entorno sin SANISIDRO_*. Timeout, salida no0 o falta de
  recibo de cierre bloquean otro turno. No importa/carga DLL al importarse.
  Exige un adaptador verify_closed con identidad/recibo especificos. Aun no esta
  enlazado al worker r2 ni al lector de ensayo; no usarlo como sustituto directo.
  El gate solo protege clientes que compartan ese objeto en un mismo proceso;
  no sustituye sync.lock, no protege contra ZKAccess y su fallo debe persistirse
  por el futuro coordinador antes de permitir un nuevo arranque.
- revisar_operacion.py: unico comando de esta entrega para Dell. Inspecciona
  tareas/proceso polling, JSON y hashes instalados; evalua salud sin modificarlos.

Ahora se ejecuta la simulacion de los contratos, con30casos y procesos ficticios.
Localmente pasaron las30pruebas y las50anteriores (80totales). No certifican SDK,
lock real de caseta, parada del gestor ni instalacion permanente: las comprobaciones
de lock/presencia del proceso se ejercitan como entradas del futuro adaptador.
No reemplaza version2 ya extraida; usar carpeta r3 nueva. Archivo ZIP2 conservado.

## Ejecutar en Dell SIN mantenimiento

Descargar ZIP a Downloads y usar PowerShell de Dell:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Integracion_Operativa_2026.10.24-3.zip' -DestinationPath 'C:\SanIsidro\IntegracionOperativa_20261024_r3'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\IntegracionOperativa_20261024_r3\verificar_operacion.ps1'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\IntegracionOperativa_20261024_r3\simular_operacion.py'
```

No pausar polling, abrir ZKAccess, preparar mantenimiento ni abrir SSH/tunel.
No ejecutar desde ZKSync/GestionTags. No copiar estos archivos encima de los
instalados. Si la carpeta destino ya existe, revisar antes de extraer: no usar
Force para sustituir una entrega anterior.

## Salida

Simulacion: simulation_ok, tests30, failures0, errors0, skipped0. Guarda resumen
JSON y detalle .txt bajo registros/ de la carpeta r3. Crea temporales solo en
datos/pruebas_operacion y los elimina con guarda de ruta. Inicia/cierra hijos
Python ficticios propios y ejercita timeout, sin SDK ni consultas de tareas.
La prueba del inspector sustituye tareas/archivos por fixtures antes de invocarlo.
No necesita credenciales, PHP, pyodbc, Internet ni presentacion de tags.

Si simulation_failed, compartir resumen y detalle .txt; no repetir con permisos
de tareas ni preparar mantenimiento para evitar el error. No modifica la outbox
real ni originales; tampoco envia pendientes del ensayo anterior.

El inspector readonly sigue disponible como comando separado revisar_operacion.py.
JSON compartible: tareas y PID, fechas/counters de vigencias, evaluacion candidata,
ultima muestra de watchdog/configuracion y hashes de tres fuentes conocidas.
No imprime argumentos completos, tarjetas, payloads, contrasenas o tokens.
Guarda la misma salida en registros/revision_FECHA.json de la carpeta nueva.
Solo crea esa carpeta/archivo de evidencia; no toca SQLite/originales previos,
archivos de control, configuracion, tareas o SDK. PowerShell consulta tareas y
CIM de procesos locales; no ejecuta escrituras ni comandos remotos.

Con instalacion r2 saludable se espera vigencias_evaluadas correcto,
candidate_linked false y los tres matches_reference true. Reader/sender pueden
aparecer desconocidos porque r2 no publica coordinador.estado.json. Eso describe
componentes todavia no instalados, no una falla del polling existente. Ausencias,
datos invalidos, varios procesos o reloj/estado incoherentes se muestran como
desconocido/alerta, no se reparan ni se reinician automaticamente.

El inspector puede ejecutarse entre fases del polling; es una muestra de varios
archivos leidos en instantes diferentes, no una transaccion de toda la caseta.
Una muestra ambigua requiere revisar/repetir; no usar ese resultado aislado para
habilitar tareas ni certificar mantenimiento. El modulo candidato exige inputs
de identidad/lock comprobados por el futuro adaptador; no prueba el lock instalado
ni cierra procesos por consultar su PID.

## Pendientes de esta integracion

Validacion Dell/Python32 de estos contratos; implementar recibo
de cierre del worker de vigencias y su propagacion al coordinador; enlazar gestor,
publicacion de salud, proceso emisor y monitor; comparar contra r2; ensayar rollback
y recuperacion. La vigilancia candidata no emite alertas ni reemplaza vigilar_sync.
Sin servicio continuo, modo aplicar ni cambio de endpoints/pantallas en esta etapa.
Instalacion permanente requiere un paquete posterior revisado y autorizacion.

## Ajustes de version3

Rechaza run_id anterior aunque cambie PID y exige identidad anterior confirmada;
pasar desde r2 legacy necesita opcion explicita. Heartbeat ausente no se califica
correcto durante gracia. Reader/sender se evaluan por separado ante formato invalido;
pendientes0 con fecha pendiente es incoherente. Componentes ausentes se identifican
como components_absent y legacy sin identidad como legacy_run_without_components_identity,
en lugar del motivo generico invalid_components recibido en Dell con version2.
