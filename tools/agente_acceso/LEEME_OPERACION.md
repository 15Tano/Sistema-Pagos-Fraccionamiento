# Integracion Operativa — candidatos 2026.10.24-2

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

Solo el inspector se ejecuta en este paso. Los otros componentes son candidatos
para integrar y validar posteriormente; no se declaran probados en ejecucion
ni en hardware por incluirlos en este paquete. Fuentes revisadas y sintaxis
comprobada; no hay ensayos de comportamiento nuevos acreditados en esta entrega.

## Ejecutar en Dell SIN mantenimiento

Descargar ZIP a Downloads y usar PowerShell de Dell:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Integracion_Operativa_2026.10.24-2.zip' -DestinationPath 'C:\SanIsidro\IntegracionOperativa_20261024'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\IntegracionOperativa_20261024\verificar_operacion.ps1'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\IntegracionOperativa_20261024\revisar_operacion.py'
```

No pausar polling, abrir ZKAccess, preparar mantenimiento ni abrir SSH/tunel.
No ejecutar desde ZKSync/GestionTags. No copiar estos archivos encima de los
instalados. Si la carpeta destino ya existe, revisar antes de extraer: no usar
Force para sustituir una entrega anterior.

## Salida

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

Validar contratos, gate y fallos con datos/procesos ficticios; implementar recibo
de cierre del worker de vigencias y su propagacion al coordinador; enlazar gestor,
publicacion de salud, proceso emisor y monitor; comparar contra r2; ensayar rollback
y recuperacion. La vigilancia candidata no emite alertas ni reemplaza vigilar_sync.
Sin servicio continuo, modo aplicar ni cambio de endpoints/pantallas en esta etapa.
Instalacion permanente requiere un paquete posterior revisado y autorizacion.
