# RiFiTV Full Audit

Date: 2026-08-17

## Architecture

RiFiTV is a Laravel 12 API plus a Next.js App Router frontend, with a small Node stream gateway for media relay/proxy behavior. Laravel owns the database, publication rules, match normalization, admin workflows, stream-source safety, playback windows, health checks, queues, scheduled jobs, and public REST endpoints. Next.js renders public SEO pages, admin screens, search, match pages, and the isolated playback UI. The public data path is:

```text
Next.js route -> frontend/lib/api.ts -> Laravel /api/v1 -> services/models/resources -> JSON DTOs
```

Important backend centers are `GameMatch`, `MatchResource`, `MatchDateWindowService`, `MatchScheduleService`, `PublicContentService`, `MatchSlugService`, `PlaybackWindowService`, `PlaybackSourceSelector`, `StreamHealthService`, and admin controllers under `Api/V1`. Important frontend centers are `lib/types.ts`, `lib/api.ts`, `lib/matches.ts`, `app/page.tsx`, `app/live/page.tsx`, `app/match/[slug]/page.tsx`, `components/MatchCard.tsx`, `components/RemoteNavigation.tsx`, and `features/player`.

## Current Strengths

- Public match payloads are normalized through Laravel resources and shared TypeScript types.
- Backend football-day logic uses `Africa/Casablanca` with a 06:00 product boundary instead of hardcoded GMT offsets.
- Public visibility requires published, public, verified/manual-verified matches.
- Match slugs are date-qualified, duplicate-safe, and support legacy lookup with canonical frontend redirects.
- Playback availability is backend-authoritative and exposes server time, opens-at, closes-at, and countdown values.
- Authorized sources are hidden until the playback window opens, then exposed through gateway/relay URLs instead of raw credentials.
- The player has a dedicated state machine, health-aware source order, retry policy, cleanup on unmount, and user-readable errors.
- Canonical `www` to apex redirects exist in Next config and nginx; nginx also redirects HTTP to HTTPS.
- Security headers, rate limits, auth/RBAC, audit logs, upload validation, SSRF protections, and minimal public health are present.
- Public pages include metadata, sitemap/robots, JSON-LD, loading/error boundaries, PWA manifest, offline route, and responsive E2E coverage.

## Problems Found

### P0

- `/live` selected its "next match" only from `home.next_match`, which is intentionally cross-day. If no match was live but a scheduled match remained later today, `/live` could fail to promote the real next broadcast.
- `/matches/today` and `/matches/tomorrow` computed dates in the Next.js layer instead of reusing the API-provided football date/timezone. This was usually correct, but weaker than the backend source of truth and risky near boundary times or if product timezone config changes.
- Sitemap today/tomorrow timestamps used the frontend local date helper instead of first trying the API football date.
- Canonical URL generation defaulted to localhost when `NEXT_PUBLIC_RIFITV_SITE_URL` was not configured, which is unsafe for production SEO if an env var is missed.
- Halftime display labels differed from the requested user-facing terminology.

### P1

- The current design is responsive and tested, but the homepage still favors a compact schedule over a stronger premium sports-broadcast hero.
- Smart TV navigation exists and is tested, but deeper player/channel remote navigation should be tested against real TV browsers.
- Countdown values are server-derived at load time, but long suspended tabs still rely on client-side decrementing until refetch/navigation.
- `/live` empty state is useful, but it can be made richer with logos, countdown, and broadcast chips.

### P2

- Lighthouse/Web Vitals were not measured in this local pass. Production-like throttling and a deployed URL are needed for reliable numbers.
- Cloudflare cache/page-rule behavior cannot be verified from the repository alone.
- Sitemap team discovery depends on public match coverage. That is acceptable now because `getAllMatchesForSitemap()` paginates all public matches, but it still depends on API availability during sitemap generation.

### P3

- Growth analytics code exists, but real 1,000 daily-user progress depends on production traffic, Search Console, privacy review, and approved analytics instrumentation.
- Arabic/RTL architecture remains an intentional future rollout, not a partial indexed implementation.

## Implemented In This Pass

- Added `frontend/lib/liveSchedule.ts` to centralize `/live` next-broadcast and later-today selection.
- Updated `/live` so today's next scheduled broadcast wins before cross-day fallback.
- Updated `/matches/today` and `/matches/tomorrow` to use `getHome().date` and `getHome().timezone`.
- Updated sitemap date generation to prefer the API football date and fall back to the frontend helper only if the API is unavailable.
- Changed canonical site fallback to `https://rifitv.com`.
- Aligned halftime labels to `Half-time` in backend and frontend status maps.
- Added a regression test for live-page schedule selection.

## Cache And Data Notes

- Public home data is cached for 30 seconds and invalidated by match mutations through `PublicContentService::forgetHome()`.
- Public schedule queries remain dynamic and no-store on the frontend, which favors live sports freshness.
- Static assets and local football/logo assets are safely cached by the service worker; API and media paths are deliberately excluded.
- Admin updates, fixture sync jobs, result sync jobs, stream health checks, relay lifecycle, playlist imports, and cleanup are scheduled in `routes/console.php`.

## Security Notes

- Raw source URLs and credentials are not exposed in public playback responses.
- Public health returns only `{ "status": "ok" }`; detailed health is authenticated admin-only.
- CSP/security headers are present in Next production headers, Laravel API middleware, and nginx.
- Production still requires environment verification: `APP_ENV=production`, `APP_DEBUG=false`, correct `APP_KEY`, CORS/Sanctum domains, trusted proxies, TLS, and Cloudflare rules.

## Test Results

- `php artisan test`: 57 passed, 344 assertions.
- `vendor/bin/pint --test`: passed.
- `npm run lint`: passed.
- `npm test`: 5 files passed, 21 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `php artisan route:list --except-vendor`: passed, 93 routes listed.
- `npm run e2e`: 10 passed, 10 skipped. Skips were credentialed admin flows without `RIFITV_E2E_ADMIN_EMAIL` / `RIFITV_E2E_ADMIN_PASSWORD`, plus mobile-project duplicates of desktop-only responsive tests.

## Remaining External Dependencies

- Production Cloudflare dashboard, DNS, TLS, cache rules, and redirect verification.
- Real authorized stream-source soak tests on mobile Safari, Android Chrome, desktop browsers, Samsung/LG TV browsers, Android TV browsers, and TV boxes.
- Production Lighthouse/Web Vitals on `https://rifitv.com`.
- Search Console/analytics credentials and privacy/legal review.
- Production queue/scheduler supervision checks on the deployed host.

## Priority Backlog

- P0: production env verification, Cloudflare cache validation, real stream soak testing, and API countdown resync for long-lived tabs.
- P1: richer homepage hero, richer `/live` fallback card, deeper TV remote testing through player/channel controls, and improved player landscape polish on real devices.
- P2: production Lighthouse pass, Arabic/RTL route architecture, richer OG image generation, and production sitemap monitoring.
- P3: growth dashboard calibration with real traffic and retention metrics.
