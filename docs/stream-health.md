# Stream Health

Phase 3 adds automated stream source checks and operational alerting.

## Checks

`StreamHealthService` validates enabled stream sources with short HTTP range requests:

- HLS requires `#EXTM3U` plus media or variant playlist markers.
- MPEG-TS accepts video/octet-stream responses or a minimal transport-sized body.
- Production blocks localhost/private/reserved targets to avoid unsafe probing.

The service records each check in `stream_health_checks` and updates `stream_sources`:

- `last_known_status`
- `latency_ms`
- `last_success_at`
- `consecutive_failures`
- `consecutive_successes`
- `health_score`
- `last_error_type`

## Hysteresis

One failure marks a source degraded, three consecutive failures mark it offline, and two consecutive successes recover it to healthy. Offline sources open a `stream_offline` alert; healthy recovery resolves that alert.

## Playback Selection

`PlaybackSourceSelector` now ranks health before priority:

1. healthy/unknown
2. degraded
3. offline

This keeps the player on usable backups without changing the Phase 1 playback engine.
