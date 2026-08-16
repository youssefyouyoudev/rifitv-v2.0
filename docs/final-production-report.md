# Final Production Report

Date: 2026-08-14

## Dataset

The production dataset is imported from `backend/database/data/2026-27`.

- Premier League: 198 fixtures
- LALIGA EA SPORTS: 108 fixtures
- Ligue 1 PSG scope: 34 fixtures
- Total imported fixtures: 340
- UEFA Champions League: competition seeded, 0 fixtures

All imported fixtures are scheduled, scoreless, deduplicated, and limited to the requested RiFiTV club scope. Non-confirmed kickoff precision does not create fake kickoff times.

## Broadcasts

- Premier League and LALIGA: `beIN SPORTS MENA`, `network_confirmed`, `channel_id = null`
- PSG Ligue 1: `beIN SPORTS MENA`, `tbc`, `channel_id = null`
- No production import seeds playable stream URLs.

## Logos

`frontend/public/football/logo-manifest.json` contains 62 local assets:

- 58 club crests
- 4 competition logos
- 0 missing seeded-team logos

Verifier checks confirmed all seeded teams and competitions use local `/football/...` paths with existing PNG files.

## Reset

`php artisan rifitv:reset-season-data 2026-27 --force` was run locally, followed by `php artisan db:seed --class=ProductionSeason2026Seeder` and `php artisan rifitv:fixtures:verify 2026-27`.

Auth tables were preserved by the reset command. A backup manifest was written under `storage/app/backups`.

## Verification

Passed:

- `python backend/database/data/build_production_2026_27.py`
- `vendor/bin/pint --test`
- `php artisan test`
- `php artisan db:seed --class=ProductionSeason2026Seeder`
- `php artisan rifitv:reset-season-data 2026-27 --dry-run --force`
- `php artisan rifitv:reset-season-data 2026-27 --force`
- `php artisan rifitv:fixtures:verify 2026-27`
- `php artisan route:list`
- `php artisan rifitv:health`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`

Note: `git status` could not run because the project directory is not currently a Git worktree.
