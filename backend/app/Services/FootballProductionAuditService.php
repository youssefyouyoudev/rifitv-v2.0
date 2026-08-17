<?php

namespace App\Services;

use App\Enums\CompetitionSelectionMode;
use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\Team;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FootballProductionAuditService
{
    /** @var array<string, int> */
    private array $expectedCounts = [
        'premier-league' => 198,
        'laliga-ea-sports' => 108,
        'ligue-1' => 34,
    ];

    /** @var list<array{competition:string,home:string,away:string,date:string,source:string}> */
    private array $officialAnchors = [
        ['competition' => 'premier-league', 'home' => 'Arsenal', 'away' => 'Coventry City', 'date' => '2026-08-21', 'source' => 'premierleague.com'],
        ['competition' => 'premier-league', 'home' => 'Hull City', 'away' => 'Manchester United', 'date' => '2026-08-22', 'source' => 'premierleague.com'],
        ['competition' => 'premier-league', 'home' => 'Brentford', 'away' => 'Tottenham Hotspur', 'date' => '2026-08-22', 'source' => 'premierleague.com'],
        ['competition' => 'premier-league', 'home' => 'Manchester City', 'away' => 'AFC Bournemouth', 'date' => '2026-08-23', 'source' => 'premierleague.com'],
        ['competition' => 'premier-league', 'home' => 'Newcastle United', 'away' => 'Liverpool', 'date' => '2026-08-23', 'source' => 'premierleague.com'],
        ['competition' => 'laliga-ea-sports', 'home' => 'Atletico de Madrid', 'away' => 'Malaga CF', 'date' => '2026-08-19', 'source' => 'laliga.com'],
        ['competition' => 'laliga-ea-sports', 'home' => 'Atletico de Madrid', 'away' => 'Villarreal CF', 'date' => '2026-08-23', 'source' => 'laliga.com'],
        ['competition' => 'ligue-1', 'home' => 'Paris Saint-Germain', 'away' => 'Stade Rennais', 'date' => '2026-08-23', 'source' => 'psg.fr'],
        ['competition' => 'ligue-1', 'home' => 'LOSC Lille', 'away' => 'Paris Saint-Germain', 'date' => '2026-08-28', 'source' => 'psg.fr'],
    ];

    /** @var list<array{competition:string,home:string,away:string,date:string,reason:string}> */
    private array $staleFixtures = [
        ['competition' => 'laliga-ea-sports', 'home' => 'Atletico de Madrid', 'away' => 'Malaga CF', 'date' => '2026-08-16', 'reason' => 'Official LALIGA page lists this fixture on 2026-08-19.'],
        ['competition' => 'laliga-ea-sports', 'home' => 'FC Barcelona', 'away' => 'Athletic Club', 'date' => '2026-08-16', 'reason' => 'This row was present in the stale snapshot and was not preserved by current source checks.'],
        ['competition' => 'laliga-ea-sports', 'home' => 'Real Madrid', 'away' => 'Real Sociedad', 'date' => '2026-08-16', 'reason' => 'This row was present in the stale snapshot and was not preserved by current source checks.'],
    ];

    /** @return array<string, mixed> */
    public function backup(string $reason = 'football-production-hardening'): array
    {
        $tables = [
            'competitions',
            'seasons',
            'teams',
            'matches',
            'match_channels',
            'match_broadcasts',
            'broadcasters',
            'featured_teams',
        ];

        $payload = [
            'reason' => $reason,
            'created_at' => now()->toIso8601String(),
            'database' => collect($tables)->mapWithKeys(fn (string $table): array => [
                $table => [
                    'count' => DB::table($table)->count(),
                    'rows' => DB::table($table)->get()->map(fn (object $row): array => (array) $row)->all(),
                ],
            ])->all(),
            'assets' => $this->logoManifest(),
            'environment' => [
                'app_env' => app()->environment(),
                'football_provider' => config('services.football.provider'),
                'display_timezone' => config('rifitv.display_timezone'),
            ],
        ];

        $path = 'backups/'.$reason.'-'.now()->format('Ymd-His').'.json';
        Storage::disk('local')->put($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

        return [
            'path' => storage_path('app/private/'.$path),
            'tables' => collect($payload['database'])->map(fn (array $table): int => $table['count'])->all(),
        ];
    }

    /** @return array<string, mixed> */
    public function purgeDemoFootballRows(bool $force = false): array
    {
        if (! $force) {
            return ['purged' => false, 'reason' => 'Use --force after creating a backup.'];
        }

        $matches = GameMatch::query()
            ->where(fn ($query) => $query
                ->where('provider', 'mock')
                ->orWhere('source_provider', 'manual-demo-seed')
                ->orWhere('sync_status', 'seeded')
                ->orWhere('slug', 'like', '%-ucl'))
            ->get();

        $matchIds = $matches->pluck('id')->all();
        $channelLinks = $matchIds === [] ? 0 : DB::table('match_channels')->whereIn('match_id', $matchIds)->delete();
        $broadcasts = $matchIds === [] ? 0 : DB::table('match_broadcasts')->whereIn('match_id', $matchIds)->delete();

        foreach ($matches as $match) {
            $match->delete();
        }

        $this->ensureProductionCompetitionShells();
        $retiredTeams = Team::query()
            ->whereDoesntHave('homeMatches')
            ->whereDoesntHave('awayMatches')
            ->where('active', true)
            ->update(['active' => false, 'featured' => false]);
        $retiredCompetitions = Competition::query()
            ->whereDoesntHave('matches')
            ->whereNotIn('slug', ['premier-league', 'laliga-ea-sports', 'ligue-1', 'uefa-champions-league'])
            ->where('active', true)
            ->update(['active' => false, 'featured' => false]);

        return [
            'purged' => true,
            'matches' => $matches->count(),
            'match_channels' => $channelLinks,
            'match_broadcasts' => $broadcasts,
            'retired_unused_teams' => $retiredTeams,
            'retired_unused_competitions' => $retiredCompetitions,
            'match_ids' => $matchIds,
        ];
    }

    /** @return array<string, mixed> */
    public function report(string $seasonSlug = '2026-27'): array
    {
        $matches = GameMatch::query()->with(['competition', 'season', 'homeTeam', 'awayTeam', 'broadcasts'])->get();
        $logoReport = $this->logoVerificationReport();
        $fixtureReport = $this->fixtureVerificationReport($seasonSlug);

        $futureMatchesWithScores = $matches
            ->filter(fn (GameMatch $match): bool => $this->isFutureFixture($match) && ($match->home_score !== null || $match->away_score !== null))
            ->map(fn (GameMatch $match): string => $this->fixtureLabel($match))
            ->values()
            ->all();

        $fakeRows = $matches
            ->filter(fn (GameMatch $match): bool => $this->looksFake($match))
            ->map(fn (GameMatch $match): string => $this->fixtureLabel($match))
            ->values()
            ->all();

        $unverifiedPublic = $matches
            ->filter(fn (GameMatch $match): bool => $match->published_at !== null
                && ($match->visibility?->value ?? $match->visibility) === 'public'
                && ! in_array((string) $match->verification_status, ['verified', 'manual_verified'], true))
            ->map(fn (GameMatch $match): string => $this->fixtureLabel($match))
            ->values()
            ->all();

        $missingProvenance = $matches
            ->filter(function (GameMatch $match): bool {
                $isManual = in_array($match->source_provider, ['manual', 'manual-admin', 'manual-copy'], true);

                return ! $isManual && (blank($match->source_provider)
                    || blank($match->source_external_id)
                    || blank($match->source_reference)
                    || blank($match->source_hash));
            })
            ->map(fn (GameMatch $match): string => $this->fixtureLabel($match))
            ->values()
            ->all();

        $duplicateGroups = $this->duplicateGroups($matches);

        $failures = collect([
            ...$fixtureReport['failures'],
            ...$logoReport['failures'],
            ...($futureMatchesWithScores === [] ? [] : ['Future fixtures have scores: '.implode('; ', array_slice($futureMatchesWithScores, 0, 8))]),
            ...($fakeRows === [] ? [] : ['Fake/demo-looking football rows found: '.implode('; ', array_slice($fakeRows, 0, 8))]),
            ...($unverifiedPublic === [] ? [] : ['Public matches are not verified: '.implode('; ', array_slice($unverifiedPublic, 0, 8))]),
            ...($missingProvenance === [] ? [] : ['Matches missing provenance fields: '.implode('; ', array_slice($missingProvenance, 0, 8))]),
            ...($duplicateGroups === [] ? [] : ['Duplicate fixture identities found: '.implode('; ', array_slice($duplicateGroups, 0, 8))]),
        ])->values()->all();

        return [
            'generated_at' => now()->toIso8601String(),
            'season' => $seasonSlug,
            'ok' => $failures === [],
            'failures' => $failures,
            'counts' => [
                'competitions' => Competition::query()->count(),
                'seasons' => DB::table('seasons')->count(),
                'teams' => Team::query()->count(),
                'matches' => $matches->count(),
                'match_channels' => DB::table('match_channels')->count(),
                'match_broadcasts' => DB::table('match_broadcasts')->count(),
                'public_verified_matches' => GameMatch::query()->published()->count(),
                'unverified_public_matches' => count($unverifiedPublic),
                'future_matches_with_scores' => count($futureMatchesWithScores),
                'missing_provenance_matches' => count($missingProvenance),
            ],
            'fixtures' => $fixtureReport,
            'logos' => $logoReport,
            'fake_rows' => $fakeRows,
            'duplicate_groups' => $duplicateGroups,
        ];
    }

    /** @return array<string, mixed> */
    public function fixtureVerificationReport(string $seasonSlug = '2026-27'): array
    {
        $failures = [];
        $competitionReports = [];

        foreach ($this->expectedCounts as $competitionSlug => $expectedCount) {
            $competition = Competition::query()->where('slug', $competitionSlug)->first();
            $season = $competition ? DB::table('seasons')->where('competition_id', $competition->id)->where('slug', $seasonSlug)->first() : null;
            $matches = $season ? GameMatch::query()->where('season_id', $season->id)->with(['homeTeam', 'awayTeam', 'broadcasts'])->get() : collect();
            $verified = $matches->whereIn('verification_status', ['verified', 'manual_verified'])->count();
            $sourceReady = $matches->filter(fn (GameMatch $match): bool => filled($match->source_provider)
                && filled($match->source_external_id)
                && filled($match->source_reference)
                && filled($match->source_hash))->count();

            $competitionReports[$competitionSlug] = [
                'fixtures' => $matches->count(),
                'expected_fixtures' => $expectedCount,
                'verified_or_manual_verified' => $verified,
                'source_ready' => $sourceReady,
                'future_scores_are_null' => $matches->every(fn (GameMatch $match): bool => $match->home_score === null && $match->away_score === null),
            ];

            if ($matches->count() !== $expectedCount) {
                $failures[] = "{$competitionSlug} has {$matches->count()} fixtures, expected {$expectedCount}.";
            }

            if ($verified !== $matches->count()) {
                $pending = $matches->count() - $verified;
                $failures[] = "{$competitionSlug} has {$pending} fixtures pending verification.";
            }

            if ($sourceReady !== $matches->count()) {
                $missingSources = $matches->count() - $sourceReady;
                $failures[] = "{$competitionSlug} has {$missingSources} fixtures missing source provenance.";
            }
        }

        $ucl = Competition::query()->where('slug', 'uefa-champions-league')->first();
        $uclFixtures = $ucl ? GameMatch::query()->where('competition_id', $ucl->id)->count() : 0;
        if ($uclFixtures > 0) {
            $failures[] = "UEFA Champions League has {$uclFixtures} fixtures before the 2026-08-27 draw.";
        }

        $anchorResults = collect($this->officialAnchors)->map(function (array $anchor) use (&$failures): array {
            $match = $this->findFixture($anchor['competition'], $anchor['home'], $anchor['away']);
            $ok = $match !== null
                && $match->scheduled_date?->toDateString() === $anchor['date']
                && Str::contains((string) $match->source_reference, $anchor['source']);

            if (! $ok) {
                $actual = $match ? $match->scheduled_date?->toDateString().' '.$this->fixtureLabel($match) : 'missing';
                $failures[] = "Official anchor mismatch: {$anchor['home']} vs {$anchor['away']} expected {$anchor['date']} ({$anchor['source']}), actual {$actual}.";
            }

            return [
                ...$anchor,
                'actual_date' => $match?->scheduled_date?->toDateString(),
                'actual_source_reference' => $match?->source_reference,
                'ok' => $ok,
            ];
        })->all();

        $staleResults = collect($this->staleFixtures)->map(function (array $fixture) use (&$failures): array {
            $match = $this->findFixture($fixture['competition'], $fixture['home'], $fixture['away'], $fixture['date']);
            $ok = $match === null;

            if (! $ok) {
                $failures[] = "Stale fixture still present: {$fixture['home']} vs {$fixture['away']} on {$fixture['date']}.";
            }

            return [...$fixture, 'ok' => $ok];
        })->all();

        return [
            'ok' => $failures === [],
            'failures' => $failures,
            'competitions' => $competitionReports,
            'uefa_champions_league' => [
                'fixtures' => $uclFixtures,
                'expected_fixtures_before_draw' => 0,
            ],
            'official_anchors' => $anchorResults,
            'stale_rejections' => $staleResults,
        ];
    }

    /** @return array<string, mixed> */
    public function logoVerificationReport(): array
    {
        $failures = [];
        $manifest = $this->logoManifest();
        $manifestPaths = collect($manifest['assets'] ?? [])->pluck('local_path')->filter()->values();
        $referencedTeamIds = GameMatch::query()
            ->select('home_team_id', 'away_team_id')
            ->get()
            ->flatMap(fn (GameMatch $match): array => [$match->home_team_id, $match->away_team_id])
            ->filter()
            ->unique()
            ->values();
        $referencedCompetitionIds = GameMatch::query()->pluck('competition_id')->filter()->unique()->values();

        $teamsMissingLogoPath = Team::query()
            ->whereIn('id', $referencedTeamIds)
            ->whereNull('logo_path')
            ->pluck('slug')
            ->all();

        $competitionsMissingLogoPath = Competition::query()
            ->where(fn ($query) => $query->whereIn('id', $referencedCompetitionIds)->orWhere('featured', true))
            ->whereNull('logo_path')
            ->pluck('slug')
            ->all();

        $referenced = Competition::query()->whereNotNull('logo_path')->pluck('logo_path')
            ->merge(Team::query()->whereNotNull('logo_path')->pluck('logo_path'))
            ->unique()
            ->values();

        $missing = $referenced
            ->reject(fn (string $path): bool => $this->localAssetExists($path))
            ->values()
            ->all();

        $notInManifest = $referenced
            ->reject(fn (string $path): bool => $manifestPaths->contains($path))
            ->values()
            ->all();

        if (! is_file($this->publicPath('/football/logo-manifest.json'))) {
            $failures[] = 'Missing frontend/public/football/logo-manifest.json.';
        }

        if ($teamsMissingLogoPath !== []) {
            $failures[] = 'Referenced teams missing logo_path: '.implode(', ', array_slice($teamsMissingLogoPath, 0, 12));
        }

        if ($competitionsMissingLogoPath !== []) {
            $failures[] = 'Referenced or featured competitions missing logo_path: '.implode(', ', array_slice($competitionsMissingLogoPath, 0, 12));
        }

        if ($missing !== []) {
            $failures[] = 'Missing referenced football logo files: '.implode(', ', array_slice($missing, 0, 12));
        }

        if ($notInManifest !== []) {
            $failures[] = 'Referenced logo paths not present in logo manifest: '.implode(', ', array_slice($notInManifest, 0, 12));
        }

        return [
            'ok' => $failures === [],
            'failures' => $failures,
            'manifest_assets' => $manifestPaths->count(),
            'referenced_assets' => $referenced->count(),
            'teams_missing_logo_path' => $teamsMissingLogoPath,
            'competitions_missing_logo_path' => $competitionsMissingLogoPath,
            'missing_assets' => $missing,
            'not_in_manifest' => $notInManifest,
        ];
    }

    /** @param array<string, mixed> $fixture */
    public function sourceHash(array $fixture): string
    {
        $parts = [
            Str::slug(Str::ascii((string) ($fixture['competition'] ?? ''))),
            Str::slug(Str::ascii((string) ($fixture['home_team'] ?? ''))),
            Str::slug(Str::ascii((string) ($fixture['away_team'] ?? ''))),
            (string) ($fixture['scheduled_date'] ?? ''),
            (string) ($fixture['kickoff_local'] ?? ''),
            (string) ($fixture['source_timezone'] ?? ''),
            (string) ($fixture['source_reference'] ?? ''),
        ];

        return hash('sha256', implode('|', $parts));
    }

    /** @param array<string, mixed> $report */
    public function writeMarkdownReport(array $report): string
    {
        $path = base_path('../docs/production-football-audit.md');
        $lines = [
            '# RiFiTV Production Football Audit',
            '',
            '- Generated at: '.$report['generated_at'],
            '- Season: '.$report['season'],
            '- Result: '.($report['ok'] ? 'PASS' : 'FAIL'),
            '',
            '## Counts',
            '',
            '| Metric | Value |',
            '| --- | ---: |',
        ];

        foreach ($report['counts'] as $metric => $value) {
            $lines[] = '| '.$metric.' | '.$value.' |';
        }

        $lines[] = '';
        $lines[] = '## Fixture Verification';
        $lines[] = '';
        $lines[] = '| Competition | Fixtures | Expected | Verified | Source Ready |';
        $lines[] = '| --- | ---: | ---: | ---: | ---: |';

        foreach ($report['fixtures']['competitions'] as $slug => $item) {
            $lines[] = '| '.$slug.' | '.$item['fixtures'].' | '.$item['expected_fixtures'].' | '.$item['verified_or_manual_verified'].' | '.$item['source_ready'].' |';
        }

        $lines[] = '| uefa-champions-league | '.$report['fixtures']['uefa_champions_league']['fixtures'].' | 0 | n/a | n/a |';
        $lines[] = '';
        $lines[] = '## Logo Verification';
        $lines[] = '';
        $lines[] = '- Manifest assets: '.$report['logos']['manifest_assets'];
        $lines[] = '- Referenced assets: '.$report['logos']['referenced_assets'];
        $lines[] = '- Teams missing logo path: '.count($report['logos']['teams_missing_logo_path']);
        $lines[] = '- Competitions missing logo path: '.count($report['logos']['competitions_missing_logo_path']);
        $lines[] = '- Missing assets: '.count($report['logos']['missing_assets']);
        $lines[] = '- Not in manifest: '.count($report['logos']['not_in_manifest']);
        $lines[] = '';
        $lines[] = '## Failures';
        $lines[] = '';

        if ($report['failures'] === []) {
            $lines[] = '- None';
        } else {
            foreach ($report['failures'] as $failure) {
                $lines[] = '- '.$failure;
            }
        }

        file_put_contents($path, implode(PHP_EOL, $lines).PHP_EOL);

        return $path;
    }

    private function findFixture(string $competitionSlug, string $home, string $away, ?string $date = null): ?GameMatch
    {
        return GameMatch::query()
            ->whereHas('competition', fn ($query) => $query->where('slug', $competitionSlug))
            ->whereHas('homeTeam', fn ($query) => $query->where('slug', Str::slug(Str::ascii($home))))
            ->whereHas('awayTeam', fn ($query) => $query->where('slug', Str::slug(Str::ascii($away))))
            ->when($date, fn ($query) => $query->whereDate('scheduled_date', $date))
            ->with(['competition', 'homeTeam', 'awayTeam'])
            ->first();
    }

    private function ensureProductionCompetitionShells(): void
    {
        foreach ([
            'premier-league' => ['name' => 'Premier League', 'short_name' => 'PL', 'country_code' => 'GB', 'logo_path' => '/football/competitions/premier-league.png', 'sort_order' => 10, 'selection_mode' => CompetitionSelectionMode::FeaturedTeamsOnly],
            'laliga-ea-sports' => ['name' => 'LALIGA EA SPORTS', 'short_name' => 'LALIGA', 'country_code' => 'ES', 'logo_path' => '/football/competitions/laliga.png', 'sort_order' => 20, 'selection_mode' => CompetitionSelectionMode::FeaturedTeamsOnly],
            'ligue-1' => ['name' => 'Ligue 1', 'short_name' => 'L1', 'country_code' => 'FR', 'logo_path' => '/football/competitions/ligue-1.png', 'sort_order' => 30, 'selection_mode' => CompetitionSelectionMode::FeaturedTeamsOnly],
            'uefa-champions-league' => ['name' => 'UEFA Champions League', 'short_name' => 'UCL', 'country_code' => null, 'logo_path' => '/football/competitions/champions-league.png', 'sort_order' => 40, 'selection_mode' => CompetitionSelectionMode::ManualOnly],
        ] as $slug => $data) {
            Competition::query()->updateOrCreate(['slug' => $slug], [
                ...$data,
                'active' => true,
                'featured' => true,
            ]);
        }
    }

    private function isFutureFixture(GameMatch $match): bool
    {
        $date = $match->kickoff_at ?: ($match->scheduled_date ? Carbon::parse($match->scheduled_date, 'UTC') : null);

        return $date !== null && $date->isFuture();
    }

    private function looksFake(GameMatch $match): bool
    {
        $haystack = Str::lower(implode(' ', [
            $match->provider,
            $match->external_id,
            $match->homeTeam?->name,
            $match->awayTeam?->name,
            $match->competition?->name,
            $match->slug,
        ]));

        return Str::contains($haystack, ['fake', 'sample', 'placeholder', 'test fc', 'team a', 'team b'])
            || $match->provider === 'mock';
    }

    private function fixtureLabel(GameMatch $match): string
    {
        return '#'.$match->id.' '.($match->competition?->slug ?? 'no-competition').': '.($match->homeTeam?->name ?? 'no-home').' vs '.($match->awayTeam?->name ?? 'no-away').' ('.$match->scheduled_date?->toDateString().')';
    }

    /** @param Collection<int, GameMatch> $matches */
    private function duplicateGroups(Collection $matches): array
    {
        return $matches
            ->groupBy(fn (GameMatch $match): string => implode('|', [
                $match->competition_id,
                $match->home_team_id,
                $match->away_team_id,
                $match->scheduled_date?->toDateString(),
                $match->source_provider,
                $match->source_external_id,
            ]))
            ->filter(fn (Collection $group): bool => $group->count() > 1)
            ->map(fn (Collection $group): string => $group->map(fn (GameMatch $match): string => $this->fixtureLabel($match))->implode('; '))
            ->values()
            ->all();
    }

    /** @return array<string, mixed> */
    private function logoManifest(): array
    {
        $path = $this->publicPath('/football/logo-manifest.json');

        if (! is_file($path)) {
            return ['assets' => []];
        }

        return json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
    }

    private function localAssetExists(?string $path): bool
    {
        return is_string($path)
            && Str::startsWith($path, '/football/')
            && is_file($this->publicPath($path));
    }

    private function publicPath(string $path): string
    {
        return base_path('../frontend/public'.str_replace('/', DIRECTORY_SEPARATOR, $path));
    }
}
