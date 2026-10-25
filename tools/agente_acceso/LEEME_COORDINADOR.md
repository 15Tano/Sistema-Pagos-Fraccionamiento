# Coordinador de ensayo — 2026.10.24-1

Etapa experimental separada. No reemplaza ZKSync/GestionTags, no instala tareas,
no aplica fechas y no envia HTTP automaticamente. La API sigue siendo la unica
autoridad de vigencias. No hay nuevo SDK; se conserva la DLL x86 instalada.

## Primera ejecucion en Dell: simulacion SIN mantenimiento

Descargar a Downloads y ejecutar como usuario Dell en PowerShell:

```powershell
Expand-Archive -LiteralPath 'C:\Users\Dell\Downloads\Coordinador_Ensayo_2026.10.24-1.zip' -DestinationPath 'C:\SanIsidro\CoordinadorEnsayo_20261024'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\SanIsidro\CoordinadorEnsayo_20261024\verificar_coordinador.ps1'
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\CoordinadorEnsayo_20261024\ensayo_coordinador.py' --simular
```

Esperado simulation_ok, las cinco comprobaciones true. Usa reloj virtual de
150 segundos (no espera dos minutos y medio reales). Los pendientes son ficticios
y esperados: esta simulacion no envia a red. Conserva SQLite, originales y linea
de tiempo en datos/simulacion_FECHA; comprueba recovery sin duplicar y hashes.
No importar credenciales ni abrir tunel para simular; polling sigue activo.

## Secuencia preparada

1. Comparacion readonly de vigencias primero; el adaptador solo invoca
   cycle(password, False, None). No cambia fechas, validez o permisos. Cuatro
   fuentes r2 congeladas del ZIP publicado 2026.10.14-r2, verificadas por SHA256.
2. Espera de 60 s despues de terminar esa comparacion, leyendo RT cada 1 s.
3. Antes de cada lectura: capacidad SQLite y archivos originales. SDK x86 guarda
   buffer completo, payload y metadatos con fsync antes de responder al padre.
4. Padre guarda en SQLite con UUID de la captura. Al reiniciar recupera archivos
   completos que aun no se encolaron; mismo UUID no duplica. Conserva todos los
   originales incluso al formar lotes o recibir ACK futuro.
5. Al llegar el siguiente ciclo, primero Disconnect y salida confirmada del
   trabajador. Nunca hay dos clientes propios a la vez; no se abren mas despues
   de un cierre inseguro. La prioridad se aplica entre operaciones: una llamada
   SDK ya iniciada puede retrasar el ciclo/parada hasta terminar o agotar timeout.
6. Lotes cada 5 s, snapshots cada 30 s. El snapshot del polling se copia de su
   estado.json real, filtrando claves permitidas; RT no cambia last_ok_utc,
   errores ni PID de vigencias. Resultado readonly en cycle_probe, separado.

Falta de capacidad/error SQLite pausa nuevas lecturas RT y cierra su trabajador;
las comparaciones readonly siguientes siguen su turno. Retorno negativo, formato
desconocido, vacio o buffer sin NUL se conservan y suspenden RT hasta revisar y
reiniciar manualmente. Un archivo parcial/alterado impide continuar recovery.
No se borra evidencia ni se elimina sync.lock. Limites iniciales: outbox 256 MiB,
originales 128 MiB, reserva 64 MiB; no hay limpieza automatica. Sigue existiendo
ventana de perdida entre SDK y primer guardado durable. Sin garantia de historial
completo ni reconciliacion automatica, sin deduplicar por tarjeta/fecha/hash.

## Lectura real: paso posterior, NO ejecutar todavia

Se prepara tras revisar la simulacion Dell y provisionar un agente de ensayo
para serial real CO2K225060027. El UUID TEST-C3-001 del ensayo anterior se rechaza;
no reetiquetar datos reales como fixtures ni enviar este almacen a produccion.
La identidad del almacen es fija y no se cambia al reiniciar.

Requiere Python x64 instalado con pyodbc y DPAPI de Access del usuario Dell,
ZKAccess cerrado y Preparar mantenimiento confirmado. El lanzador
lanzar_lectura_coordinador.ps1 verifica manifiesto y usa la credencial protegida
existente sin copiarla a texto. Se comparan tambien los hashes de cuatro fuentes
instaladas con referencia r2. Padre mantiene el sync.lock instalado, exige tarea
deshabilitada/no Running, mantenimiento activo y sin revision pendiente.
No hay opcion aplicar ni modo continuo. Plazo inicial 150 s, maximo 180 s mas
operaciones en curso/cierre (el ciclo r2 conserva sus propios timeouts).

La captura se hace por trafico normal: no requiere presencia fisica ni presentar
tags. Datos en datos/lectura_mantenimiento; salud propia estado.json. No escribe
estado.json ni archivos de control de la instalacion. La observacion de 255 solo
indica respuesta de estado, no reloj certificado ni garantia permanente de cola.

## Parada del ensayo y limitacion del gestor

El gestor actual solo reconoce ZKSync\sincronizar_vigencias.py --continuo.
No puede detener este nombre/ruta nueva ni reconocerla para reanudar la tarea.
Por ello este paquete es un ensayo manual acotado, no una sustitucion permanente.
No pulsar Terminar y reanudar ni usar consultas/altas mientras este lector corre.
El lock impide solapamiento, pero un arranque anticipado del polling podria fallar
al tomarlo; no usar ese fallo como mecanismo de parada.

Para solicitar parada desde otra PowerShell de Dell:

```powershell
& 'C:\Users\Dell\Python32\python.exe' -B 'C:\SanIsidro\CoordinadorEnsayo_20261024\ensayo_coordinador.py' --detener
```

Peticion propia ligada a PID y run_id, ignorando peticiones antiguas. Espera fin
de operacion, cierre y mensaje Cierre coordinador. Entonces Terminar y reanudar
en el gestor y verificar dos ciclos correctos posteriores. Si informa CIERRE SDK
NO CONFIRMADO LIMPIAMENTE, conservar evidencia y revisar procesos antes de
reanudar; no continuar con mas clientes. No matar procesos ajenos.

## Limites y siguiente entrega

Emisor existente compatible con esta SQLite, ejecutable aparte sin SDK; la
integracion de entrega real requiere agente/credencial del serial real y ensayo
separado. La simulacion no usa el backend remoto. No se ha instalado coordinador
continuo ni se ha validado en hardware este bucle. Falta probar mantenimiento,
comparacion contra r2 en caseta, watchdog, parada y reapertura reales, retencion,
recuperacion historica y transicion/rollback autorizados. Cualquier futura
sustitucion debe mantener compatibilidad del gestor y vigilancia o actualizarlos
juntos en un paquete revisado, nunca iniciar un segundo servicio paralelo.
