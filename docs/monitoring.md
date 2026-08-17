# RiFiTV Monitoring

## Existing signals

- `GET /api/health` is a safe public liveness check and returns no infrastructure detail.
- Authenticated admins can use `/api/v1/admin/health` for database, cache, queue, scheduler, provider, stream, sync, and storage status.
- The admin Operations view exposes queue failures, scheduler heartbeat, fixture/result sync state, stream checks, and detailed health.
- Stream health checks persist sanitized status and open operational alerts after repeated failures.
- Playback recovery reports sanitized event types and source identifiers; upstream credentials remain server-side.
- Laravel scheduled jobs cover fixture sync, result sync, stream health, relay lifecycle, playlist sync, operational issue detection, homepage refresh, and retention cleanup.

## Logs and alerts

Keep application and queue-worker logs centralized at the host or approved observability provider. Do not log playlist URLs with credentials, playback tokens, cookies, authorization headers, or raw analytics visitor IDs. Alert on repeated queue failures, stale scheduler heartbeats, failed fixture/result syncs, live matches without healthy sources, and rising playback failures.

## External validation

Sentry, uptime checks, Cloudflare analytics, Search Console, and alert delivery require production credentials and were not enabled by this repository change. Configure them only after verifying retention, access controls, and the legal/privacy policy.
