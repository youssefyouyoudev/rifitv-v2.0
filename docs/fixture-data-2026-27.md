# 2026/27 Fixture Data

The official full-league fixture snapshots are checked in under `backend/database/fixtures/2026-27`. The importer filters those snapshots to the selected RiFiTV V1 club scope before storing matches.

## Sources

- Premier League: official 2026/27 fixture announcement, `https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season`
- LALIGA EA SPORTS: official calendar page, `https://www.laliga.com/en-GB/laliga-easports/calendar`, backed by the official asset JSON `https://assets.laliga.com/assets/calendar/calendar-102-1.json`

## Import

```bash
php artisan rifitv:fixtures:import 2026-27
php artisan rifitv:fixtures:verify 2026-27
```

The importer is idempotent by `provider` and `external_id`.

It imports only:

- Premier League fixtures involving Arsenal, Chelsea, Liverpool, Manchester City, Manchester United, or Tottenham Hotspur.
- LALIGA EA SPORTS fixtures involving FC Barcelona, Real Madrid, or Atletico Madrid.

Current selected import counts:

- Premier League: 198 fixtures.
- LALIGA EA SPORTS: 108 fixtures.
- Total: 306 fixtures.

## Precision Rules

- `confirmed`: official source provides a kickoff time; stored in UTC in `kickoff_at`.
- `date_only`: official source provides a date without a kickoff time; `kickoff_at` stays null.
- `provisional`: official source provides a matchday date without confirmed individual kickoff time; `kickoff_at` stays null.

No 15:00 or other default kickoff time is invented.
