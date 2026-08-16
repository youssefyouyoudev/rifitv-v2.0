# Channel Assignment

Match IPTV assignment uses the existing `match_channels` pivot table.

Ordering is meaningful:

- The first assigned channel is treated as Main.
- Later assigned channels are treated as Backup.
- Promoting a channel rewrites pivot sort order only.
- Removing a channel detaches it from the match only; it does not delete the channel or stream sources.

The Match Control Center shows source count, enabled count, healthy count, offline count, and per-source test actions for every assigned channel.

Assignment endpoints:

- `POST /api/v1/admin/matches/{match}/control/channels`
- `DELETE /api/v1/admin/matches/{match}/control/channels/{channel}`
- `POST /api/v1/admin/matches/{match}/control/channels/{channel}/promote`

