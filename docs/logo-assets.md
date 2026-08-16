# Logo Assets

Football assets are stored locally under `frontend/public/football`.

## Manifest

`frontend/public/football/logo-manifest.json` is the source of truth for local football logos. It records:

- asset type: `competition` or `club`
- display name
- local path
- source URL
- retrieval timestamp
- PNG dimensions
- SHA-256 checksum
- verification state

Current manifest status: 62 assets, 58 clubs, 4 competitions, and no missing logos for seeded fixtures.

## Local Paths

- Club crests: `/football/clubs/{team-slug}.png`
- Competition marks: `/football/competitions/{competition-slug}.png`

The importer refuses remote logo URLs in verification. Every seeded team and competition must resolve to a non-empty local PNG.

## Provenance

PSG/Ligue 1 team and competition images come from the official PSG image API where available. Premier League and LALIGA club/competition marks are normalized from Football Logos pages and served locally by RiFiTV. Commercial deployments should confirm brand and competition mark usage rights with the relevant rights holders before public launch.
