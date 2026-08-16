# IPTV Import Report

Generated on 2026-08-14 after the production catalog reset and fresh private M3U rebuild.

## Outcome

- Reset scope was limited to IPTV streaming catalog data.
- Football data, auth data, roles, competitions, teams, matches, seasons, and site settings were preserved.
- A streaming catalog backup was written before reset.
- The fresh playlist was imported from the private server-side upload.
- VOD/movie/series sections were excluded from the live TV catalog.
- Raw provider URLs and credentials are not returned in admin or public playback payloads.

## Import Counts

- Playlists: 1
- Live channels imported: 7,222
- Stream sources imported: 7,222
- Provider playlist entries diagnosed before live filtering: 72,369
- Provider groups diagnosed before live filtering: 60
- Normalized live groups after import: 44
- Protocols after import: 7,222 MPEG-TS, 0 HLS
- Source schemes after import: 7,222 HTTP, 0 HTTPS
- Gateway-required sources: 7,222
- Direct-playable browser sources: 0
- Failed queued jobs: 0

## Security Notes

- Uploaded M3U files are read server-side from private storage.
- The import service keeps original channel and group names while also writing canonical and normalized fields for admin organization.
- Stream source API resources continue to mask URLs.
- Public playback selection issues opaque, expiring media gateway URLs instead of provider URLs.
- Provider HTTP sources are treated as mixed-content risks and are routed through the gateway.

## Operational Notes

- The successful rebuild created playlist ID `3`.
- The reset backup path reported by the command was `backend/storage/app/private/backups/iptv-reset-20260814-210259.jsonl`.
- Initial health checks are intentionally capped to avoid thousands of provider probes during import.
- Imported health state is currently `unknown` until stream checks run against reachable upstream streams.

