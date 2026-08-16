# Playback Performance

## Current Architecture

Playback remains isolated in `features/player`:

- `PlaybackEngine`
- `RecoveryManager`
- `SourceManager`
- HLS and MPEG-TS adapters
- player metrics and playback event reporting

The homepage route manifest does not reference player libraries. Match pages reference `PlayerUI`, as expected.

## Recovery

Current behavior remains bounded inside the player:

- state machine includes idle/loading/playing/buffering/recovering/switching_source/offline/ended/error.
- same-source retry uses bounded backoff.
- source switch occurs after source recovery attempts are exhausted.
- no `window.location.reload`, `location.reload` or `router.refresh` was found in playback code.

## Not Completed Locally

Real stream stability cannot be declared fixed from this workspace alone. The following still requires authorized production/staging sources:

- VLC vs RiFiTV comparison.
- 30-minute representative source soak.
- 60-minute main production candidate soak.
- Main-to-backup failure simulation against a live provider.
- Stable Relay vs raw MPEG-TS measurement with the real provider.

