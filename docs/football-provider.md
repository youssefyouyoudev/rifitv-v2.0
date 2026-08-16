# Football Provider Integration

Phase 3 introduces a provider layer under `backend/app/Football`.

## Contract

Providers implement `FootballDataProviderInterface`:

- `name()`: stable provider key.
- `getFixtures($from, $to)`: upcoming or scheduled fixtures.
- `getLiveFixtures()`: live in-progress fixtures.
- `getResults($from, $to)`: recent final or changed results.

Provider output is normalized into `ProviderFixture`. The sync services then resolve provider ids through local mapping tables:

- `competition_provider_mappings`
- `team_provider_mappings`

Unmapped fixtures are not imported blindly. They create `fixture_import_logs` rows with `needs_mapping` and open a `mapping_required` operational alert.

## Manual Overrides

Provider sync respects `matches.manual_overrides`:

- `kickoff_at`
- `status`
- `score`
- `featured`

This lets operators correct visible match state without the next provider poll clobbering the change.

## Import Rules

After mapping, fixtures still pass through the Phase 2 competition/team rule service. A fixture can be logged as `ignored` if it does not qualify for the public catalog.

## Adding a Real Provider

Add a provider class in `backend/app/Football/Providers`, bind it in `FootballProviderManager`, and keep API credentials in environment variables. Do not store raw provider payloads, tokens, or stream URLs in import logs.
