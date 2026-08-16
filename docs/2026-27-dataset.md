# 2026/27 Production Dataset

The production fixture dataset lives in `backend/database/data/2026-27`.

## Files

- `premier-league-rifitv.json`: 198 Premier League fixtures involving Arsenal, Chelsea, Liverpool, Manchester City, Manchester United, or Tottenham Hotspur.
- `laliga-rifitv.json`: 108 LALIGA EA SPORTS fixtures involving FC Barcelona, Real Madrid, or Atletico de Madrid.
- `ligue1-psg.json`: 34 Ligue 1 fixtures involving Paris Saint-Germain.
- `sources.json`: retrieval timestamp, source URLs, record counts, and checksums.

Total seeded fixture count: 340.

## Sources

- Premier League official fixtures article: `https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season`
- LALIGA official calendar: `https://www.laliga.com/en-GB/laliga-easports/calendar`
- LALIGA official calendar JSON: `https://assets.laliga.com/assets/calendar/calendar-102-1.json`
- PSG official fixtures page: `https://www.psg.fr/en/mens-football/fixtures`
- PSG official fixtures API: `https://api.psg.fr/umbraco/delivery/api/v2/content?take=80&filter=contentType:matchSheet&filter=matchSeason:2026-2027&filter=matchTeam:2b3mar72yy8d6uvat1ka6tn3r&filter=matchCompetition:dm5ka0os1e3dxcp3vh05kmp33&sort=matchDate:asc`

## Import Rules

Run `php artisan db:seed --class=ProductionSeason2026Seeder` to import the production dataset. The importer creates Premier League, LALIGA EA SPORTS, Ligue 1, and UEFA Champions League competitions. UEFA Champions League is seeded as a competition only, with no invented fixtures.

Fixtures keep null scores, scheduled status, official source references, local team logos, and null broadcast channels until a specific channel is confirmed.
