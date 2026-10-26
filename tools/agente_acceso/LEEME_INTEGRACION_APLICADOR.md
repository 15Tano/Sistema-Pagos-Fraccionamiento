# Unión del aplicador — 2026.10.25-1

Biblioteca candidata y pruebas aisladas. No contiene CLI para aplicar fechas
reales ni emite aprobaciones. No modifica caseta/polling/gestor/tareas/SDK.
No requiere mantenimiento, SSH, presentar tag o cerrar ZKAccess para probarla.

## Comprobar en Dell

Usar Python64/ACE ya instalados. Carpeta nueva, sin sobrescribir paquetes:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Integracion_Aplicador_2026.10.25-1.zip' -DestinationPath 'C:\SanIsidro\IntegracionAplicador_20261025'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\IntegracionAplicador_20261025\verificar_integracion_aplicador.ps1'
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\IntegracionAplicador_20261025\simular_aplicador_integrado.py'
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\IntegracionAplicador_20261025\simular_aplicador_integrado.py' --comprobar-ace
```

Esperado: simulation_ok/25tests y lab_reconciliation_ok/1test, cero fallos/
errores/omisiones. El segundo crea MDB ficticios con contraseña conocida,
respaldo MDB privado y perfiles DPAPI reales; SDK/API siguen sustituidos. Primero
simula C3 actualizado y fallo de Access. Luego propone plan contra API nueva y
ejecuta conciliación **solo en otra MDB ficticia**; preserva otro usuario,
membresías e historial. El intento original conserva su bloqueo y evidencia.
No se usa Database_PRO instalada, respaldo real de Dell o sus credenciales.

Evidencia resumida en registros JSON/TXT. Temporales propios se limpian bajo
datos/pruebas_integracion_aplicador y datos/pruebas_respaldo_mdb_ace. No compartir
MDB/DPAPI reales ni ejecutar los lanzadores históricos incluidos como dependencias.

## Flujo implementado

aplicador_integrado.prepare_bundle enlaza copia MDB verificada con snapshot
DPAPI de usuario/permisos C3 y hash de un mismo plan. Se prepara antes de crear
Approval, para que el tiempo del respaldo no reinicie ni consuma artificialmente
su caducidad. Antes de aplicar, se vuelven a comprobar ambos respaldos, hashes,
identidad y copia. Una validación larga tampoco renueva el TTL de60s.

El padre debe conservar sync.lock/mantenimiento y llamar guard; las rutas de
almacenes se proporcionan por el padre confiable, nunca desde los manifiestos.
La interfaz no autentica al operador/backend por sí misma. El perfil completo
inicial debe obtenerse de un lector con cierre acreditado; esta biblioteca no
implementa todavía ese transporte de lectura de perfil completo.

run_worker exige operación exacta de un tag, hash/plan/respaldo/intención
coincidentes antes de abrir DLL. BundledDatesPanel coteja el perfil completo y
permisos contra DPAPI, persiste referencia del respaldo antes del Set y envía
solo los cuatro campos de fechas/identidad. Todos los demás campos se conservan
y comparan después. Conserva binding/serial/ABI de las fuentes aceptadas.

execute reusa el aplicador anterior con API fresca antes de cada componente y
respaldo obligatorio si hay cambios. Callbacks de lectura/aplicación deben
devolver ClosedWorker de run_closed_worker y carpeta propia del ledger. Se
comprueban UUID, PID/salida0, operación y respuesta/hash, cierre, ACK durable,
gate libre y referencia al snapshot antes de que Access actualice sus tres
columnas. Los callbacks del padre confiable deben acreditar la salida real y
guardar ACK antes de liberar el gate. Un objeto fabricado/booleano/hash no
sustituye transporte, autenticación o aprobación. SDK de pruebas es ficticio.

Cada transacción conserva resultado del aplicador e índice exterior. Fallo,
corte o resultado parcial bloquean otro UUID desde evidencia; no reset/force
ni borrar el intento. Un plan sin diferencias hace lectura con cierre y no
fuerza respaldo completo ni escrituras. No se cambian pagos/asociaciones/niveles.

## Recuperación y límites

review_recovery relee respaldos, exige gate sin fallo y genera propuesta contra
API actual. Puede conservar vencimiento pasado; bloquea identidad/permisos/
campos privados distintos o tag ausente. Nunca devuelve retry_authorized=true,
emite Approval ni suprime marcadores. El ensayo nativo en otra MDB demuestra
la conciliación de fechas bajo un plan nuevo y aprobación ficticia, conservando
el original sin cambios. **No habilita reintento en el origen bloqueado.**

Faltan la revisión/autorización y resolución operativa de esos bloqueos,
transporte concreto entre padre y trabajador x86 (incluida aprobación con TTL
original), lectura segura del perfil completo, launcher de aplicación y prueba
real autorizada. No se instala servicio continuo ni se conecta esta biblioteca
al polling todavía. Retención de índices de transacción se debe definir al
construir el padre operativo; no usar la biblioteca en un bucle sin ese límite.

Las rutas/manifiestos/hashes verifican integridad dentro del contexto del padre
confiable; no son firmas frente a un atacante que controla el mismo usuario.
No nueva pausa o copia real necesaria para aceptar estas pruebas. La última
evidencia real de r2 sigue siendo la aportada tras el respaldo: dos ciclos
correctos21:07/21:08México25oct. Pruebas locales no actualizan esa salud.

Incluye Respaldo_Real_MDB1 completo e intacto. Pantalla, endpoints nuevos y
despliegue siguen fuera de esta entrega. API permanece única autoridad.
