# Playback Window

Laravel is the authority for stream access.

Default rules:

- Open: `kickoff_at - 10 minutes`
- Close: `actual_started_at + 120 minutes`
- Fallback close: `kickoff_at + 120 minutes` when `actual_started_at` is unknown
- TBC kickoff: locked with no stream source disclosure

Config:

- `PLAYBACK_OPEN_BEFORE_MINUTES=10`
- `PLAYBACK_DURATION_MINUTES=120`

Derived response state is calculated by `PlaybackWindowService`:

- `tbc`
- `locked`
- `opening_soon`
- `open`
- `ended`
- `unavailable`

`GET /api/v1/matches/{slug}/playback` returns zero sources unless the server-side status is open. Manual admin live-control actions can open now, close now, extend 15/30 minutes, or reopen for 30 minutes through override timestamps.
