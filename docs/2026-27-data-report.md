# 2026/27 Data Report

Last verified locally with:

```bash
php artisan migrate:fresh --seed
php artisan rifitv:fixtures:import 2026-27
php artisan rifitv:fixtures:verify 2026-27
```

## Results

- Premier League selected-club scope: 198 fixtures, 20 teams represented, 198 MENA broadcast assignments.
- LALIGA EA SPORTS selected-club scope: 108 fixtures, 20 teams represented, 108 MENA broadcast assignments.
- Total imported fixtures: 306.
- Scope guard: every imported match contains at least one selected RiFiTV club.
- Duplicate guard: selected-vs-selected fixtures are stored once.
- Logo guard: selected clubs and competitions have local real-logo assets.
- Future scores: all imported fixtures have null home and away scores.
- Fake kickoff guard: no non-confirmed fixture has a populated `kickoff_at`.

Premier League explicitly timed fixtures are stored as confirmed UTC timestamps. LALIGA matchday dates are stored as provisional because the official JSON does not provide individual kickoff times.
