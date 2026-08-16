# Development

## Requirements

- PHP 8.2+
- Composer
- Node.js 20+
- MySQL 8 for local app development
- Redis optional for Phase 1, configured for later cache/queue use

## Backend

```bash
cd backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed
php artisan serve --host=127.0.0.1 --port=8000
```

The test suite uses in-memory SQLite through `phpunit.xml`.

## Frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_RIFITV_API_BASE` if Laravel is not on `http://127.0.0.1:8000/api/v1`.

## Player Lab

In development, open:

```text
http://127.0.0.1:3000/dev/player
```

The lab includes a broken HLS source, a valid HLS backup, and an MPEG-TS placeholder to test fallback and unsupported-source handling.

## Checks

```bash
cd backend
php artisan test
./vendor/bin/pint --test

cd ../frontend
npm run lint
npm run test
npm run build
npm run e2e
```
