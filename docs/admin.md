# Admin Guide

RiFiTV admin is available at `/admin`.

Seed login:

```text
admin@rifitv.local
password
```

## Dashboard

The dashboard prioritizes daily operation:

- today's matches
- live now
- upcoming
- finished
- stream problems
- unassigned broadcasts

Use `Ctrl/Cmd + K` for admin search.

## Matches

Use Matches for quick creation:

1. Choose competition.
2. Choose home and away teams.
3. Set kickoff.
4. Assign a broadcast channel.
5. Publish.

The API generates slug/default score/default status. Laravel validates team uniqueness, kickoff, IDs, visibility, and score fields.

## Live Control

Live Control is phone-friendly:

- increment/decrement home score
- increment/decrement away score
- adjust minute
- set live/halftime/finished/postponed
- toggle featured
- save quickly

Invalid status transitions are blocked unless an override is explicitly sent.

## Teams And Competitions

Teams and competitions can be created and listed from admin. Competitions include selection mode and featured clubs.

## Channels And Sources

Channels are managed separately from stream URLs. Sources belong to channels and support:

- HLS
- MPEG-TS
- priority
- enabled/backup flags
- server-side test action

Admin lists mask source URLs where possible. Audit logs never store full source URLs.

## Homepage, Settings, Users, Audit

Homepage sections, announcements, settings, admin users, roles, session revocation, uploads, and audit logs are all exposed through `/api/v1/admin/*`.
