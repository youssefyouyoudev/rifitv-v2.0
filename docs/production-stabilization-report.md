# Production Stabilization Report

Date: 2026-08-16

## Completed

- Replaced admin localStorage token login with Sanctum/session login.
- Added canonical `/api/v1/auth/user`.
- Enabled stateful API middleware and credentialed CORS support.
- Added centralized frontend API client behavior for credentials, CSRF, typed errors, timeout and 419 retry.
- Added explicit admin App Router routes and loading states.
- Converted admin sidebar navigation to real Next links.
- Added public route loading states.
- Added homepage public cache and invalidation.
- Added SEO metadata, sitemap/robots tightening and server-rendered JSON-LD.
- Confirmed homepage route manifest does not include player/admin modules.

## Verification

- Backend tests: passed, 42 tests / 279 assertions.
- Pint: passed.
- Frontend lint: passed.
- Frontend tests: passed, 10 tests / 3 files.
- Frontend production build: passed.
- Laravel route list: passed, 95 routes.
- Laravel health: database/cache ok; scheduler not seen in this local environment.
- Production check: failed locally because production env flags/origins are unset and official fixture data is missing locally.

## Remaining Production Work

- Configure real production frontend/API/admin origins.
- Set production `SANCTUM_STATEFUL_DOMAINS`, `CORS_ALLOWED_ORIGINS`, `SESSION_DOMAIN`, secure cookie and proxy headers.
- Load/verify official fixture data before production-check can pass.
- Run production Lighthouse/Web Vitals for TTFB, LCP, INP and CLS.
- Run the required stream soak/failure tests with real authorized sources.
- Run full Playwright E2E against production-mode services.

