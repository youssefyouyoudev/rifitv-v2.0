#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/rifitv-v2.0}"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
PHP_FPM_SERVICE="${PHP_FPM_SERVICE:-php8.3-fpm}"
PM2_APP_NAME="${PM2_APP_NAME:-rifitv-frontend}"
QUEUE_SERVICE="${QUEUE_SERVICE:-rifitv-queue}"
SCHEDULER_SERVICE="${SCHEDULER_SERVICE:-rifitv-scheduler}"
HEALTH_URL="${HEALTH_URL:-https://api.rifitv.com/api/health}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-https://rifitv.com}"
NEXT_STAGING_DIR="${NEXT_STAGING_DIR:-.next-deploy}"
NEXT_BACKUP_DIR="${NEXT_BACKUP_DIR:-.next-previous}"

for dir in "$NEXT_STAGING_DIR" "$NEXT_BACKUP_DIR"; do
    if [[ "$dir" == ".next" || "$dir" == /* || "$dir" == *..* ]]; then
        echo "Refusing unsafe Next.js deployment directory: $dir" >&2
        exit 1
    fi
done

if [[ "$NEXT_STAGING_DIR" == "$NEXT_BACKUP_DIR" ]]; then
    echo "NEXT_STAGING_DIR and NEXT_BACKUP_DIR must be different." >&2
    exit 1
fi

rollback_frontend() {
    if [[ -d "$FRONTEND_DIR/$NEXT_BACKUP_DIR" ]]; then
        pm2 stop "$PM2_APP_NAME" >/dev/null 2>&1 || true
        rm -rf "$FRONTEND_DIR/.next"
        mv "$FRONTEND_DIR/$NEXT_BACKUP_DIR" "$FRONTEND_DIR/.next"
        pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
        pm2 start "$APP_DIR/ecosystem.config.cjs" --only "$PM2_APP_NAME" --update-env >/dev/null || true
    fi
}

cd "$APP_DIR"
git fetch --prune
git pull --ff-only

cd "$BACKEND_DIR"
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan optimize:clear
php artisan optimize
php artisan queue:restart

cd "$FRONTEND_DIR"
npm ci
npm run lint
npm run test
rm -rf "$NEXT_STAGING_DIR"
NEXT_DIST_DIR="$NEXT_STAGING_DIR" npm run build

sudo systemctl reload "$PHP_FPM_SERVICE"
pm2 stop "$PM2_APP_NAME" >/dev/null 2>&1 || true
rm -rf "$NEXT_BACKUP_DIR"
if [[ -d .next ]]; then
    mv .next "$NEXT_BACKUP_DIR"
fi
mv "$NEXT_STAGING_DIR" .next
trap rollback_frontend ERR
pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
pm2 start "$APP_DIR/ecosystem.config.cjs" --only "$PM2_APP_NAME" --update-env
SMOKE_BASE_URL="$FRONTEND_HEALTH_URL" npm run smoke:assets
pm2 save
rm -rf "$NEXT_BACKUP_DIR"
trap - ERR
sudo systemctl restart "$QUEUE_SERVICE"
sudo systemctl restart "$SCHEDULER_SERVICE"

curl --fail --silent --show-error "$HEALTH_URL" >/dev/null
echo "RiFiTV deployment completed successfully."
