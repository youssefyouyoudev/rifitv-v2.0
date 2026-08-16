# Playback Cutting Root Cause

Generated on 2026-08-14 for the critical RiFiTV IPTV playback reliability pass.

## Original Observed Error

Browser logs showed valid MPEG-TS startup followed by repeated transport failures:

- MPEG-TS PAT/PMT parsed successfully.
- Video was H.264 and audio was AAC.
- MSE initialization succeeded.
- `mpegts.js` later reported repeated `502 Bad Gateway`.
- `TSDemuxer` later reported sync byte `60`, which is `0x3C` / `<`, not the MPEG-TS sync byte `0x47`.

This proves the first problem was not codec detection. The media path was either returning HTTP errors or letting text/HTML bytes reach the MPEG-TS parser.

## Request Path

Development/current fallback path:

```text
Browser
-> Laravel /media/live/{token}
-> IPTV provider
```

Target production raw gateway path:

```text
Browser
-> Nginx /media/live/{token}
-> Node stream-gateway
-> Laravel /api/media/tokens/{token} for authorization only
-> IPTV provider
```

Target production stable relay path:

```text
IPTV provider
-> one FFmpeg ingest per source, stream copy
-> local HLS files
-> Nginx /media/hls/
-> Browser Hls.js
```

## Exact 502 Origin Found

The local environment had proxy variables pointing at `127.0.0.1:9`. Laravel/Guzzle honored those variables, so IPTV provider requests were routed to a dead local proxy and failed before reaching the provider. After explicit proxy bypass, the first provider hop returned an HTTP redirect, proving that the dead proxy was a RiFiTV transport bug in the local media path.

After bypassing the proxy, the provider media edge returned `403` for the tested beIN source from this environment. That is now surfaced as an upstream/provider failure and recorded on the stream source instead of being repeatedly fed to the browser as playable media.

## Why Invalid TS Byte Appeared

The `0x3C` byte strongly indicates text content such as HTML/XML entered the media parser. Before this pass, gateway/fallback paths did not validate content type and TS sync bytes before committing `200 video/mp2t`.

## HTML/Text Contamination Status

Confirmed risk and fixed:

- Node gateway now rejects HTML, JSON, plain text, and XML before sending media headers.
- Node gateway validates the first MPEG-TS bytes before `200 video/mp2t`.
- Laravel fallback now performs the same content-type and startup-byte validation.
- Gateway tests assert HTML upstream is rejected before media headers.
- Gateway tests assert mid-stream failure does not inject `Bad Gateway` or `<html` into the media body.

## Gateway Changes

- Node gateway follows provider redirects.
- Node gateway validates startup MPEG-TS/HLS samples.
- Node gateway uses `stream.pipeline` for backpressure.
- If upstream fails before media starts, it returns a clean `502`.
- If upstream fails after media starts, it destroys/closes the media connection and does not write any textual error body.
- Gateway request headers use a VLC-like user agent and `Icy-MetaData`.
- Laravel fallback bypasses dead proxy env vars and records gateway/provider failures back onto source health.

## Nginx Changes

`infra/nginx/rifitv.conf` now includes a dedicated `/media/live/` location:

- proxies to Node stream-gateway
- disables proxy buffering
- disables request buffering
- disables proxy cache
- disables gzip
- disables intercepted HTML error pages
- uses longer read/send timeouts

It also includes `/media/hls/` for direct HLS relay serving with MPEG-TS and HLS MIME types, no gzip, and no-cache headers.

## MPEGTS.js Changes

Raw MPEG-TS stable profile is now the default:

- `enableWorker: false`
- `enableStashBuffer: true`
- `stashInitialSize: 1024 * 1024`
- `lazyLoad: false`
- `liveBufferLatencyChasing: false`
- source buffer cleanup enabled
- audio timestamp gap fixing enabled

Unexpected live EOF is now treated as a reconnectable playback issue instead of a normal ended stream.

## HLS Relay Result

Implemented foundation:

- `live_ingests` table
- `LiveIngest` model
- `HlsRelayManager`
- one ingest session per source
- lock key `live_ingest:{source_id}`
- FFmpeg command is generated as an argument array, not a shell-concatenated string
- provider URL is hidden from status output and stored metrics
- FFmpeg stream copy command uses reconnect flags where supported
- output is local HLS: `index.m3u8` plus `.ts` segments
- admin pipeline test endpoint added
- scheduled relay lifecycle/prewarm command added
- CLI commands added:
  - `php artisan rifitv:relay:start {sourceId}`
  - `php artisan rifitv:relay:status {sourceId}`
  - `php artisan rifitv:relay:stop {sourceId}`
  - `php artisan rifitv:relay:lifecycle`

Local test result:

```text
source_id: 82073
relay status: failed
last_error: ffmpeg_unavailable
provider_url_hidden: true
lifecycle: relay_unavailable
```

FFmpeg and ffprobe are not installed in this workspace, so local HLS generation and codec probing could not be run here.

## Raw Gateway Result

The raw gateway path is safer now:

- no provider credentials in browser URL
- proxy env bypass for provider fetches
- provider redirects followed in Node gateway
- HTML/text rejected before media headers
- MPEG-TS sync validated before media headers
- mid-stream upstream failure closes the stream instead of appending error text

The tested beIN sources still returned provider `403` or connection failures from this environment, so raw playback cannot be certified stable here.

## 30/60-Minute Test Result

Not completed in this environment.

Reasons:

- FFmpeg/ffprobe are not installed locally.
- The tested provider media edge returned `403` after redirect from this network.
- Chrome cannot play a stream the backend/gateway cannot receive.

The code now prevents this failure from becoming TS corruption or infinite `502` loops. A true 30/60-minute acceptance test must be run from the production gateway host or another network/IP that the provider accepts.

## Chosen Production Transport

Recommended production default:

```text
HLS Relay for raw provider MPEG-TS sources
```

Raw MPEG-TS gateway remains available as a fallback/diagnostic transport.

## Remaining Limitations

- Need FFmpeg installed on the production gateway host.
- Need production Nginx reloaded with the dedicated media locations.
- Need a provider-accepted server IP/network for real stream tests.
- Need 30-minute multi-source and 60-minute production-source soak tests after deployment.
- Credentials should be rotated because they were previously exposed outside the secret store during debugging.

## Verification Completed In This Pass

- Backend test suite: 40 passed, 257 assertions.
- Backend formatter: passed.
- Frontend unit tests: 10 passed.
- Frontend lint: passed.
- Frontend production build: passed.
- Stream gateway tests: 4 passed.
- Stream gateway TypeScript build: passed.
- Laravel health check: database ok, cache ok.
- Migrations: no pending migrations after applying `live_ingests`.
