# Production Deployment

Target stack: Cloudflare, Nginx, Next.js, Laravel, PHP-FPM, MySQL, Redis, queue workers, and Laravel scheduler.

## Server Packages

Ubuntu baseline:

```bash
sudo apt update
sudo apt install -y nginx mysql-server redis-server git unzip curl certbot python3-certbot-nginx
sudo apt install -y php8.3-fpm php8.3-cli php8.3-mysql php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-bcmath php8.3-gd
sudo apt install -y ffmpeg
```

Install Composer and Node.js 22 from trusted upstream sources. Do not run production as `root`.

## Repository

```bash
sudo mkdir -p /var/www/rifitv-v2.0
sudo chown -R www-data:www-data /var/www/rifitv-v2.0
sudo -u www-data git clone <repo-url> /var/www/rifitv-v2.0
```

## Environment

Create `backend/.env` from `backend/.env.example` and `frontend/.env.local` from `frontend/.env.example`.

Production essentials:

```text
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.rifitv.com
FRONTEND_URL=https://rifitv.com
QUEUE_CONNECTION=redis
CACHE_STORE=redis
CORS_ALLOWED_ORIGINS=https://rifitv.com,https://www.rifitv.com
RIFITV_MEDIA_GATEWAY_ENABLED=true
RIFITV_MEDIA_GATEWAY_INTERNAL_SECRET=<long-random-secret>
STABLE_RELAY_ENABLED=true
STABLE_RELAY_DEFAULT_FOR_MPEGTS=true
STABLE_RELAY_STORAGE_PATH=/var/lib/rifitv/live
STABLE_RELAY_PUBLIC_BASE_PATH=/media/hls
STABLE_RELAY_PUBLIC_BASE_URL=https://api.rifitv.com/media/hls
RIFITV_SEED_DEMO_DATA=false
NEXT_PUBLIC_RIFITV_API_BASE=https://api.rifitv.com/api/v1
NEXT_PUBLIC_RIFITV_SITE_URL=https://rifitv.com
```

Never commit production secrets.

## First Deploy

```bash
cd /var/www/rifitv-v2.0/backend
composer install --no-dev --prefer-dist --optimize-autoloader
php artisan key:generate
php artisan migrate --force
php artisan storage:link
php artisan rifitv:create-owner
php artisan optimize

cd ../frontend
npm ci
npm run build

cd ../stream-gateway
npm ci
npm run build
```

Install examples from `infra/systemd/` into `/etc/systemd/system/`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rifitv-next rifitv-queue rifitv-scheduler
```

Run the dedicated stream gateway as its own Node service behind Nginx. Configure it with:

```text
PORT=8010
LARAVEL_BASE_URL=https://api.rifitv.com
GATEWAY_INTERNAL_SECRET=<same-long-random-secret>
```

Proxy `/media/live/` to the stream gateway in production. Keep `/api/media/tokens/` private to the gateway secret path and do not cache gateway authorization responses.

Create the HLS relay directory before enabling relay playback:

```bash
sudo mkdir -p /var/lib/rifitv/live
sudo chown -R www-data:www-data /var/lib/rifitv/live
```

Install `infra/nginx/rifitv.conf`, adjust domains/cert paths/PHP socket, then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Repeatable Deploy

Use `scripts/deploy.sh`. It pulls with `--ff-only`, installs dependencies, runs non-destructive migrations, builds Next.js before restart, restarts workers/services, and checks `/api/health`.

## Cloudflare

Use Cloudflare for DNS, TLS, DDoS protection, bot/rate controls, and static asset caching. Do not cache admin responses, `/api/*` authenticated responses, or playback authorization responses.

## Firewall

Public: `80`, `443`. Restrict SSH to trusted addresses. Do not expose MySQL or Redis publicly.

## Rollback

Rollback application code with a known-good git tag/commit, rebuild frontend, run `php artisan optimize`, and restart services. Do not blindly reverse migrations that may drop or transform production data.
