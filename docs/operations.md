# Operations Runbook

The admin panel now includes operations sections:

- Today: match readiness, live/soon/later/finished buckets.
- Stream Health: status, latency, error category, manual checks.
- Imports: fixture import decisions and recent sync runs.
- Operations: queue counts, scheduler heartbeat, alerts, and manual job buttons.

## Daily Checks

1. Open `/admin` and sign in.
2. Check Operations for scheduler heartbeat, queue failures, and open alerts.
3. Check Today for critical matches with no published page, channel, or healthy source.
4. Review Imports for `needs_mapping` rows.
5. Use Stream Health to test suspicious sources before a match starts.

## Alerts

Current alert types:

- `mapping_required`: provider fixture cannot resolve a team or competition.
- `fixture_sync_failed`: provider sync failed.
- `stream_offline`: source failed repeated health checks.
- `match_missing_broadcast`: match starts soon with no channel.
- `playback_failures`: browsers reported repeated playback failures for one source.

Alerts are deduped by `dedupe_key`, so repeated checks update the same open alert instead of spamming operators.
