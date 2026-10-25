# Control de acceso: preparación del ensayo remoto

2026-10-23. Usuario confirma SSH mediante `ssh root@api.sanisidro.info` y comparte
el script `/root/deploy-sanisidro.sh`. El script hace fetch/pull, respaldo de código,
comparación de migraciones, rsync --delete al docroot, Composer, limpieza de caché,
migraciones opcionales, permisos, recarga de PHP-FPM y curl a la raíz pública.
Tiene confirmaciones intermedias, pero su destino es producción; no es un comando
de ensayo. La verificación de la raíz no certifica los endpoints de ingesta.

Estado informado: `/root/repo-sanisidro` limpio en refactor-headless siguiendo
origin/refactor-headless; no se recibió hash remoto ni se hizo fetch/pull/despliegue.
PHP CLI 8.4.20, PDO mysql y sqlite. No certifica PHP-FPM ni versión de MySQL.

## Paquete y preparación aislada

Fuentes de `backend/app`, config, rutas y entradas necesarias se toman del commit
9beb4f04c3952d6fecb662edfb7b0f2c3049c839. Solo se incluye la migración nueva de acceso;
se excluyen .env, vendor, datos, scripts operativos y frontend compilado.
Builder: `tools/agente_acceso/empaquetar_ensayo_servidor.py`.
Scripts revisables en `tools/agente_acceso/ensayo_servidor/`.
Artefacto: `tools/agente_acceso/Ensayo_Acceso_Servidor_2026.10.23-1.tar.gz`,
73 archivos, SHA256
`70bdc08f49c6686e06037465456966898f0ffe1c30c9395939c01c2c0f4fd5be`.

Destino exclusivo: `/root/sanisidro-ensayos/acceso-20261023-1`.
El preparador valida ruta física y usuario root, manifiesto y carpeta nueva;
exige composer.lock igual al de producción para copiar vendor a la copia y
reserva de 1 GiB además del espacio de esa copia. No invoca Composer en producción.
Genera .env propio con clave aleatoria, SQLite en datos/ensayo.sqlite, solo la
migración de acceso y agente TEST-C3-001 con secreto aleatorio. Procesos PHP con
entorno limpio, sin heredar configuración de producción. Credencial solo en archivos
root, sin mostrarla en salida compartible.

Servidor PHP temporal en primer plano, exclusivamente 127.0.0.1:18880. Router
restringido a GET /salud y los dos POST de ingesta, sin servir otros archivos/rutas.
Se detiene con Ctrl+C. Sin servicios, tareas, firewall, Nginx ni PHP-FPM modificados.
Túnel previsto desde Dell: `ssh -N -o ExitOnForwardFailure=yes -L
127.0.0.1:18881:127.0.0.1:18880 root@api.sanisidro.info` (en una sola línea).
Emisor apuntará al HTTP loopback 18881 con opción explícita de ensayo; tráfico
entre computadoras cifrado por SSH, no HTTP público.

Validaciones locales: sintaxis Bash y PHP correctas; manifiesto completo y contenido
del paquete por SHA256. Preparación en Linux remoto posteriormente confirmada por
salida del usuario (ver evidencia siguiente); arranque y envío desde Dell pendientes.
No se hizo push; las fuentes nuevas no están en origin. El paquete permite probar
la copia confirmada localmente antes del push/despliegue final autorizado.
No usar credenciales de producción ni enviar secretos por chat.

## Preparación remota confirmada — 2026-10-24

Usuario confirma archivo de 82 KiB en /root, SHA256 del paquete OK y FUENTES
VERIFICADAS. package:discover termina correctamente; se crea tabla de migraciones
y solo se aplica 2026_10_23_210000_create_control_acceso_ingestion_tables.
Salida ENSAYO PREPARADO, serial TEST-C3-001,
agent_id=6b293548-0312-4d06-9c1d-3a7e79c9c5a0 (identificador, no secreto).
SQLite exclusiva en la carpeta de ensayo; el preparador informa credencial en
datos/credencial-ensayo.json, acceso solo root. No se recibió ni registró su secreto.
La salida concuerda con las guardas, copia de dependencias y configuración separada
del paquete revisado. No se ejecutó deploy. El arranque posterior se documenta abajo.

## Siguiente evidencia requerida

Configurar emisor de ensayo en Dell, guardar credencial en DPAPI mediante
SSH y enviar únicamente fixtures. Confirmar ACK real, reintento y conteos antes
de integrar SDK o ejecutar el deploy habitual. Este ensayo no modifica el polling.

## Arranque y salud comprobados — 2026-10-24

Usuario comparte inicio mediante bash iniciar_ensayo.sh, PHP 8.4.20 en
127.0.0.1:18880. Desde PowerShell en Dell ejecuta SSH con curl --fail a /salud;
obtiene {"status":"ensayo_listo","device_serial":"TEST-C3-001"}.
Log del servidor: inicio 2026-10-24 20:19:51, conexión 20:20:04 (zona de ese log
no comprobada). Después pulsa Ctrl+C y vuelve al prompt: proceso detenido.
La prueba confirma acceso SSH y salud del servicio de ensayo durante esa ventana;
no certifica túnel local 18881, autenticación del agente ni entrega de lotes.
Reiniciar PHP y mantener esa terminal abierta para probar el envío.

Cliente manual preparado en tools/agente_acceso/ensayo_dell.py: exige UUID de este
ensayo y serial TEST-C3-001, importa JSON de SSH directamente a DPAPI de Dell,
sin archivo de secreto en texto claro ni impresión del token. Solo destino
127.0.0.1:18881/api/control-acceso/agente. Outbox exclusiva en
datos/ensayo_remoto. Prepara tres originales ficticios (evento, estado 255, error
binario -2) y un estado ficticio, dos mensajes en total. UUID/horas fijos permiten
repetir preparar secuencialmente sin duplicar; no ejecutar preparadores paralelos.
Enviar conserva reintentos, originales, hashes y ACK del emisor existente.
No carga DLL, no lee el estado real del polling, no instala tareas y no requiere
pausa del gestor. Instrucciones en LEEME_ENSAYO_DELL.md dentro del paquete cliente.
Importación/entrega real desde Dell siguen pendientes de evidencia del usuario.

Paquete cliente: tools/agente_acceso/Ensayo_Emisor_Dell_2026.10.24-1.zip,
8 archivos, SHA256 f7a4c4525a3204a4dce24f4d2d5e6da12df40aba04a45b4d034a728666625c12.
Manifiesto, fuentes dentro del ZIP y verificador Windows PowerShell correctos.
Suite local completa: 26 pruebas aprobadas (23 anteriores y 3 del cliente),
11.517 s, Python 3.12.5. Nuevas: identidad/campos/entrada limitada; importación
a DPAPI real sin eco ni JSON claro; fixtures repetibles y ACK Laravel real,
conservación byte a byte en servidor y sin duplicación por repetir preparar/enviar.
ACK esperado del lote: 3 respuestas, 2 filas, 1 evento, 1 estado y 1 respuesta
sin interpretar (el error SDK ficticio conservado como sdk_error).
La primera corrida fue bloqueada por WinError 10013 del sandbox; se repitió con
acceso HTTP local permitido. Otra repetición agotó el inicio PHP en una prueba
anterior; la última corrida completa pasó. No se cambió el backend ni sus límites.

## Cliente Dell configurado — 2026-10-24

Usuario comparte PAQUETE VERIFICADO del cliente 2026.10.24-1 y ejecución de la
tubería SSH a ensayo_dell.py configurar. Resultado CONFIGURADO: credencial DPAPI
del usuario actual e identidad de ensayo verificadas. No compartió el secreto.
Esto confirma importación/cifrado local según el cliente revisado; no certifica
túnel, envío, ACK ni estado actual del proceso PHP. Esos pasos siguen pendientes.
Usuario está ahora físicamente en caseta con tag 12230693 para una captura SDK
controlada, que se realizará aparte sin enviar sus datos al backend de ensayo.

## Pendientes conservados sin conexion — 2026-10-24

Usuario comparte preparar y enviar en Dell, con destino de tunel aun sin abrir.
Preparacion: dos mensajes pendientes, tres originales, unbatched=0, paused vacio.
oldest_pending_utc=2026-10-25T01:23:30.251481+00:00 (24 octubre 19:23:30 Mexico).
Envio: delivery=[retry], lote attempts pasa de 0 a 1, error=network, ack=null;
estado conserva attempts=0. Ambos siguen pendientes, sin pausa global.

Identidades para comparar en el siguiente reintento:
- Lote f640e2c4-63a9-4fae-90e8-440c2b39ea54, sequence=0, SHA256
  92ab401adab4b8b42afa52502755b3e4383ff6b455635d0c4189e94da02f0239.
- Estado 8d3b4772-b0d9-499e-843f-1de1a9e2475c, sequence=0, SHA256
  549760fa90d2ac344488fdea6d1de61d09b12e4c564428d4b75eeb0c8fc414f7.

Los tres response_id fijos terminados 0001/0002/0003 mantienen 41/35/16 bytes y
los mismos hashes antes/despues del fallo. No se borro ni renumero evidencia.
Confirma en Dell persistencia de originales/mensajes y reintento ante fallo de
conexion; no certifica caida general de Internet, autenticacion ni recepcion remota.
No se consulto SDK ni se requirio mantenimiento. Pendiente reiniciar PHP de
ensayo si sigue detenido, abrir tunel 18881 y reenviar estos mismos pendientes;
comprobar ACK, hashes/identidades conservados y segundo enviar sin nuevos mensajes.
