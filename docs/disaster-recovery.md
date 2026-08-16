# Disaster Recovery

## Backups

Run `scripts/backup.sh` daily from a locked-down host or cron/systemd timer. Store database dumps and public uploaded assets off-server. Keep at least 14 daily backups unless storage policy says otherwise.

Required variables:

```text
BACKUP_DIR
APP_DIR
DB_HOST
DB_PORT
DB_DATABASE
DB_USERNAME
```

Use `scripts/restore-check.sh /path/to/database.sql.gz` against an isolated restore-check database. A backup is not verified until it has been restored.

## Scenarios

- Server dies: provision a fresh server from `docs/deployment.md`, restore latest database and uploaded assets, deploy the last known-good release, update DNS if needed.
- Database corruption: stop writes, snapshot current state, restore latest verified backup to a new database, point `.env` to it, run health checks.
- Redis fails: Laravel can recover once Redis returns; queue/cache operations degrade. Restart Redis and queue workers.
- Deployment fails: do not run destructive rollback. Fix build/config, or checkout the previous known-good commit and redeploy.
- Cloudflare breaks: temporarily bypass proxy for origin DNS only if origin firewall allows it safely.
- Frontend crashes: `systemd` restarts `rifitv-next`; inspect journal logs.
- Queue workers stop: restart `rifitv-queue`; admin Operations shows pending/failed jobs.
- Scheduler stops: restart `rifitv-scheduler`; admin Operations shows stale scheduler heartbeat.
- Stream provider fails: stream health alerts open, playback selector prefers healthy backups.

## Log Rotation

Rotate Laravel, Nginx, and systemd journal logs. Monitor disk usage for logs, backups, database growth, and uploads.
