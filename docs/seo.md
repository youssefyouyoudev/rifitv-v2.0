# SEO

## Indexable Routes

- `/`
- `/matches`
- `/match/[slug]`
- `/competitions`
- `/competition/[slug]`
- `/team/[slug]`

The sitemap includes public root, matches, competitions, public match pages and teams discovered from public matches.

## Excluded Routes

Admin routes are marked `noindex,nofollow` in the admin layout and excluded by robots. Robots also disallows `/api/`, `/media/`, `/dev/` and the dev HMR endpoint.

## Metadata

Implemented with Next metadata APIs:

- Root title template and metadata base.
- Homepage title/description/canonical/OG/Twitter.
- Matches and competitions metadata.
- Dynamic match metadata from real match/team/competition data.
- Dynamic competition and team metadata.

## Structured Data

Server-rendered JSON-LD is used for:

- `Organization`
- `WebSite`
- `SportsEvent` on match pages, limited to known visible properties.

JSON-LD is serialized with `<` escaped to avoid script injection.

## Remaining Validation

Production validation should still run against the deployed canonical host for status codes, rendered metadata, sitemap URL counts, robots.txt and structured-data validation.

