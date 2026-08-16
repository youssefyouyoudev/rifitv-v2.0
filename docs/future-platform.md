# Future Platform

RiFiTV should remain football-first until the current product is stable. Future expansion should reuse proven foundations without forcing all media types into one oversized model.

## Direction

```text
RiFiTV
|-- Sports
|   |-- Football
|   `-- Future sports
|-- Movies
|-- Series
`-- Anime
```

## Reusable Components

- Playback UI primitives and provider-neutral analytics.
- Stream/source health concepts, with separate live/VOD behavior where needed.
- Admin RBAC, audit logs, uploads, settings, operations dashboard.
- SEO, sitemap, deployment, monitoring, backup, and CI foundations.

## Keep Separate

Live sports and VOD should not be forced into identical workflows. Future VOD can introduce:

```text
media_titles
movies
series
seasons
episodes
genres
media_genres
video_sources
watch_progress
```

Document and design these before adding migrations. Do not expose Movies, Series or Anime navigation until real functionality exists.

## League Expansion

Adding Serie A, Bundesliga, Ligue 1, MLS or Saudi Pro League should use admin-created competitions, provider mappings, and featured-team rules. It should not require source-code changes.
