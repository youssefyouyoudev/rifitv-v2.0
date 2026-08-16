# API

Base path: `/api/v1`. Responses use a top-level `data` key. Validation errors return `422` with `message` and `errors`. Admin endpoints require `Authorization: Bearer <token>`.

## Public

- `GET /api/health`: minimal health, `{ "status": "ok" }`.
- `GET /api/v1/home`: homepage feed.
- `GET /api/v1/matches?status=live|scheduled|finished`: public matches.
- `GET /api/v1/matches/{slug}`: public match details.
- `GET /api/v1/matches/{slug}/playback`: approved playback candidates for a published match.
- `POST /api/v1/playback/events`: anonymous playback signal; strict rate limit.
- `GET /api/v1/competitions`
- `GET /api/v1/competitions/{slug}`
- `GET /api/v1/teams/{slug}`
- `GET /api/v1/search?q=arsenal`: grouped public search.

## Auth

- `POST /api/v1/auth/login`: returns admin token for valid active admins.
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

## Admin

Major groups:

- Dashboard/operations: `/admin/dashboard`, `/admin/health`, `/admin/today`, `/admin/queue-health`, `/admin/alerts`, `/admin/sync-runs`, `/admin/imports/fixtures`, `/admin/operations/run`.
- Football: `/admin/matches`, `/admin/teams`, `/admin/competitions`.
- Streaming: `/admin/channels`, `/admin/stream-sources`, `/admin/stream-sources/{id}/test`.
- Content/system: `/admin/homepage`, `/admin/announcements`, `/admin/settings`, `/admin/users`, `/admin/audit-logs`.

## Rate Limits

Configured buckets: public browsing, search, playback candidates, playback events, login, and admin API. Edge-level limits should complement these in Cloudflare/Nginx.
