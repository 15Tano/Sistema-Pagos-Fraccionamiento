# Latencia Candidata 2026.10.28-2

Primero validar la simulacion en Dell. No preparar mantenimiento para simular.
Esta entrega no instala servicios ni activa la pantalla web. No cambia el droplet.

## Ajuste de esta publicacion2

El validador sigue revisando SHA de las cuatro fuentes r2 y validando cada dato
nuevo de API. Reutiliza su preparacion interna en lugar de importar/compilar
los mismos modulos por tarjeta. Los adaptadores siguen recibiendo modulos nuevos;
no comparten cambios de worker/ROOT. Se ejecutan exactamente los bytes verificados.
No se cachean vigencias, permisos, tarjetas ni resultados de API.

La simulacion incluye86 pruebas y compara837 planes ficticios contra el codigo
congelado de la publicacion1. Imprime tiempos y SHA de planes; exige igualdad de
planes. Los tiempos locales no garantizan la pausa real de Dell ni latencia web.

El destino es una carpeta nueva con sufijo_r2. No sustituir la carpeta/ZIP1 ni
sus originales. El SDK, r2 instalado y backend de produccion no se modifican.

## Comportamiento conservado del candidato

- RT cada0.5s despues de terminar la consulta anterior; sigue habiendo UN propietario SDK.
- El proceso emisor forma lotes aunque el padre compare vigencias. Espera breve de0.15s al recibir eventos, minimo1.25s entre lotes; buffers solo255 se agrupan hasta5s.
- Limite de90 intentos HTTP/minuto por ejecucion, incluyendo estados/reintentos. Los reintentos conservan el mismo cuerpo/UUID y respetan backoff. Entre ensayos exige60s desde cierre final.
- Salud cada2s y ante cambios. Dos respuestas255 consecutivas confirman que se observo cola vacia; una interrupcion/reconexion exige confirmarlo otra vez. Un evento aislado conserva esa observacion hasta2s, con el timestamp REAL del ultimo255.
- Turnos mediante propietario nativo ya preparado: nacimiento del proceso, DPAPI, hashes y locks. No PowerShell por cada lectura. Se mantiene comprobacion completa al entrar/salir y exclusion instalada.
- Tiempos de captura, lote, HTTP/ACK y transiciones guardados en Dell. No se usa la resta cruda de relojes servidor/Dell como latencia.

La API sigue siendo autoridad de vigencias. Esta entrada SOLO compara; no aplica fechas, no abre plumas ni cambia permisos/tags. Usa la DLL x86 instalada y su hash conocido, sin registrar o sustituir SDK.

## 1. Simulacion (sin SDK/red/datos de caseta)

Extraer en `C:\SanIsidro\LatenciaCandidata_20261028_r2` y ejecutar, en PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\LatenciaCandidata_20261028_r2\verificar_latencia.ps1'
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\LatenciaCandidata_20261028_r2\simular_latencia.py' --python32 'C:\Users\Dell\Python32\python.exe'
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\LatenciaCandidata_20261028_r2\latencia_dell.py' --preflight
```

DPAPI/SQLite y procesos de prueba son reales; API/SDK son ficticios. No mide velocidad real ni certifica capacidad del droplet. Solo usar los lanzadores de ESTA entrega; los verificadores historicos incluidos pertenecen a otras publicaciones.

## 2. Ensayo readonly, despues de revisar la simulacion

Duracion:150s mas comprobaciones de entrada/cierre. Puede hacerse sin presentar tags, observando trafico normal. El polling r2 NO aplica vigencias durante esos150s.

1. Mantener servidor de ensayo en127.0.0.1:18880 y tunel Dell18881 como antes. Confirmar `Invoke-RestMethod -Uri 'http://127.0.0.1:18881/salud' -TimeoutSec 5`.
2. Cerrar ZKAccess, paneles y otros lectores. Usar **Preparar mantenimiento** en el gestor. Confirmar tarea Disabled/EnabledFalse y estado r2 stopped.
3. Ejecutar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\LatenciaCandidata_20261028_r2\lanzar_latencia.ps1' -Seconds 150
```

No modifica las tareas ni el lanzador instalado. Crea almacen NUEVO en `datos\propietario\acceso-datos`; no modifica la outbox del ensayo anterior. Reutiliza solo la credencial DPAPI del agente del backend aislado. No envia a produccion.

Mientras corre se crea una marca propia `GestionTags\revision_pendiente.json` para impedir reanudar antes del cierre. **El verificador final retira exclusivamente esa marca**, despues de comprobar salida del padre, hijos, recibos y locks. Si falta un cierre, conservar mantenimiento y evidencia; no borrar marcas manualmente. Ante SDK incierto el padre conserva ademas los locks.

4. Esperar `cierre_latencia_confirmado`. Guardar la salida y `medicion.json` en la carpeta indicada. Entonces **Terminar y reanudar** por gestor y comprobar dos ciclos nuevos correctos de r2.

Para pedir parada sin Ctrl+C, desde otra PowerShell:

```powershell
& 'C:\Users\Dell\AppData\Local\Python\pythoncore-3.14-64\python.exe' -B 'C:\SanIsidro\LatenciaCandidata_20261028_r2\latencia_dell.py' --detener
```

Esperar al lanzador original; pedir parada no confirma cierre ni reanuda tareas.

## Como interpretar el resultado

La salida final ya separa respuestas con eventos, estados255 y desconocidas en
`groups`, y muestra `inventory_worker_wall` y `between_rt_workers`. Son tramos
medidos de SDK/PC; no presentacion fisica a navegador. No hace falta ejecutar el
analizador aparte para obtener esos mismos grupos del nuevo ensayo.
`workers_failed_operation` distingue error de operacion de cierre SDK limpio.
Si aparece `negative_worker_time_deltas`, revisar reloj; esos intervalos no entran
al percentil y no se diagnostica concurrencia SDK usando solo relojes.

`trial_passed` exige ciclos readonly sin errores y cierres confirmados. La medicion incluye conteo de capturas con ACK y pendientes: al terminar puede quedar una cola final durable; no se descarta ni se afirma enviada. El siguiente ensayo recupera esos originales con los mismos UUID. No repetir para drenar sin revisar primero el resultado.

`capture_end_to_http_ack` mide desde fin SDK hasta recibir un ACK valido en el MISMO PC. Incluye agrupacion/esperas/red/API/vuelta; no el instante fisico de presentar el tag ni el pintado web. Los percentiles excluyen capturas sin ACK y muestran sus conteos. Deltas negativos invalidan la interpretacion temporal. Eventos viejos de la cola no se consideran automaticamente recien presentados.

Pendientes tras aceptar esta prueba: verificar latencia hasta navegador, ajustar consulta/salud del monitor dentro de su presupuesto compartido y valorar activacion operativa. El frontend mantiene su cadencia actual; esta entrega no promete1..3s ni streaming permanente. No requiere cambiar el droplet.
