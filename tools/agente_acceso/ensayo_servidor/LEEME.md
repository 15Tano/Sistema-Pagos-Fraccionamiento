# Backend de ensayo privado — 2026.10.23-1

Snapshot de fuentes Laravel del commit indicado en FUENTE.json. Sin .env, vendor,
datos, frontend compilado ni scripts operativos de producción en el paquete.

## Preparación en SSH

Usar exclusivamente la carpeta nueva `/root/sanisidro-ensayos/acceso-20261023-1`.
Verificar SHA256SUMS y ejecutar `bash preparar_ensayo.sh` desde ella.
El script valida ruta/root, rechaza una instalación previa o parcial y exige que
composer.lock coincida con producción para copiar su vendor **a la copia**.
Exige espacio para esa copia y una reserva de 1 GiB antes de continuar.
Escribe .env propio, APP_KEY aleatoria y una SQLite vacía. Solo aplica la migración
de acceso; crea agente TEST-C3-001 y secreto aleatorio, guardado solo para root.
La salida de preparación no muestra el secreto. No compartir alta-agente.txt ni
credencial-ensayo.json por chat. La transferencia posterior será mediante SSH a DPAPI.

No ejecuta deploy, git pull/push, Composer en producción, rsync, migraciones sobre
la base real ni recargas de PHP-FPM/Nginx. Si falla, conservar salida y carpeta;
no borrar ni reutilizarla sin revisar el fallo.

## Servicio temporal

`bash iniciar_ensayo.sh` arranca PHP en primer plano y solo en 127.0.0.1:18880.
Ctrl+C lo detiene; no se instala tarea ni servicio. No abrir firewall ni configurar
un dominio. Las únicas rutas accesibles son GET /salud y los dos POST de ingesta;
cualquier archivo, otro método o ruta devuelve 404.

Desde otra terminal SSH:

```bash
curl --fail --silent --show-error http://127.0.0.1:18880/salud
```

Respuesta esperada: `status=ensayo_listo`, serial TEST-C3-001. Eso confirma el
arranque del router, no una entrega autenticada ni la salud de la caseta.

## Conexión desde Dell (posterior)

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18881:127.0.0.1:18880 root@api.sanisidro.info
```

Conservar esa terminal abierta durante el ensayo. El emisor usará HTTP local
127.0.0.1:18881 con --ensayo-local, dentro del túnel SSH cifrado. No se desactiva
TLS ni se usa HTTP público. Acceso SSH exacto confirmado por el usuario.
La clave del host se comprueba mediante OpenSSH; no deshabilitar esa comprobación.

El servidor conserva exclusivamente datos ficticios; el polling instalado continúa
apuntando a la API real. Entrega remota, reintento y conteos aún requieren ejecución
y evidencia del usuario. Esta preparación no equivale a despliegue de producción.
