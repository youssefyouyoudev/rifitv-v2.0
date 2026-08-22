<?php

use App\Models\Broadcaster;
use App\Models\Channel;
use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\Role;
use App\Models\Season;
use App\Models\Team;
use App\Models\User;
use App\Services\OfficialFixtureImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

it('imports 2026-27 fixture snapshots as verified provenance data', function (): void {
    $this->artisan('rifitv:fixtures:import 2026-27')->assertExitCode(0);
    $this->artisan('rifitv:fixtures:verify 2026-27')->assertExitCode(0);

    $providers = ['official-premier-league', 'official-laliga', 'official-psg', 'official-bundesliga', 'official-german-super-cup'];

    expect(GameMatch::query()->whereIn('provider', $providers)->count())->toBe(343)
        ->and(GameMatch::query()->where('verification_status', 'verified')->count())->toBe(343)
        ->and(GameMatch::query()->whereIn('provider', $providers)->where('featured', true)->count())->toBe(0)
        ->and(GameMatch::query()->whereNull('source_verified_at')->exists())->toBeFalse()
        ->and(GameMatch::query()->whereNull('source_provider')->exists())->toBeFalse()
        ->and(GameMatch::query()->whereNull('source_external_id')->exists())->toBeFalse()
        ->and(GameMatch::query()->whereNull('source_reference')->exists())->toBeFalse()
        ->and(GameMatch::query()->whereNull('source_hash')->exists())->toBeFalse()
        ->and(Broadcaster::query()->where('slug', 'bein-sports-mena')->exists())->toBeTrue()
        ->and(Broadcaster::query()->where('slug', 'mbc-action')->exists())->toBeTrue()
        ->and(Channel::query()->where('slug', 'mbc-action')->where('metadata->broadcaster_only', true)->exists())->toBeTrue()
        ->and(Competition::query()->where('slug', 'uefa-champions-league')->exists())->toBeTrue()
        ->and(Competition::query()->where('slug', 'dfb-pokal')->exists())->toBeTrue()
        ->and(GameMatch::query()->whereHas('competition', fn ($query) => $query->where('slug', 'uefa-champions-league'))->count())->toBe(0);

    $report = app(OfficialFixtureImportService::class)->verify('2026-27');
    expect($report['ok'])->toBeTrue()
        ->and($report['failures'])->toBeEmpty();

    foreach (['premier-league' => 198, 'laliga-ea-sports' => 108, 'ligue-1' => 34, 'bundesliga' => 2, 'german-super-cup' => 1] as $competitionSlug => $expectedCount) {
        $season = Season::query()->whereHas('competition', fn ($query) => $query->where('slug', $competitionSlug))->firstOrFail();
        $matches = GameMatch::query()->where('season_id', $season->id)->with(['homeTeam', 'awayTeam', 'broadcasts'])->get();
        $status = in_array($competitionSlug, ['ligue-1', 'bundesliga'], true) ? 'tbc' : 'network_confirmed';

        expect($matches)->toHaveCount($expectedCount)
            ->and($matches->whereNull('home_score')->whereNull('away_score'))->toHaveCount($expectedCount)
            ->and($matches->every(fn (GameMatch $match): bool => $match->broadcasts->where('assignment_status', $status)->count() === 1))->toBeTrue()
            ->and($matches->every(fn (GameMatch $match): bool => $match->broadcasts->every(fn ($broadcast): bool => $broadcast->channel_id === null)))->toBeTrue();
    }
});

it('imports only the RiFiTV club scope and seeds local logos', function (): void {
    $this->artisan('rifitv:fixtures:import 2026-27')->assertExitCode(0);

    $selected = [
        'official-premier-league' => ['arsenal', 'chelsea', 'liverpool', 'manchester-city', 'manchester-united', 'tottenham-hotspur'],
        'official-laliga' => ['fc-barcelona', 'real-madrid', 'atletico-de-madrid'],
        'official-psg' => ['paris-saint-germain'],
        'official-bundesliga' => ['bayern-munich', 'borussia-dortmund', 'vfb-stuttgart', 'hamburger-sv'],
        'official-german-super-cup' => ['bayern-munich', 'borussia-dortmund'],
    ];

    foreach ($selected as $provider => $teamSlugs) {
        $matches = GameMatch::query()->where('provider', $provider)->with(['competition', 'homeTeam', 'awayTeam'])->get();

        expect($matches->every(fn (GameMatch $match): bool => in_array($match->homeTeam->slug, $teamSlugs, true) || in_array($match->awayTeam->slug, $teamSlugs, true)))->toBeTrue()
            ->and($matches->pluck('external_id')->duplicates())->toBeEmpty()
            ->and($matches->every(fn (GameMatch $match): bool => $match->home_team_id !== $match->away_team_id))->toBeTrue()
            ->and($matches->every(fn (GameMatch $match): bool => nullableFootballAssetExists($match->competition->logo_path)))->toBeTrue()
            ->and($matches->every(fn (GameMatch $match): bool => nullableFootballAssetExists($match->homeTeam->logo_path) && nullableFootballAssetExists($match->awayTeam->logo_path)))->toBeTrue();

        foreach ($teamSlugs as $teamSlug) {
            $expectedLogo = localFootballAssetExists('/football/clubs/'.$teamSlug.'.png') ? '/football/clubs/'.$teamSlug.'.png' : null;
            expect(Team::query()->where('slug', $teamSlug)->where('logo_path', $expectedLogo)->exists())->toBeTrue();
        }
    }

    expect(GameMatch::query()
        ->whereHas('homeTeam', fn ($query) => $query->where('name', 'Everton'))
        ->whereHas('awayTeam', fn ($query) => $query->where('name', 'Fulham'))
        ->exists())->toBeFalse();
});

it('preserves fixture precision without fake kickoff times and accepts corrected official anchors', function (): void {
    $this->artisan('rifitv:fixtures:import 2026-27')->assertExitCode(0);

    $arsenalCoventry = GameMatch::query()
        ->where('provider', 'official-premier-league')
        ->whereHas('homeTeam', fn ($query) => $query->where('name', 'Arsenal'))
        ->whereHas('awayTeam', fn ($query) => $query->where('name', 'Coventry City'))
        ->firstOrFail();

    expect($arsenalCoventry->kickoff_precision)->toBe('confirmed')
        ->and($arsenalCoventry->kickoff_at?->toIso8601String())->toBe('2026-08-21T19:00:00+00:00');

    $atleticoMalaga = GameMatch::query()
        ->where('provider', 'official-laliga')
        ->whereHas('homeTeam', fn ($query) => $query->where('slug', 'atletico-de-madrid'))
        ->whereHas('awayTeam', fn ($query) => $query->where('name', 'Málaga CF'))
        ->firstOrFail();

    expect($atleticoMalaga->kickoff_precision)->toBe('confirmed')
        ->and($atleticoMalaga->kickoff_at?->toIso8601String())->toBe('2026-08-19T19:00:00+00:00')
        ->and($atleticoMalaga->scheduled_date?->toDateString())->toBe('2026-08-19');

    $supercup = GameMatch::query()->where('provider', 'official-german-super-cup')->firstOrFail();
    expect($supercup->kickoff_precision)->toBe('confirmed')
        ->and($supercup->kickoff_at?->toIso8601String())->toBe('2026-08-22T18:30:00+00:00');

    $verification = app(OfficialFixtureImportService::class)->verify('2026-27');
    expect(GameMatch::query()->where('kickoff_precision', '!=', 'confirmed')->whereNotNull('kickoff_at')->exists())->toBeFalse()
        ->and($verification['ok'])->toBeTrue()
        ->and(collect($verification['stale_rejections'])->firstWhere('home', 'Atletico de Madrid')['ok'])->toBeTrue();
});

it('keeps pending imported fixtures out of the public API until manual verification', function (): void {
    $this->artisan('rifitv:fixtures:import 2026-27')->assertExitCode(0);

    $match = GameMatch::query()->firstOrFail();
    $match->forceFill(['verification_status' => 'pending_verification', 'source_verified_at' => null, 'published_at' => now()])->save();
    $hiddenPayload = $this->getJson('/api/v1/matches?per_page=50')->assertOk()->json('data');
    expect(collect($hiddenPayload)->pluck('id')->contains($match->id))->toBeFalse();

    $match->forceFill(['verification_status' => 'manual_verified', 'source_verified_at' => now()])->save();

    $this->getJson('/api/v1/matches?per_page=50')
        ->assertOk()
        ->assertJsonFragment(['verification_status' => 'manual_verified']);
});

it('does not overwrite admin kickoff overrides during official fixture import', function (): void {
    $this->artisan('rifitv:fixtures:import 2026-27')->assertExitCode(0);
    $match = GameMatch::query()->where('provider', 'official-german-super-cup')->firstOrFail();
    $manualKickoff = now()->addYear()->startOfMinute();
    $match->forceFill([
        'kickoff_at' => $manualKickoff,
        'scheduled_date' => $manualKickoff->toDateString(),
        'manual_overrides' => ['kickoff_at' => true],
    ])->save();

    $this->artisan('rifitv:fixtures:import 2026-27')->assertExitCode(0);

    expect($match->fresh()->kickoff_at->timestamp)->toBe($manualKickoff->timestamp);
});

it('supports team aliases for public search', function (): void {
    $this->artisan('rifitv:fixtures:import 2026-27')->assertExitCode(0);

    $bayern = Team::query()->where('slug', 'bayern-munich')->firstOrFail();

    expect(Team::query()->where('slug', 'fc-barcelona')->where('aliases', 'like', '%Barca%')->exists())->toBeTrue()
        ->and(Team::query()->where('slug', 'manchester-united')->where('aliases', 'like', '%Man Utd%')->exists())->toBeTrue()
        ->and(Team::query()->where('slug', 'paris-saint-germain')->where('aliases', 'like', '%PSG%')->exists())->toBeTrue()
        ->and(collect($bayern->aliases)->contains('بايرن'))->toBeTrue();

    $this->getJson('/api/v1/search?q=Barca')
        ->assertOk()
        ->assertJsonPath('data.teams.0.name', 'FC Barcelona');

    $this->getJson('/api/v1/search?q=MBC')
        ->assertOk()
        ->assertJsonPath('data.channels.0.name', 'MBC Action');
});

it('resets football data while preserving auth records', function (): void {
    $role = Role::query()->create(['name' => 'Owner', 'slug' => 'owner', 'permissions' => ['*']]);
    $user = User::factory()->create(['email' => 'owner@rifitv.test']);
    $user->roles()->attach($role->id);

    $this->artisan('rifitv:fixtures:import 2026-27')->assertExitCode(0);

    $this->artisan('rifitv:reset-season-data 2026-27 --dry-run --force')->assertExitCode(0);
    expect(GameMatch::query()->count())->toBe(343)
        ->and(User::query()->where('email', 'owner@rifitv.test')->exists())->toBeTrue();

    $this->artisan('rifitv:reset-season-data 2026-27 --force')->assertExitCode(0);

    expect(GameMatch::query()->count())->toBe(0)
        ->and(Competition::query()->count())->toBe(0)
        ->and(User::query()->where('email', 'owner@rifitv.test')->exists())->toBeTrue()
        ->and(Role::query()->where('slug', 'owner')->exists())->toBeTrue()
        ->and($user->fresh()->roles()->where('slug', 'owner')->exists())->toBeTrue();
});

function localFootballAssetExists(?string $path): bool
{
    return is_string($path)
        && Str::startsWith($path, '/football/')
        && is_file(base_path('../frontend/public'.str_replace('/', DIRECTORY_SEPARATOR, $path)));
}

function nullableFootballAssetExists(?string $path): bool
{
    return $path === null || localFootballAssetExists($path);
}
