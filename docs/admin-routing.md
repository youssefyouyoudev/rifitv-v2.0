# Admin Routing

## Route Inventory

- `/admin`: dashboard, admin session bootstrap, API `/admin/dashboard`.
- `/admin/today`: daily operations, API `/admin/today`.
- `/admin/upcoming`: upcoming operational view, API `/admin/today`.
- `/admin/matches`: match management, API `/admin/matches`.
- `/admin/matches/new`: match creation surface, API `/admin/matches`.
- `/admin/matches/[id]`: match detail placeholder surface, API `/admin/matches/{id}`.
- `/admin/matches/[id]/control`: Match Control Center, API `/admin/matches/{id}/control`.
- `/admin/teams`: team management, API `/admin/teams`.
- `/admin/teams/[id]`: team detail route, API `/admin/teams/{id}`.
- `/admin/competitions`: competition management, API `/admin/competitions`.
- `/admin/competitions/[id]`: competition detail route, API `/admin/competitions/{id}`.
- `/admin/playlists`: IPTV playlist management, API `/admin/playlists`.
- `/admin/playlists/new`: playlist creation surface, API `/admin/playlists`.
- `/admin/playlists/[id]`: playlist detail route, API `/admin/playlists/{id}`.
- `/admin/channels`: channel catalog, API `/admin/channels`.
- `/admin/channels/[id]`: channel detail route, API `/admin/channels/{id}`.
- `/admin/stream-health`: stream health, API `/admin/stream-health`.
- `/admin/stream-sources`: stream source management, API `/admin/stream-sources`.
- `/admin/homepage`: homepage content, API `/admin/homepage`.
- `/admin/announcements`: announcements, API `/admin/announcements`.
- `/admin/users`: admin users, API `/admin/users`.
- `/admin/users/[id]`: user detail route, API `/admin/users/{id}`.
- `/admin/settings`: settings, API `/admin/settings`.
- `/admin/audit-log`: audit logs, API `/admin/audit-logs`.
- `/admin/system`: system operations, health and jobs, API `/admin/health`, `/admin/queue-health`, `/admin/operations/run`.

All admin API routes remain protected by Laravel auth/admin middleware. Frontend visibility is UX only; Laravel remains authoritative for permissions.

## Navigation

The sidebar uses Next `Link` routes. Search uses a 400ms debounce and aborts stale search requests. Streaming-heavy links disable aggressive prefetching.

