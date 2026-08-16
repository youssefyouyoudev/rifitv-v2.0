# Stream Security

Playlist ingestion uses `SafeUrlValidator` before server-side fetches.

Blocked source targets include:

- `localhost`
- loopback IPs
- private IP ranges
- reserved IP ranges
- link-local and metadata-style addresses
- non-HTTP(S) schemes

Imported stream sources are stored for playback selection but are masked in admin API resources. The full URL is not returned for playlist-origin sources.

Audit logging sanitizes `source_url`, `url`, `password`, and token-like metadata before writing audit records.

Public playback remains gated by `PlaybackWindowService`; assigned sources are only returned when the computed or overridden playback window is open.

