#!/usr/bin/env bash
# Solo copia privada existente; no despliega docroot ni cambia su configuración.
set -euo pipefail
umask 077

RELEASE_SHA="${1:?Indicar commit completo revisado}"
[[ "$RELEASE_SHA" =~ ^[a-f0-9]{40}$ ]] || exit 1
TRIAL_DIR=$(cat /root/retencion-ensayo-3b7a6f7.path)
[[ "$TRIAL_DIR" =~ ^/root/ensayo-retencion-[a-f0-9]{8}$ ]] || exit 1
[[ "$(readlink -f "$TRIAL_DIR")" == "$TRIAL_DIR" ]] || exit 1
[[ "$(readlink -f "$TRIAL_DIR/backend")" == "$TRIAL_DIR/backend" ]] || exit 1
[[ "$(readlink -f "$TRIAL_DIR/backend/vendor")" == "$TRIAL_DIR/backend/vendor" ]] || exit 1
[[ "$(readlink -f "$TRIAL_DIR/backend/storage")" == "$TRIAL_DIR/backend/storage" ]] || exit 1
[[ -f "$TRIAL_DIR/backend/vendor/autoload.php" && -f "$TRIAL_DIR/cliente.cnf" ]] || exit 1
[[ ! -e "$TRIAL_DIR/backend/.env" && ! -e "$TRIAL_DIR/backend/bootstrap/cache/config.php" ]] || exit 1
if compgen -G "$TRIAL_DIR/backend/bootstrap/cache/routes*.php" >/dev/null; then
    printf 'La copia contiene rutas cacheadas; revisar antes de continuar.\n' >&2
    exit 1
fi

git -C /root/repo-sanisidro cat-file -e "$RELEASE_SHA^{commit}"
git -C /root/repo-sanisidro cat-file -e "$RELEASE_SHA:tools/pantalla_local/ensayar.php"
CODE_DIR=$(mktemp -d "$TRIAL_DIR/preparacion-pantalla-local-XXXXXXXX")
git -C /root/repo-sanisidro archive "$RELEASE_SHA" backend tools/retencion tools/pantalla_local | tar -x -C "$CODE_DIR"
rsync -a --delete --exclude='vendor/' --exclude='storage/' --exclude='bootstrap/cache/' --exclude='.env' \
    "$CODE_DIR/backend/" "$TRIAL_DIR/backend/"
mkdir -p "$TRIAL_DIR/tools/retencion" "$TRIAL_DIR/tools/pantalla_local"
rsync -a "$CODE_DIR/tools/retencion/" "$TRIAL_DIR/tools/retencion/"
rsync -a "$CODE_DIR/tools/pantalla_local/" "$TRIAL_DIR/tools/pantalla_local/"
cd "$TRIAL_DIR/backend"
COMPOSER_ALLOW_SUPERUSER=1 composer dump-autoload --no-dev --optimize --no-interaction --no-scripts
php "$TRIAL_DIR/tools/pantalla_local/ensayar.php" "$TRIAL_DIR" | tee "$TRIAL_DIR/resultado-pantalla-local.txt"
