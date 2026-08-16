<?php

namespace App\Services;

use App\Enums\CompetitionSelectionMode;
use App\Enums\MatchStatus;
use App\Enums\MatchVisibility;
use App\Models\Broadcaster;
use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\MatchBroadcast;
use App\Models\Season;
use App\Models\Team;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OfficialFixtureImportService
{
    public function __construct(private readonly FootballProductionAuditService $productionAudit) {}

    /** @var array<string, array{name:string,short_name:string,country_code:?string,logo_path:string,sort_order:int,selection_mode:CompetitionSelectionMode}> */
    private array $competitions = [
        'premier-league' => [
            'name' => 'Premier League',
            'short_name' => 'PL',
            'country_code' => 'GB',
            'logo_path' => '/football/competitions/premier-league.png',
            'sort_order' => 10,
            'selection_mode' => CompetitionSelectionMode::FeaturedTeamsOnly,
        ],
        'laliga-ea-sports' => [
            'name' => 'LALIGA EA SPORTS',
            'short_name' => 'LALIGA',
            'country_code' => 'ES',
            'logo_path' => '/football/competitions/laliga.png',
            'sort_order' => 20,
            'selection_mode' => CompetitionSelectionMode::FeaturedTeamsOnly,
        ],
        'ligue-1' => [
            'name' => 'Ligue 1',
            'short_name' => 'L1',
            'country_code' => 'FR',
            'logo_path' => '/football/competitions/ligue-1.png',
            'sort_order' => 30,
            'selection_mode' => CompetitionSelectionMode::FeaturedTeamsOnly,
        ],
        'uefa-champions-league' => [
            'name' => 'UEFA Champions League',
            'short_name' => 'UCL',
            'country_code' => null,
            'logo_path' => '/football/competitions/champions-league.png',
            'sort_order' => 40,
            'selection_mode' => CompetitionSelectionMode::ManualOnly,
        ],
    ];

    /** @var array<string, list<string>> */
    private array $selectedTeamSlugs = [
        'premier-league' => ['arsenal', 'chelsea', 'liverpool', 'manchester-city', 'manchester-united', 'tottenham-hotspur'],
        'laliga-ea-sports' => ['fc-barcelona', 'real-madrid', 'atletico-de-madrid'],
        'ligue-1' => ['paris-saint-germain'],
    ];

    /** @var array<string, list<string>> */
    private array $aliases = [
        'manchester-united' => ['Man United', 'Man Utd', 'MUFC'],
        'manchester-city' => ['Man City', 'MCFC'],
        'tottenham-hotspur' => ['Spurs', 'Tottenham'],
        'afc-bournemouth' => ['Bournemouth'],
        'brighton-hove-albion' => ['Brighton'],
        'nottingham-forest' => ['Forest'],
        'leeds-united' => ['Leeds'],
        'coventry-city' => ['Coventry'],
        'fc-barcelona' => ['Barcelona', 'Barca'],
        'real-madrid' => ['Madrid'],
        'atletico-de-madrid' => ['Atletico Madrid', 'Atleti'],
        'athletic-club' => ['Athletic Bilbao'],
        'rcd-espanyol-de-barcelona' => ['Espanyol'],
        'r-racing-club' => ['Racing Santander'],
        'rc-celta' => ['Celta Vigo'],
        'rc-deportivo' => ['Deportivo La Coruna'],
        'ca-osasuna' => ['Osasuna'],
        'paris-saint-germain' => ['PSG', 'Paris SG', 'Paris'],
    ];

    /** @var array<string, string> */
    private array $providerMap = [
        'premier-league' => 'official-premier-league',
        'laliga-ea-sports' => 'official-laliga',
        'ligue-1' => 'official-psg',
    ];

    /** @var array<string, int> */
    private array $expectedCounts = [
        'premier-league' => 198,
        'laliga-ea-sports' => 108,
        'ligue-1' => 34,
    ];

    /** @return array{competitions:int,seasons:int,teams:int,matches:int,broadcasts:int,dry_run:bool} */
    public function import(string $seasonSlug = '2026-27', ?string $competitionSlug = null, bool $dryRun = false): array
    {
        $datasets = $this->datasets($seasonSlug)
            ->when($competitionSlug, fn (Collection $items): Collection => $items->filter(fn (array $dataset): bool => $dataset['competition']['slug'] === $competitionSlug))
            ->values();

        $summary = [
            'competitions' => 0,
            'seasons' => 0,
            'teams' => $datasets
                ->flatMap(fn (array $dataset): array => collect($dataset['fixtures'])->flatMap(fn (array $fixture): array => [$fixture['home_team'], $fixture['away_team']])->all())
                ->map(fn (string $name): string => $this->slug($name))
                ->unique()
                ->count(),
            'matches' => 0,
            'broadcasts' => 0,
            'dry_run' => $dryRun,
        ];

        DB::transaction(function () use ($datasets, &$summary, $dryRun): void {
            $this->ensureAllCompetitions();

            $selectedExternalIds = $datasets
                ->flatMap(fn (array $dataset): array => collect($dataset['fixtures'])->pluck('external_id')->all())
                ->all();

            if ($selectedExternalIds !== []) {
                GameMatch::query()
                    ->whereIn('provider', array_values($this->providerMap))
                    ->whereNotIn('external_id', $selectedExternalIds)
                    ->delete();
            }

            foreach ($datasets as $dataset) {
                $competition = $this->competition($dataset['competition']);
                $season = $this->season($competition, $dataset);
                $broadcaster = $this->menaBroadcaster();
                $featuredTeamIds = [];

                foreach ($dataset['fixtures'] as $fixture) {
                    $home = $this->team($fixture['home_team'], $dataset['competition']['country_code']);
                    $away = $this->team($fixture['away_team'], $dataset['competition']['country_code']);
                    $featured = $this->isFeaturedFixture($competition->slug, $home->name, $away->name);

                    if ($featured) {
                        $featuredTeamIds[$home->id] = ['sort_order' => count($featuredTeamIds) + 1];
                        $featuredTeamIds[$away->id] = ['sort_order' => count($featuredTeamIds) + 1];
                    }

                    $match = $this->match($competition, $season, $home, $away, $fixture, $featured);
                    $this->broadcast($match, $broadcaster, $fixture);

                    $summary['matches']++;
                    $summary['broadcasts']++;
                }

                $competition->featuredTeams()->sync($featuredTeamIds);
                $summary['competitions']++;
                $summary['seasons']++;
            }

            if ($dryRun) {
                throw new DryRunRollback($summary);
            }
        });

        return $summary;
    }

    /** @return array<string, mixed> */
    public function verify(string $seasonSlug = '2026-27'): array
    {
        return $this->productionAudit->fixtureVerificationReport($seasonSlug);
    }

    /** @return Collection<int, array{competition:array<string, mixed>,season:string,fixtures:list<array<string, mixed>>}> */
    private function datasets(string $seasonSlug): Collection
    {
        $root = database_path("data/{$seasonSlug}");
        $files = [
            'premier-league-rifitv.json' => 'premier-league',
            'laliga-rifitv.json' => 'laliga-ea-sports',
            'ligue1-psg.json' => 'ligue-1',
        ];

        return collect($files)
            ->map(function (string $slug, string $file) use ($root): array {
                $payload = json_decode(file_get_contents("{$root}/{$file}"), true, flags: JSON_THROW_ON_ERROR);
                $competition = $this->competitions[$slug];
                $competition['slug'] = $slug;
                $competition['source_url'] = (string) ($payload['source'] ?? data_get($payload, 'fixtures.0.source_reference', ''));

                $payload['competition'] = $competition;

                return $payload;
            })
            ->values();
    }

    private function ensureAllCompetitions(): void
    {
        foreach (array_keys($this->competitions) as $slug) {
            $data = $this->competitions[$slug];
            $data['slug'] = $slug;
            $this->competition($data);
        }
    }

    /** @param array<string, mixed> $data */
    private function competition(array $data): Competition
    {
        $competition = Competition::withTrashed()->firstOrNew(['slug' => $data['slug']]);
        $competition->forceFill([
            'name' => $data['name'],
            'short_name' => $data['short_name'],
            'logo_path' => $data['logo_path'],
            'country_code' => $data['country_code'],
            'active' => true,
            'featured' => true,
            'selection_mode' => $data['selection_mode'],
            'sort_order' => $data['sort_order'],
            'deleted_at' => null,
        ])->save();

        return $competition;
    }

    /** @param array<string, mixed> $dataset */
    private function season(Competition $competition, array $dataset): Season
    {
        return Season::query()->updateOrCreate(
            ['competition_id' => $competition->id, 'slug' => $dataset['season']],
            [
                'name' => $dataset['season'],
                'starts_at' => collect($dataset['fixtures'])->min('scheduled_date'),
                'ends_at' => collect($dataset['fixtures'])->max('scheduled_date'),
                'active' => true,
                'source_url' => $dataset['competition']['source_url'],
                'verified_at' => now(),
            ]
        );
    }

    private function menaBroadcaster(): Broadcaster
    {
        return Broadcaster::query()->updateOrCreate(
            ['slug' => 'bein-sports-mena'],
            ['name' => 'beIN SPORTS MENA', 'territory' => 'MENA', 'active' => true]
        );
    }

    private function team(string $name, ?string $countryCode): Team
    {
        $slug = $this->slug($name);

        $team = Team::withTrashed()->firstOrNew(['slug' => $slug]);
        $team->forceFill([
            'name' => $name,
            'short_name' => $this->shortName($name),
            'logo_path' => "/football/clubs/{$slug}.png",
            'country_code' => $countryCode,
            'active' => true,
            'featured' => in_array($slug, $this->featuredTeamSlugs(), true),
            'aliases' => $this->aliases[$slug] ?? [],
            'deleted_at' => null,
        ])->save();

        return $team;
    }

    /** @param array<string, mixed> $fixture */
    private function match(Competition $competition, Season $season, Team $home, Team $away, array $fixture, bool $featured): GameMatch
    {
        $precision = $this->kickoffPrecision((string) ($fixture['kickoff_status'] ?? 'tbc'));
        $kickoffAt = null;
        $kickoffLocal = $fixture['kickoff_local'] ?? null;

        if ($precision === 'confirmed' && filled($kickoffLocal)) {
            $kickoffAt = Carbon::createFromFormat(
                'Y-m-d H:i',
                $fixture['scheduled_date'].' '.$kickoffLocal,
                $fixture['source_timezone'] ?? 'UTC',
            )->utc();
        }

        $match = GameMatch::withTrashed()->firstOrNew(['provider' => $fixture['provider'], 'external_id' => $fixture['external_id']]);
        $match->fill([
            'competition_id' => $competition->id,
            'season_id' => $season->id,
            'provider' => $fixture['provider'],
            'external_id' => $fixture['external_id'],
            'source_provider' => $fixture['provider'],
            'source_external_id' => $fixture['external_id'],
            'home_team_id' => $home->id,
            'away_team_id' => $away->id,
            'kickoff_at' => $kickoffAt,
            'scheduled_date' => $fixture['scheduled_date'],
            'kickoff_precision' => $precision,
            'kickoff_status' => $fixture['kickoff_status'] ?? $precision,
            'source_timezone' => $fixture['source_timezone'] ?? null,
            'source_matchday' => $fixture['matchday'] ?? null,
            'source_round_label' => $fixture['round_label'] ?? null,
            'source_reference' => $fixture['source_reference'] ?? null,
            'source_verified_at' => null,
            'source_hash' => $this->productionAudit->sourceHash($fixture),
            'verification_status' => 'pending_verification',
            'status' => MatchStatus::Scheduled,
            'home_score' => null,
            'away_score' => null,
            'minute' => null,
            'featured' => $featured,
            'published_at' => $featured ? now() : null,
            'visibility' => $featured ? MatchVisibility::Public : MatchVisibility::Internal,
            'seo_title' => "{$home->name} vs {$away->name} - {$competition->name}",
            'seo_description' => "{$home->name} vs {$away->name} {$competition->name} fixture information on RiFiTV.",
            'slug' => Str::slug(Str::ascii("{$home->name} vs {$away->name} {$competition->slug} {$season->slug} {$fixture['external_id']}")),
            'sync_status' => 'imported',
            'last_synced_at' => now(),
        ]);
        $match->forceFill(['deleted_at' => null]);
        $match->save();

        return $match;
    }

    /** @param array<string, mixed> $fixture */
    private function broadcast(GameMatch $match, Broadcaster $broadcaster, array $fixture): MatchBroadcast
    {
        return MatchBroadcast::query()->updateOrCreate(
            ['match_id' => $match->id, 'broadcaster_id' => $broadcaster->id, 'territory' => 'MENA'],
            [
                'channel_id' => null,
                'languages' => ['ar', 'en'],
                'assignment_status' => (string) data_get($fixture, 'broadcast.status', 'network_confirmed'),
                'source_reference' => $fixture['source_reference'] ?? null,
                'verified_at' => now(),
            ]
        );
    }

    private function isFeaturedFixture(string $competitionSlug, string $home, string $away): bool
    {
        $selected = $this->selectedTeamSlugs[$competitionSlug] ?? [];
        $teams = [$this->slug($home), $this->slug($away)];

        return count(array_intersect($teams, $selected)) > 0;
    }

    /** @return list<string> */
    private function featuredTeamSlugs(): array
    {
        return array_merge(...array_values($this->selectedTeamSlugs));
    }

    private function shortName(string $name): string
    {
        return match ($this->slug($name)) {
            'manchester-united' => 'Man Utd',
            'manchester-city' => 'Man City',
            'tottenham-hotspur' => 'Spurs',
            'brighton-hove-albion' => 'Brighton',
            'nottingham-forest' => 'Forest',
            'fc-barcelona' => 'Barcelona',
            'atletico-de-madrid' => 'Atletico',
            'rcd-espanyol-de-barcelona' => 'Espanyol',
            'paris-saint-germain' => 'PSG',
            default => $name,
        };
    }

    private function kickoffPrecision(string $status): string
    {
        return match ($status) {
            'confirmed' => 'confirmed',
            'provisional' => 'provisional',
            default => 'tbc',
        };
    }

    private function slug(string $value): string
    {
        return Str::slug(Str::ascii($value));
    }

    private function localAssetExists(?string $path): bool
    {
        if (! $path || ! Str::startsWith($path, '/football/')) {
            return false;
        }

        return is_file(base_path('../frontend/public'.str_replace('/', DIRECTORY_SEPARATOR, $path)));
    }
}

class DryRunRollback extends \RuntimeException
{
    /** @param array<string, mixed> $summary */
    public function __construct(public array $summary)
    {
        parent::__construct('Fixture import dry run rolled back.');
    }
}
