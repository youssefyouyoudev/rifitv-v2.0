# RiFiTV Production Audit

Date: 2026-08-17

## Scope

This audit covers the current Laravel API, Next.js App Router frontend, match data flow, playback gateway and player, admin workflows, SEO surfaces, analytics hooks, scheduler, deployment files, and automated tests. The review was performed against the repository checkout; production credentials, Cloudflare configuration, and live authorized stream sources were not available.

## Existing Architecture

```text
Browser -> Next.js App Router -> Laravel /api/v1 -> application services -> database/cache/queues
                                                        |
                                                        +-> playback token -> /media/live/{token}
                                                        +-> optional HLS relay / stream gateway
```

- Laravel 12 owns persistence, publication gates, timezone/date windows, playback-window authority, stream-source selection, admin authorization, health checks, and scheduled jobs.
- Next.js renders public pages as server components and uses client components for playback, polling, analytics hooks, and the admin shell.
- The public API exposes home, schedules, match, competition, team, search, playback, and health endpoints.
- Match resources normalize status, scores, Casablanca playback windows, channels, publication state, and stream-health summaries.
- The repository includes Sanctum authentication, RBAC permissions, rate limiters, security headers, SSRF validation for playlist ingestion, signed short-lived playback tokens, audit logs, queue jobs, a stream gateway, and deployment/systemd scripts.

## Strengths

- Canonical Africa/Casablanca football-day service is shared by backend schedule queries and frontend date helpers.
- Public visibility requires publication, public visibility, and verified/manual-verified status.
- Playback sources are withheld until the backend playback window opens.
- HLS/MPEG-TS playback has source selection, retries, health-aware fallback, stall detection, and cleanup on unmount.
- Admin match management has aggregate counters, date/filter URL state, bulk actions, publication controls, channel assignment, delete confirmation, and audit history.
- Production checks, football data audits, migration indexes, feature tests, frontend tests, and build checks already exist.
- Sitemap, robots, metadata, JSON-LD, loading states, a PWA manifest, and responsive public components are present.

## Findings

### P0 - Correctness and production safety

1. Match slugs are not consistently date-qualified. Manual creation uses `home vs away`; imported fixtures preserve legacy provider slugs. Duplicate fixtures therefore need numeric suffixes and old URLs cannot be redirected deterministically.
2. Public schedule surfaces overlap without one explicit contract: the homepage is limited to 24 football-day matches, `/matches` paginates a different query, and `/football` is a second schedule surface. This can make counts and visible lists disagree when a date is busy or cache entries are warm.
3. `/live` returns an empty section when there are no live matches because `MatchSection` returns `null`. The route needs a useful next-match and remaining-today fallback.
4. Playback-window logic is backend-authoritative, but the match page requests playback data on every render and does not expose a clear retry/recovery state for API failures. Real-source soak testing remains external.
5. Production validation depends on environment configuration that is not present in the checkout. `APP_ENV`, `APP_DEBUG`, CORS origins, proxy/TLS behavior, real football data, and authorized stream sources must be verified during deployment.

### P1 - User experience, discoverability, and performance

1. The homepage is a compact schedule rather than a live/next-match hero, so the primary answer is not visually immediate on mobile or desktop.
2. The mobile navigation shows Home, Live, Today, and More but omits the primary Matches destination.
3. Match cards show useful data but do not consistently expose a clear Morocco-time label, explicit opening state, source-health language, share action, or related schedule links on the match page.
4. Countdown state is initialized from server seconds and decremented locally, but it does not resynchronize with server time after long tab suspension.
5. Public routes are all `force-dynamic`. This is correct for freshness but leaves performance gains on the table for stable competition/team metadata and requires disciplined API/cache headers.
6. Team and competition pages are indexable but the sitemap discovers teams only from the first public schedule page, which can omit teams beyond the API page size.

### P2 - SEO, accessibility, and maintainability

1. Homepage title and description are generic and do not clearly target today's football, Morocco kickoff times, and TV channels.
2. There is no `/matches/today` or `/matches/tomorrow` canonical landing route, and no channel landing page despite channel data being available.
3. Match structured data is present but does not include a clear watch-offer/availability model, location, or a breadcrumb shared component.
4. The root layout is English-only. Arabic/RTL architecture is not yet implemented and must be introduced as a deliberate route/metadata system rather than ad hoc translated strings.
5. The not-found page has only a home action and does not help users reach today's matches, live fixtures, or search.
6. The project has no repository-owned analytics transport or retention dashboard; the current client analytics module only emits browser events and optional `dataLayer` entries.

### P3 - Growth and operations

1. There is no real visitor analytics provider integration, so daily users, returning users, acquisition source, popular matches, and playback failure rate cannot be reported without external instrumentation.
2. Social sharing, favorites, reminders, and an internal growth dashboard are not yet implemented.
3. Lighthouse, production Web Vitals, Cloudflare cache behavior, canonical-host redirects, and real stream soak results require an environment with the production domain and authorized sources.

## Priority Plan

### P0 implementation

- Introduce one deterministic date-qualified match slug generator and a redirect-compatible legacy lookup path.
- Make the public schedule contract explicit and reuse normalized schedule data for home/live/today fallback states.
- Make `/live` useful when empty and keep backend playback/availability authoritative.
- Add tests for duplicate/legacy slugs, public schedule consistency, empty live state, and playback-window boundaries.

### P1 implementation

- Improve the homepage hero and next/live match hierarchy while preserving the current RiFiTV visual system.
- Fix mobile navigation, match-page sharing/internal links, countdown resynchronization, and loading/error states.
- Keep public data fresh with bounded cache headers and invalidation after admin/sync mutations.

### P2/P3 implementation

- Add canonical today/tomorrow schedule routes, richer metadata/JSON-LD, sitemap coverage, and a better 404.
- Add privacy-conscious analytics documentation and event transport boundaries without fabricating metrics.
- Add share/favorites/reminder foundations and a growth plan that clearly separates technical readiness from the 1,000-user target.

## External Validation Required

- Production `APP_ENV=production`, `APP_DEBUG=false`, CORS, Sanctum domains, secure cookies, trusted proxy, canonical host redirects, and Cloudflare cache rules.
- Official fixture import and football production audit with real data.
- Authorized HLS/MPEG-TS stream soak tests, source failure/recovery tests, and relay health under load.
- Lighthouse/Web Vitals on the canonical production host.
- Privacy/legal review and credentials for any analytics or Search Console integration.
