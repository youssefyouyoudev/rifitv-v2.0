# Production Reset

Use `rifitv:reset-season-data` when replacing old demo football data with the 2026/27 production dataset.

## Commands

Preview:

```bash
php artisan rifitv:reset-season-data 2026-27 --dry-run
```

Production reset:

```bash
php artisan rifitv:reset-season-data 2026-27 --force
php artisan db:seed --class=ProductionSeason2026Seeder
php artisan rifitv:fixtures:verify 2026-27
```

## Safety

In `production`, the reset refuses to run without `--force`. Each run writes a backup manifest with row counts under `storage/app/backups`.

Preserved tables include `users`, `roles`, `role_user`, `sessions`, `personal_access_tokens`, `password_reset_tokens`, `cache`, `jobs`, and `failed_jobs`.

Deleted tables include football fixtures, competitions, teams, broadcasters, channels, streams, live-ops telemetry, homepage sections, and old announcements.
