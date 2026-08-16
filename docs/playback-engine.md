# Playback Engine

The playback system lives in `frontend/features/player/`. React pages talk to `PlaybackEngine` only.

## Modules

- `PlaybackStateMachine` models `idle`, `loading`, `ready`, `playing`, `buffering`, `recovering`, `switching_source`, `offline`, `error`, and `ended`.
- `SourceManager` orders compatible sources deterministically and tracks per-session failures to avoid loops.
- `HlsAdapter` handles native HLS where appropriate and `hls.js` in MSE browsers.
- `MpegTsAdapter` isolates `mpegts.js` setup, teardown, and capability checks.
- `RecoveryManager` applies retry/recover/switch-source decisions using configured limits.
- `PlayerMetrics` emits sanitized development diagnostics without logging full sensitive URLs.
- `PlayerUI` renders controls, source selection, friendly state messages, retry, fullscreen, and live-edge controls.

## Recovery Strategy

The engine does not reload the page. On errors or stalls it:

1. Enters `recovering`.
2. Attempts media recovery for recoverable media issues.
3. Retries the current source with backoff for network or transient failures.
4. Marks the source failed after the configured limit.
5. Switches to the next compatible source.
6. Shows a clean unavailable state when all sources are exhausted.

The Laravel playback endpoint returns policy values:

- `max_recovery_attempts_per_source`
- `max_source_failures_per_session`
- `stall_detection_ms`
- `retry_backoff_ms`

## Stall Detection

The engine checks whether `currentTime` progresses while state is `playing`. If playback appears stuck beyond `stall_detection_ms`, it raises a stall issue and follows the same controlled recovery path.

## Live Edge

For live events the player exposes `LIVE` and `Go Live`. Healthy playback is not force-seeked continuously. After drift is detected, the user can return to the live edge.

## Cleanup

Adapters destroy media instances, unload sources, detach MSE players, clear watchdog timers, and remove network listeners on unmount/source changes.
