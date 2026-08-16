# Match Control Center

The Match Control Center is available at `/admin/matches/{id}/control` and in the admin sidebar as Match Control.

It separates four operational concerns:

- Match state: scheduled, live, halftime, finished, postponed, cancelled.
- Score state: home score, away score, and minute.
- Playback availability: open, close, extend, or reopen the stream window.
- IPTV assignment: ordered channels where the first channel is Main and later channels are Backup.

Important behavior:

- Mark Live updates the match status and sets `actual_started_at` when it is empty.
- Mark Live does not open public playback by itself.
- Open/Close/Extend/Reopen only affect playback override timestamps.
- Mark Finished keeps the match record, score, channels, and history intact.
- Score saves do not alter channel assignments or restart playback.

Backend endpoints:

- `GET /api/v1/admin/matches/{match}/control`
- `PATCH /api/v1/admin/matches/{match}/control/score`
- `PATCH /api/v1/admin/matches/{match}/control/status`
- `PATCH /api/v1/admin/matches/{match}/control/feature`
- `POST /api/v1/admin/matches/{match}/control/playback`

