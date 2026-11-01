#!/usr/bin/env bash
# Ensayo exclusivo: no modifica docroot, tareas, configuración ni base productiva.
set -euo pipefail
umask 077

RELEASE_SHA="${1:?Indicar commit exacto revisado}"
[[ "$RELEASE_SHA" =~ ^[a-f0-9]{7,40}$ ]] || exit 1
TRIAL_DIR=$(cat /root/retencion-ensayo-3b7a6f7.path)
[[ "$TRIAL_DIR" =~ ^/root/ensayo-retencion-[a-f0-9]{8}$ ]] || exit 1
[[ -d "$TRIAL_DIR/backend/vendor" && -f "$TRIAL_DIR/cliente.cnf" ]] || exit 1
[[ ! -e "$TRIAL_DIR/backend/.env" && ! -e "$TRIAL_DIR/backend/bootstrap/cache/config.php" ]] || exit 1

git -C /root/repo-sanisidro fetch origin
git -C /root/repo-sanisidro cat-file -e "$RELEASE_SHA^{commit}"
CODE_DIR=$(mktemp -d "$TRIAL_DIR/preparacion-resumenes-XXXXXXXX")
git -C /root/repo-sanisidro archive "$RELEASE_SHA" backend tools/retencion | tar -x -C "$CODE_DIR"
rsync -a --delete --exclude='vendor/' --exclude='storage/' --exclude='bootstrap/cache/' --exclude='.env' \
    "$CODE_DIR/backend/" "$TRIAL_DIR/backend/"
rsync -a "$CODE_DIR/tools/retencion/" "$TRIAL_DIR/tools/retencion/"
cd "$TRIAL_DIR/backend"
COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts
php "$TRIAL_DIR/tools/retencion/ensayar_resumenes.php" "$TRIAL_DIR" | tee "$TRIAL_DIR/resultado-resumenes.txt"
