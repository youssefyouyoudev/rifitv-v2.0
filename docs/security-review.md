# Security Review

Phase 4 review scope: authentication, authorization, IDOR, mass assignment, SQL injection, XSS, CSRF/token behavior, SSRF, uploads, CORS, rate limits, secrets, logs, and playback endpoints.

## Changes Made

- Added public minimal `/api/health` and protected detailed `/api/v1/admin/health`.
- Added API security headers and `X-Request-Id`.
- Added route-specific throttles for public browsing, search, playback candidates, playback events, login, and admin APIs.
- Added CORS configuration driven by `CORS_ALLOWED_ORIGINS`.
- Removed SVG from logo uploads.
- Added login success/failure audit events with hashed email metadata for failures.
- Added production seeder guard so default demo admin/content is not seeded when `APP_ENV=production` unless explicitly enabled.
- Added `rifitv:create-owner` and `rifitv:production-check`.

## Notes

Admin remains protected by Sanctum bearer tokens, `EnsureAdmin`, and RBAC permissions. Passwords and tokens are hidden from model serialization. Audit metadata redacts passwords, tokens and stream URLs.

The frontend CSP includes `unsafe-inline` for scripts because match pages emit JSON-LD structured data. This is documented and should be revisited if nonce/hash-based JSON-LD rendering is introduced. `unsafe-eval` is not used in the production CSP.

Playback URLs are browser-visible by nature. RiFiTV does not claim they can be hidden from users; future signed URL support should use short-lived grants and provider-authorized refresh flows.

## Remaining Production Actions

- Configure Cloudflare and Nginx rate limits at the edge.
- Add a real error monitoring provider via a sanitized abstraction.
- Review all production secrets with a secret scanner before launch.
- Consider 2FA for owners before public launch.
