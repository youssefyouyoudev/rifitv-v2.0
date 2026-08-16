# Automation

RiFiTV Phase 3 adds queue-backed football automation and operational maintenance. Jobs are safe to run repeatedly and use cache locks to prevent overlapping provider or stream checks.

## Commands

Run these from `backend/`:

```bash
php artisan rifitv:health
php artisan rifitv:sync-fixtures
php artisan rifitv:sync-results
php artisan rifitv:check-streams
php artisan rifitv:check-streams {sourceId}
```

The command wrappers dispatch jobs. In local development with `QUEUE_CONNECTION=sync`, they run immediately. In production, run a queue worker and the Laravel scheduler:

```bash
php artisan queue:work --queue=default
php artisan schedule:work
```

## Schedule

- Scheduler heartbeat: every minute, stored as `rifitv:scheduler:last_seen_at`.
- Fixture sync: every 4 hours when `FIXTURE_SYNC_ENABLED=true`.
- Result sync: every 2 minutes when `RESULT_SYNC_ENABLED=true`.
- Stream health: every 5 minutes when `STREAM_HEALTH_ENABLED=true`.
- Operational issue detection: every 5 minutes.
- Homepage cache refresh: every 15 minutes.
- Operational data cleanup: daily.

## Environment

Use Redis for production queue and cache locks:

```text
QUEUE_CONNECTION=redis
CACHE_STORE=redis
FOOTBALL_PROVIDER=mock
FOOTBALL_API_KEY=
FIXTURE_SYNC_HORIZON_DAYS=14
```

The included mock provider is deterministic and safe for development/testing. Replace it through `FootballDataProviderInterface` rather than calling vendor APIs directly from jobs.
