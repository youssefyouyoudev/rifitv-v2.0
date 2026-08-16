# Architecture

RiFiTV v2 follows this boundary:

```text
Browser -> Next.js -> Laravel /api/v1 -> Application services -> MySQL / Redis / external services
```

Next.js never connects to the RiFiTV database. It consumes versioned Laravel endpoints through `frontend/lib/api.ts`.

## Backend

Laravel owns business rules, authentication, source selection, public payload shaping, and persistence. Phase 1 includes:

- Controllers under `App\Http\Controllers\Api\V1`
- API resources for matches, teams, competitions, and channels
- Services for homepage content, playback source selection, and timezone strategy
- Enums for match status, stream protocol, and source health
- Sanctum token auth for the admin shell
- MySQL schema with SQLite-compatible tests
- Database cache/queue tables and Redis-ready configuration

## Frontend

Next.js App Router renders public pages mostly as server components. Client components are used only for:

- Playback
- Admin login/dashboard shell
- Development player lab

Routes:

- `/`
- `/live`
- `/matches`
- `/match/[slug]`
- `/competitions`
- `/competition/[slug]`
- `/admin`
- `/dev/player` in development only

## API Boundary

Public endpoints:

- `GET /api/v1/home`
- `GET /api/v1/matches`
- `GET /api/v1/matches/{slug}`
- `GET /api/v1/matches/{slug}/playback`
- `GET /api/v1/competitions`
- `GET /api/v1/competitions/{slug}`

Admin endpoints:

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/admin/dashboard`

API errors are rendered as predictable JSON for validation, auth, authorization, and not-found responses.
