# Admin Auth

## Strategy

Admin authentication now uses Laravel Sanctum's first-party SPA session flow:

1. Next requests `/sanctum/csrf-cookie` with credentials.
2. Laravel sets the XSRF and session cookies.
3. Next posts credentials to `/api/v1/auth/login`.
4. Laravel logs the user into the `web` guard, regenerates the session and returns the admin user.
5. Next bootstraps refreshes and deep links through `/api/v1/auth/user`.
6. Logout posts to `/api/v1/auth/logout`, invalidates the server session, regenerates CSRF state and expires the session cookie.

The frontend no longer stores an admin bearer token in localStorage.

## Local Settings Observed

- Local frontend origin: `http://127.0.0.1:3000` / `http://localhost:3000`.
- Local API origin: `http://127.0.0.1:8000`.
- Session driver: database.
- Session cookie domain: local default/null.
- CORS credentials: enabled.
- Sanctum stateful local hosts include localhost/127.0.0.1 with development ports.

Production hosts must be configured through environment values such as `APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN`, `SESSION_SECURE_COOKIE` and `SESSION_SAME_SITE`. Do not copy placeholder domains blindly.

## Failure Handling

The frontend API client distinguishes:

- `401`: confirmed unauthenticated.
- `419`: CSRF/session mismatch, eligible for CSRF refresh and retry on state-changing requests.
- `5xx`/network errors: request failure, not automatic logout.

## Regression Coverage

Backend coverage now verifies login session persistence, `/auth/user`, logout invalidation, guest rejection and non-admin rejection.

