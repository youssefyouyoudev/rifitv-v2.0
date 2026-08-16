# RiFiTV v2

RiFiTV v2 is an event-first live football platform with resilient playback, football admin workflows, and operations automation.

## Structure

```text
backend/   Laravel 12 REST API, MySQL-ready, Redis-ready, Sanctum auth
frontend/  Next.js App Router, TypeScript, Tailwind CSS, isolated playback engine
docs/      Architecture, playback, admin, automation, and phase reports
```

## Local Setup

Backend:

```bash
cd backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan serve --host=127.0.0.1 --port=8000
```

Frontend:

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000`.

Admin seed login:

```text
email: admin@rifitv.local
password: password
```

## Quality Gate

```bash
cd backend
php artisan test
./vendor/bin/pint --test

cd ../frontend
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run e2e
```

The E2E suite expects Laravel to be running at `http://127.0.0.1:8000`.

Admin and operations documentation:

- `docs/admin.md`
- `docs/football-management.md`
- `docs/automation.md`
- `docs/football-provider.md`
- `docs/stream-health.md`
- `docs/operations.md`
- `docs/deployment.md`
- `docs/security-review.md`
- `docs/disaster-recovery.md`
- `docs/api.md`
- `docs/future-platform.md`
- `docs/roles-permissions.md`
- `docs/phase-2-report.md`
- `docs/phase-3-report.md`
- `docs/phase-4-report.md`

## Stream Safety

No production stream URLs are committed. Development sources are placeholders controlled by environment variables:

```text
RIFITV_DEV_HLS_URL
RIFITV_DEV_BROKEN_HLS_URL
RIFITV_DEV_MPEGTS_URL
```

Only use sources the operator is authorized to distribute.
"# rifitv-v2.0" 
