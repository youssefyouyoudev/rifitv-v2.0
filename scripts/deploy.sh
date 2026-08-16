#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/rifitv-v2.0}"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
PHP_FPM_SERVICE="${PHP_FPM_SERVICE:-php8.3-fpm}"
NEXT_SERVICE="${NEXT_SERVICE:-rifitv-next}"
QUEUE_SERVICE="${QUEUE_SERVICE:-rifitv-queue}"
SCHEDULER_SERVICE="${SCHEDULER_SERVICE:-rifitv-scheduler}"
HEALTH_URL="${HEALTH_URL:-https://api.rifitv.com/api/health}"

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
npm run build

sudo systemctl reload "$PHP_FPM_SERVICE"
sudo systemctl restart "$NEXT_SERVICE"
sudo systemctl restart "$QUEUE_SERVICE"
sudo systemctl restart "$SCHEDULER_SERVICE"

curl --fail --silent --show-error "$HEALTH_URL" >/dev/null
echo "RiFiTV deployment completed successfully."
