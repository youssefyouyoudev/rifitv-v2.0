# Football Management

## Visibility

Matches separate these concepts:

- the match exists in admin
- the match qualifies by competition rules
- the match is published
- the match is featured

Public endpoints only expose published public matches.

## Status Flow

Supported statuses:

- scheduled
- live
- halftime
- finished
- postponed
- cancelled

Normal transitions:

```text
scheduled -> live -> halftime -> live -> finished
```

Real-world exceptions can use an explicit override in the live-control API.

## Featured Clubs

Featured clubs are database-driven through `featured_teams`. Initial featured clubs include the requested Premier League and La Liga clubs.

## Competition Rules

`competition_rules` determines whether a fixture should be shown by default.

Modes:

- `all_matches`
- `featured_teams_only`
- `manual_only`

Example: Premier League in `featured_teams_only` mode shows Arsenal vs Brentford if Arsenal is featured, but hides Everton vs Fulham if neither team is featured.

## Results

Final scores live on the `matches` table. There is no duplicated result store, so match page, homepage, team pages, and competition pages read the same source of truth.
