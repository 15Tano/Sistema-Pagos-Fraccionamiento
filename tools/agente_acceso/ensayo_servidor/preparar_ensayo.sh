#!/usr/bin/env bash
set -euo pipefail
umask 077

ensayo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ensayo_esperado="/root/sanisidro-ensayos/acceso-20261023-1"
ensayo_produccion="/home/sanisidro-back/htdocs/api.sanisidro.info"
ensayo_php="$(command -v php)"
if [[ "$ensayo_dir" != "$ensayo_esperado" || "$EUID" -ne 0 ]]; then
    echo "Ejecutar como root solo desde $ensayo_esperado." >&2
    exit 1
fi
cd "$ensayo_dir"
sha256sum --check --quiet SHA256SUMS
echo 'FUENTES VERIFICADAS.'
if [[ -e datos || -e backend/.env || -e backend/vendor ]]; then
    echo 'Carpeta ya preparada o parcial. Conservarla y revisar; no se sobrescribe.' >&2
    exit 1
fi
if ! cmp -s backend/composer.lock "$ensayo_produccion/composer.lock"; then
    echo 'composer.lock distinto: preparar dependencias aparte antes de continuar.' >&2
    exit 1
fi
if [[ ! -f "$ensayo_produccion/vendor/autoload.php" ]]; then
    echo 'No se encontro vendor para copiar.' >&2
    exit 1
fi
ensayo_vendor_kb="$(du -sk "$ensayo_produccion/vendor" | awk '{print $1}')"
ensayo_libre_kb="$(df -Pk "$ensayo_dir" | awk 'NR==2 {print $4}')"
if (( ensayo_libre_kb < ensayo_vendor_kb + 1048576 )); then
    echo 'Espacio insuficiente para la copia y una reserva de 1 GiB; detener ensayo.' >&2
    exit 1
fi
# Copia de lectura del vendor existente; no se ejecuta Composer en produccion.
mkdir -p backend/vendor datos backend/bootstrap/cache backend/storage/logs \
    backend/storage/framework/cache/data backend/storage/framework/sessions backend/storage/framework/views
cp -a "$ensayo_produccion/vendor/." backend/vendor/
ensayo_key="$("$ensayo_php" -r 'echo "base64:".base64_encode(random_bytes(32));')"
cat > backend/.env <<EOF
APP_NAME=EnsayoAcceso
APP_ENV=testing
APP_KEY=$ensayo_key
APP_DEBUG=false
APP_URL=http://127.0.0.1:18880
LOG_CHANNEL=single
LOG_LEVEL=error
LOG_DEPRECATIONS_CHANNEL=null
DB_CONNECTION=sqlite
DB_DATABASE=$ensayo_dir/datos/ensayo.sqlite
DB_FOREIGN_KEYS=true
CACHE_STORE=array
SESSION_DRIVER=array
QUEUE_CONNECTION=sync
MAIL_MAILER=array
EOF
unset ensayo_key
touch datos/ensayo.sqlite
cd backend
# Entorno limpio: toda configuracion se toma del .env de esta copia.
env -i PATH=/usr/local/bin:/usr/bin:/bin "$ensayo_php" artisan package:discover --no-ansi
env -i PATH=/usr/local/bin:/usr/bin:/bin "$ensayo_php" artisan migrate \
    --database=sqlite --path=database/migrations/2026_10_23_210000_create_control_acceso_ingestion_tables.php --force --no-ansi
env -i PATH=/usr/local/bin:/usr/bin:/bin "$ensayo_php" artisan control-acceso:agente crear \
    --nombre='Ensayo remoto sin C3' --serial=TEST-C3-001 --no-ansi > "$ensayo_dir/datos/alta-agente.txt"
cd "$ensayo_dir"
"$ensayo_php" -r '
$root = getcwd();
$text = file_get_contents($root."/datos/alta-agente.txt");
if (!preg_match("/^agent_id: ([a-f0-9-]{36})$/m", $text, $id) ||
    !preg_match("/^token: (sica_[a-f0-9]{64})$/m", $text, $token)) { exit(1); }
$credential = ["agent_id"=>$id[1], "device_serial"=>"TEST-C3-001", "token"=>$token[1]];
file_put_contents($root."/datos/credencial-ensayo.json", json_encode($credential, JSON_THROW_ON_ERROR));
file_put_contents($root."/datos/listo.json", json_encode(["root"=>$root, "agent_id"=>$id[1], "device_serial"=>"TEST-C3-001"], JSON_THROW_ON_ERROR));
echo "ENSAYO PREPARADO\nagent_id: ".$id[1]."\nserial: TEST-C3-001\n";
'
echo 'Base SQLite exclusiva; credencial en datos/credencial-ensayo.json con acceso solo root.'
echo 'Siguiente: bash iniciar_ensayo.sh (primer plano, solo 127.0.0.1:18880).'
