# Playlist Management

Playlist management is available at `/admin/playlists`.

Supported source types:

- `m3u_url`: imports a remote M3U playlist.
- `xtream`: imports live streams from an Xtream `player_api.php` endpoint.
- `uploaded_m3u`: stores an uploaded M3U privately and parses it server-side.

Imports are idempotent. Channels are matched by playlist and external channel identity, then updated in place. A repeated import updates metadata and stream URL hashes instead of duplicating channels.

Raw playlist URLs and credential-bearing stream URLs are not returned by playlist resources. Imported stream sources expose only masked hosts in admin JSON, while the playback engine still reads the stored URL when the match playback window is open.

Backend endpoints:

- `GET /api/v1/admin/playlists`
- `POST /api/v1/admin/playlists`
- `PUT /api/v1/admin/playlists/{playlist}`
- `DELETE /api/v1/admin/playlists/{playlist}`
- `POST /api/v1/admin/playlists/{playlist}/sync`
- `POST /api/v1/admin/playlists/{playlist}/import-now`
- `GET /api/v1/admin/playlist-channels`

