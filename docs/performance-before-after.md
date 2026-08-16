# Performance Before / After

Date: 2026-08-16

## Baseline

Commands run before changes:

- `php artisan test`: passed, 41 tests / 273 assertions, 80.30s.
- `./vendor/bin/pint --test`: passed.
- `npm run lint`: passed.
- `npm run test`: failed before executing tests because Vitest fork workers timed out.
- `npm run build`: passed. Build exposed `/admin` plus catch-all `/admin/[...section]`.

Production Lighthouse, TTFB, LCP, INP, CLS and stream soak measurements were not available from this local workspace because no production/staging host and authorized real stream source were provided.

## Changes

- Admin auth now uses Laravel Sanctum first-party session cookies instead of localStorage bearer auth.
- Frontend API access is centralized in `frontend/lib/api.ts` with credentials, CSRF bootstrap, typed `ApiError`, timeout support and 419 retry hooks.
- Admin navigation now uses real Next routes and `Link` for sidebar navigation.
- Added explicit admin route files for dashboard, today, upcoming, matches, match control, teams, competitions, playlists, channels, stream health, homepage, announcements, users, settings, audit log and system.
- Added lightweight loading states for admin, matches, match detail and competition detail routes.
- Homepage public payload now has a 30-second cache with explicit invalidation through `PublicContentService::forgetHome()`.
- SEO metadata and route manifests were tightened; player/admin chunks do not appear in the `/` route manifest.

## After

Commands run after changes:

- `php artisan test`: passed, 42 tests / 279 assertions, 44.89s.
- `./vendor/bin/pint --test`: passed.
- `npm run lint`: passed.
- `npm run test`: passed, 10 tests / 3 files, 55.45s.
- `npm run build`: passed. Build exposes individual admin routes including `/admin/matches/[id]/control`.
- `php artisan route:list`: passed, 95 backend routes.
- `php artisan rifitv:health`: database ok, cache ok, football provider mock, scheduler not seen.
- `php artisan rifitv:production-check`: failed in local env because production env flags/origins are not configured and the local database is missing expected official fixture data.

## Bundle Notes

`frontend/.next/server/app/page_client-reference-manifest.js` was checked for `AdminClient`, `PlayerUI`, `PlaybackEngine`, `hls`, `mpegts` and `PlaylistManager`; no matches were found for the homepage route. The match page route manifest includes `PlayerUI`, which is expected.

