#!/usr/bin/env bash
set -euo pipefail
umask 077
ensayo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if [[ "$ensayo_dir" != /root/sanisidro-ensayos/acceso-20261023-1 || ! -f "$ensayo_dir/datos/listo.json" ]]; then
    echo 'Instancia de ensayo no preparada en la ruta autorizada.' >&2
    exit 1
fi
ensayo_php="$(command -v php)"
cd "$ensayo_dir"
echo 'Ensayo privado: 127.0.0.1:18880. Ctrl+C termina este proceso.'
exec env -i PATH=/usr/local/bin:/usr/bin:/bin "$ensayo_php" -S 127.0.0.1:18880 \
    -t "$ensayo_dir/backend/public" "$ensayo_dir/router_ensayo.php"
