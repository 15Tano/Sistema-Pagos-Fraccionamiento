# Ensayo conjunto — 2026.10.25-1

Candidato separado: lectura readonly y envio a backend aislado en procesos
propios. No instala tareas/servicio ni reemplaza archivos/SDK/gestor/vigilancia.
API sigue autoridad unica de vigencias. No aplicar fechas ni presentar tags.

## Primero: simulacion SIN mantenimiento

PowerShell de Dell, ZIP en Downloads:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Ensayo_Conjunto_2026.10.25-1.zip' -DestinationPath 'C:\SanIsidro\EnsayoConjunto_20261025'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\EnsayoConjunto_20261025\verificar_conjunto.ps1'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnsayoConjunto_20261025\simular_conjunto.py'
```

Esperado simulation_ok,30pruebas/fallos0/errores0/omisiones0. Tareas/CIM/SDK,
DPAPI y transporte sustituidos; sin red/Access/SDK/tareas reales. Incluye dos
Python ficticios propios compartiendo SQLite WAL y ACK simulados. Temporales
bajo datos/pruebas_conjunto con limpieza guardada; txt/JSON en registros/.
Primero revisar salida; no ejecutar mantenimiento ni SDK en esta etapa.

## Diseno concreto

- Supervisor Python32 sin SDK inicia lanzador x64 propio que usa DPAPI Access
  instalada y delega a manual readonly del lector publicado. Ese padre toma
  sync.lock instalado; clientes C3 siguen secuenciados con gate/recibos existentes.
- lector/ contiene paquete de cierres1 completo intacto y envio/ emisor2 intacto.
  lector_conjunto.py verifica paquete y adapta en memoria SOLO atomic_json del
  entrypoint readonly al escritor con reintento1s ya probado. Evita colision de
  snapshot cuando el emisor observa el lector. No cambia funciones DLL/fechas,
  archivos congelados o formato de estado. Nuevo launcher limpia BSTR/entorno.
- Emisor propio supervisor/worker sin SDK usa misma outbox/DPAPI del agente
  c8d7ccdc-991f-497c-8383-92fb52921f8a/CO2K225060027. No otra base, identidad o
  credencial. Destino fijo ensayo loopback18881; mismo contrato ACK/leases.
- Se vinculan PID/run_id/creacion/ruta del lector y PID propio del emisor. No
  se toma estado viejo como arranque nuevo ni se pasa password en argumentos.
  El SDK recibe credenciales solo en su padre x64; emisor solo descifra la suya.
- Parada: solicitud ligada a ejecucion para lector, esperar operacion/cierre;
  dar hasta15s para cola del emisor y solicitar cierre de su supervisor/hijo.
  Red/pausa del emisor no cancela comparaciones del lector ni renueva last_ok.
  No iniciar otro SDK por fallo HTTP. Registros/capturas quedan en disco.
- No kill/terminate desde supervisor conjunto. SDK puede demorar por llamada
  en curso (worker300s), bind CIM hasta25s y espera de salida. Ventana150s no
  es SLA estricto. Si salida/recibos SDK no confirmados, persistir
  cierre_inseguro.json y revision_conjunto.json; conservar mantenimiento.
- Comprobar SDK/recibos/exclusion/lock solo despues de terminar ambos hijos.
  Watchdog r2 conocido es unica excepcion a detector de lectores: ruta y SHA
  exactos exigidos. Python desconocidos/ZKAccess/PID reutilizado bloquean.
- Estado propio en datos/sesiones/UUID/estado.json y resultado.json; control
  estado_conjunto.json/detener_conjunto.json. SDK conserva estado_cierres.json,
  detener_cierres.json y ledger/originales del almacen anterior. Emisor guarda
  evidencia propia dentro de envio/datos/sesiones. No modificar/borrar nada
  para eludir un fault o ejecucion incompleta; siguiente arranque se bloquea.
- Resultado distingue safe_to_resume_candidate (cierres), reader_ok/sender_ok,
  delivery_complete y trial_passed. Pendientes/HTTP degradado no son cierre SDK
  inseguro. Ultimo reporte de integridad valida originales/cuerpos/ACK en cola
  existente; ninguna consulta a SDK extra para ese resumen.

## Lectura/envio real — SOLO despues de aceptar simulacion

Servidor de ensayo y tunel18881 activos, paquetes/hashes originales instalados.
Cerrar ZKAccess, emisores de otros paquetes y panel candidato. Usar gestor
instalado para Preparar mantenimiento; esperar pausa confirmada. No usar altas,
consultas del gestor ni otros lectores durante el ensayo. No hace falta caseta
fisica/tag; solo trafico normal. Misma plcommpro.dll32 instalada, sin registro.

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnsayoConjunto_20261025\ensayo_conjunto.py' --mantenimiento --seconds 150
```

Esperar FIN conjunto. No Ctrl+C ni Terminar y reanudar mientras corre. Parada
propia desde otra PowerShell, si hace falta:

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnsayoConjunto_20261025\ensayo_conjunto.py' --detener
```

Tras resultado stopped sin fault y retorno al prompt:

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\EnsayoConjunto_20261025\ensayo_conjunto.py' --verificar-cierre
```

Exigir cierre_conjunto_confirmado antes de Terminar y reanudar por gestor
instalado, luego comprobar dos ciclos nuevos. No usar botones del enlace2 para
parar/verificar este nombre nuevo. Cerrar panel/supervisores anteriores por su
mecanismo propio; no matar procesos ajenos por un PID o puerto ocupado.

Si fault/no confirmacion: conservar mantenimiento/evidencia y revisar. No hay
reset/force. Una cola no vacia puede quedar persistida para reintento sin perder
originales; no confundir fin de procesos con entrega completa ni conteos con
vehiculos/paso fisico/historial completo. No instalacion permanente ni deploy.
