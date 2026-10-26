# Servicio integrado candidato de acceso

2026-10-26. El usuario autoriza preparar y probar la union operativa local.
Estimacion inicial comunicada60–90min; prueba Dell e instalacion separadas.
Este documento registra implementacion y pruebas locales, no despliegue ni
aceptacion de nuevas escrituras reales.

## Implementacion

Fuentes nuevas en tools/agente_acceso; las publicaciones previas permanecen
intactas. servicio_integrado.Service controla ciclos de vigencias prioritarios,
RT entre ciclos y un emisor HTTP en proceso propio. SDKGate y recibos anteriores
siguen siendo obligatorios. RT debe cerrar antes de abrir inventario/aplicacion;
cierre incierto termina nuevos turnos y conserva evidencia. Parada cooperativa
termina la operacion actual y recoge RT/emisor antes de publicar stopped.

El nucleo admite ejecucion continua y protocol2, con last_ok exclusivamente
tras ciclo de aplicacion verificado. Una comparacion readonly no publica estado
oficial nuevo; encola el snapshot r2 observado sin reescribirlo. HTTP, eventos y
ACK nunca conceden vigencias. Errores de captura/disco pausan RT; si el SDK cerro
con certeza pueden continuar los ciclos de vigencias. Fallo parcial de fechas
conserva requires_review y detiene el servicio; no hay reintento/rollback ciego.

ciclo_operativo.Cycle valida la misma fuente API/r2, lee las cinco columnas
Access, valida inventario C3 cerrado y prepara planes solo de existentes.
Duplicado Access, inventario vacio/incierto o API invalida bloquean aplicacion.
Ausentes API permanecen intactos; fechas vencidas se aplican como vencidas.
El modo de ciclo debe coincidir con el del planificador antes de crear procesos.

La ruta de aplicacion de biblioteca reutiliza aplicador_integrado.execute,
AccessDates, el transporte concreto y Approval por plan exacto. Los alcances se
exigen al llamador y no se emiten automaticamente para datos reales. No hay CLI
--aplicar/--continuo en la entrada Dell de este paquete.

respaldo_ciclo prepara UNA copia MDB por ciclo con cambios, valida los estados
Access de todos los planes contra esa copia y guarda un indice inmutable fuera
del directorio MDB. Se preserva el contrato de admision anterior de copias.
Cada tag tiene su propio perfil DPAPI y bundle ligado al indice/recibo/hash MDB.
Todos los respaldos/perfiles preceden la emision de Approval; no se renueva TTL.
CycleBundle se reconstruye en el hijo antes de permitir la escritura protegida.
Solo cuatro campos C3 y tres columnas de fechas/validez Access, conservando
campos privados, permisos y otras tablas. No copiar una MDB completa por tag.

emisor_servicio.ProcessSender usa Popen propio, entorno sin SANISIDRO_ y EOF de
stdin para parar al perder el padre. Solo carga su token DPAPI de ingesta.
Reutiliza Sender.once/leases/ACK/backoff/cuerpos; no importa SDK ni Access.
Salida del proceso sin recibo correcto no acredita cierre. En Windows se
reintenta exclusivamente reemplazar/leer snapshots ante sharing temporal,
nunca HTTP ni SDK. Interrupcion persistente conserva el estado anterior.

## Entrada Dell y limites

servicio_integrado_dell solo permite preflight, ensayo readonly5..150s,
parada PID+UUID y verificacion final. Carpeta separada:
C:\SanIsidro\ServicioIntegrado_20261026. Usa el gestor/lock instalados, r2 con
hashes conocidos, la misma outbox/identidad anterior y el backend aislado por
127.0.0.1:18881. Consulta API productiva para comparar; no cambia fechas reales,
DLL, tareas, reloj, credenciales instaladas, endpoints o UI.

lanzar_servicio_integrado.ps1 descifra DPAPI del usuario Dell, limpia entorno,
lanza padre64 y verifica cierre en otro proceso tras salir. El resultado vincula
PID/UUID, recibos SDK, emisor y hash; guarda cierre_final.json. Solo despues de
cierre_servicio_confirmado se reanuda por gestor y comprueban dos ciclos r2.
Si falta cierre o queda fault, conserva mantenimiento/evidencia. Nada se instala
por verificar/simular ni se reanuda automaticamente desde este candidato.

Siguen pendientes aceptacion de aplicacion real, autorizacion operativa continua,
entrada canonica instalada, instalador/rollback, enlace gestor/vigilancia y
parada real frente a360s; transporte definitivo sin SSH y retencion/alertas.
No borrar originales ni ampliar topes existentes:32copias/2GiB,
1024perfiles/256MiB y limites SQLite/originales previos. El nucleo continuo no
equivale a un servicio permanente aceptado. Pantalla/altas siguen posteriores.

## Verificacion local completada

48 pruebas nuevas: planificador con reloj virtual, SQLite real temporal,
prioridad/cierre, fallos API/HTTP/disco, revision parcial, originales recuperables,
identidad de parada, snapshots Windows, hijos Python reales, perfil/grant DPAPI,
aplicacion cerrada con SDK ficticio y un ciclo con ACE/MDB/DPAPI nativos de prueba.
Incluye el cableado real de la entrada readonly, con SDK/API sustituidos, RT
original durable, emisor hijo real y verificacion final. No caseta ni produccion.

Suite492 aprobadas en125.346s, cero fallas/errores/omitidas. La primera ejecucion
en sandbox bloqueo siete comprobaciones previas de loopback Laravel con
WinError10013; repeticion autorizada fuera del sandbox aprobo toda la suite.
No se modificaron esas pruebas ni se omitieron. Sintaxis Python/PowerShell
comprobada. Pruebas nuevas standalone tambien aprobadas.

Servicio_Integrado_2026.10.26-2.zip:117archivos/302035bytes/SHA256
2e8a4aed431ec6f96223c1ff4c1f6845bc0765bf66334d81b09d8d0d0e289507.
Manifiesto116fuentes mas manifiesto; los95archivos del transporte anterior
conservados byte por byte. El primer borrador local no tenia tres dependencias
en raiz; detectado al extraer, corregido en version2 antes de entregar a Dell.
No sobrescribir publicacion. Paquete2 extraido en datos/s2 y verificado en
PowerShell; simulacion completa simulation_ok,48tests/failures0/errors0/skipped0,
parent64/child64, ended_utc=2026-10-26T06:11:27.806680Z. Evidencia local:
tools/agente_acceso/datos/s2/registros/servicio_simulado_20261026_001127_806680.json.

Siguiente: usuario descarga SOLO paquete2 y ejecuta verificar_servicio.ps1 y
simular_servicio.py con Python64 y --python32 instalado. No mantenimiento para
esa simulacion. Arquitectura nueva padre64/hijo32 y ensayo readonly conjunto
todavia pendientes de evidencia Dell. Ninguna nueva consulta real solicitada
ni efectuada por las pruebas locales.

Ultima evidencia real sigue siendo perfil/cierre aceptados y r2 PID14608 con
dos ciclos correctos23:27/23:28 Mexico25oct, documentados en aplicador candidato.
No afirmar salud actual, instalacion o escritura nueva por estos resultados.
