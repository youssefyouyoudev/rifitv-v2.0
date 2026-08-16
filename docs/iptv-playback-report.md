# IPTV Playback Report

Generated on 2026-08-14 for the fresh IPTV catalog and gateway playback work.

## Implemented

- Public playback payloads now expose `transport`, `playback_url`, `quality`, and browser compatibility metadata.
- Gateway playback tokens are opaque and time-limited.
- Match playback still respects the 10-minute pre-kickoff window and post-start close window.
- Gateway playback also verifies that the requested source is assigned to the match before resolving or streaming it.
- The browser player resolves `playback_url` first and keeps direct provider URLs out of the browser for gateway sources.
- HLS/native/video and MPEG-TS adapters share the same safe playback URL path.
- MPEG-TS playback configuration is centralized with stable, balanced, and low-latency profiles.
- Browser-incompatible and disabled sources are skipped by source selection.

## Diagnostics

- The private upload is valid M3U and starts with `#EXTM3U`.
- Diagnosed playlist entries: 72,369.
- Diagnosed stream schemes: 72,369 HTTP, 0 HTTPS.
- Sampled streams reported mixed-content risk and therefore require gateway playback.
- Sampled upstream GET checks returned connection exceptions in this environment, so real upstream playback could not be certified here.
- `ffprobe` is not available in this environment, so codec/container probing could not be completed locally.

## Gateway

- Laravel includes a local development fallback route at `/media/live/{token}`.
- A dedicated Node gateway service is scaffolded under `stream-gateway/`.
- The gateway resolves tokens through Laravel using `X-RiFiTV-Gateway-Secret` and proxies upstream streams with backpressure handling.
- Production should run the Node gateway behind Nginx rather than using PHP-FPM as the long-running stream pipe.

## Verification

- Full backend test suite: 38 passed, 247 assertions.
- Backend formatter: passed.
- Frontend lint: passed.
- Frontend tests: 3 files passed, 9 tests passed.
- Frontend production build: passed.
- Stream gateway TypeScript build: passed.
- Stream gateway smoke test: passed.
- Application health check: database ok, cache ok.

## Not Certified Here

- A 30-minute Chrome or Edge live playback soak was not completed in this environment.
- VLC comparison could not be completed because sampled provider streams were not reachable from this environment.
- Browser codec support remains marked by diagnostics and health checks; it is not guessed during import.

