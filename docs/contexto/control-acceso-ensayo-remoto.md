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
del paquete revisado. No se ejecutó deploy ni se inició aún el servidor temporal.

## Siguiente evidencia requerida

Arrancar mediante bash iniciar_ensayo.sh en primer plano y verificar GET /salud
desde otra conexión SSH. Después configurar emisor de ensayo en Dell, guardar credencial en DPAPI mediante
SSH y enviar únicamente fixtures. Confirmar ACK real, reintento y conteos antes
de integrar SDK o ejecutar el deploy habitual. El polling real sigue operativo.
