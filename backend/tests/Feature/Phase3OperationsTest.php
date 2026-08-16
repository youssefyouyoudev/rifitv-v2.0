<?php

use App\Enums\MatchStatus;
use App\Enums\StreamHealth;
use App\Models\Channel;
use App\Models\Competition;
use App\Models\CompetitionProviderMapping;
use App\Models\FixtureImportLog;
use App\Models\GameMatch;
use App\Models\OperationalAlert;
use App\Models\Role;
use App\Models\StreamSource;
use App\Models\Team;
use App\Models\TeamProviderMapping;
use App\Models\User;
use App\Services\FixtureSyncService;
use App\Services\OperationalAlertService;
use App\Services\PlaybackSourceSelector;
use App\Services\ResultSyncService;
use App\Services\StreamHealthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    config(['services.football.provider' => 'mock']);
});

function phase3OwnerUser(): User
{
    $role = Role::query()->create(['name' => 'Owner', 'slug' => 'owner', 'permissions' => ['*']]);
    $user = User::factory()->admin()->create();
    $user->roles()->attach($role);

    return $user->fresh('roles');
}

function phase3ProviderMappings(): array
{
    $premierLeague = Competition::factory()->create(['name' => 'Premier League', 'selection_mode' => 'all_matches']);
    $laLiga = Competition::factory()->create(['name' => 'La Liga', 'selection_mode' => 'all_matches']);

    CompetitionProviderMapping::query()->create(['competition_id' => $premierLeague->id, 'provider' => 'mock', 'external_id' => 'pl', 'external_name' => 'Premier League']);
    CompetitionProviderMapping::query()->create(['competition_id' => $laLiga->id, 'provider' => 'mock', 'external_id' => 'laliga', 'external_name' => 'La Liga']);

    $teams = collect([
        'ars' => Team::factory()->create(['name' => 'Arsenal']),
        'liv' => Team::factory()->create(['name' => 'Liverpool']),
        'rma' => Team::factory()->create(['name' => 'Real Madrid']),
        'atm' => Team::factory()->create(['name' => 'Atletico Madrid']),
        'bar' => Team::factory()->create(['name' => 'Barcelona']),
    ]);

    $teams->each(fn (Team $team, string $externalId): TeamProviderMapping => TeamProviderMapping::query()->create([
        'team_id' => $team->id,
        'provider' => 'mock',
        'external_id' => $externalId,
        'external_name' => $team->name,
    ]));

    return [$premierLeague, $laLiga, $teams];
}

it('syncs provider fixtures idempotently and records mapping decisions', function (): void {
    phase3ProviderMappings();

    $run = app(FixtureSyncService::class)->sync(now()->subDay()->toImmutable(), now()->addDay()->toImmutable());

    expect($run->created_count)->toBe(2)
        ->and($run->failed_count)->toBe(2)
        ->and(GameMatch::query()->where('provider', 'mock')->where('external_id', 'mock-arsenal-liverpool')->count())->toBe(1)
        ->and(FixtureImportLog::query()->where('status', 'needs_mapping')->count())->toBe(2);

    $secondRun = app(FixtureSyncService::class)->sync(now()->subDay()->toImmutable(), now()->addDay()->toImmutable());

    expect($secondRun->created_count)->toBe(0)
        ->and($secondRun->updated_count)->toBe(2)
        ->and(GameMatch::query()->where('provider', 'mock')->where('external_id', 'mock-arsenal-liverpool')->count())->toBe(1);
});

it('preserves manual fixture overrides during provider sync', function (): void {
    [$premierLeague, , $teams] = phase3ProviderMappings();
    $manualKickoff = now()->addYears(2)->startOfSecond();

    GameMatch::factory()->create([
        'competition_id' => $premierLeague->id,
        'provider' => 'mock',
        'external_id' => 'mock-arsenal-liverpool',
        'home_team_id' => $teams['ars']->id,
        'away_team_id' => $teams['liv']->id,
        'kickoff_at' => $manualKickoff,
        'manual_overrides' => ['kickoff_at' => true],
    ]);

    app(FixtureSyncService::class)->sync(now()->subDay()->toImmutable(), now()->addDay()->toImmutable());

    expect(GameMatch::query()->where('external_id', 'mock-arsenal-liverpool')->first()->kickoff_at->timestamp)->toBe($manualKickoff->timestamp);
});

it('syncs live result state without overwriting manual scores', function (): void {
    [, $laLiga, $teams] = phase3ProviderMappings();
    $match = GameMatch::factory()->create([
        'competition_id' => $laLiga->id,
        'provider' => 'mock',
        'external_id' => 'mock-real-atleti-live',
        'home_team_id' => $teams['rma']->id,
        'away_team_id' => $teams['atm']->id,
        'status' => MatchStatus::Scheduled,
        'home_score' => 7,
        'away_score' => 7,
        'manual_overrides' => ['score' => true],
    ]);

    app(ResultSyncService::class)->sync(now()->subDay()->toImmutable(), now()->addDay()->toImmutable());

    $match->refresh();
    expect($match->status)->toBe(MatchStatus::Live)
        ->and($match->home_score)->toBe(7)
        ->and($match->away_score)->toBe(7);
});

it('applies stream health hysteresis and opens recovery alerts', function (): void {
    Http::fake(['example.test/*' => Http::sequence()->push('missing', 500)->push('missing', 500)->push('missing', 500)->push("#EXTM3U\n#EXTINF:8,\nseg.ts", 200)->push("#EXTM3U\n#EXTINF:8,\nseg.ts", 200)]);
    $source = StreamSource::factory()->create(['url' => 'https://example.test/live.m3u8', 'last_known_status' => StreamHealth::Healthy, 'consecutive_failures' => 0, 'consecutive_successes' => 0]);

    $service = app(StreamHealthService::class);
    $service->check($source->refresh());
    $service->check($source->refresh());
    $service->check($source->refresh());

    expect($source->refresh()->last_known_status)->toBe(StreamHealth::Offline)
        ->and(OperationalAlert::query()->where('type', 'stream_offline')->where('status', 'open')->exists())->toBeTrue();

    $service->check($source->refresh());
    $service->check($source->refresh());

    expect($source->refresh()->last_known_status)->toBe(StreamHealth::Healthy)
        ->and(OperationalAlert::query()->where('type', 'stream_offline')->where('status', 'resolved')->exists())->toBeTrue();
});

it('prioritizes healthy playback backups ahead of offline primary sources', function (): void {
    $channel = Channel::factory()->create();
    $match = GameMatch::factory()->create([
        'kickoff_at' => now()->subMinutes(5),
        'actual_started_at' => now()->subMinutes(5),
    ]);
    $match->channels()->attach($channel->id, ['sort_order' => 10]);
    StreamSource::factory()->create(['channel_id' => $channel->id, 'name' => 'Offline primary', 'priority' => 1, 'last_known_status' => StreamHealth::Offline]);
    $healthy = StreamSource::factory()->create(['channel_id' => $channel->id, 'name' => 'Healthy backup', 'priority' => 20, 'is_backup' => true, 'last_known_status' => StreamHealth::Healthy]);

    $response = app(PlaybackSourceSelector::class)->responseFor($match->fresh('channels.streamSources'));

    expect($response['default_source_id'])->toBe($healthy->id)
        ->and($response['sources'][0]['health_score'])->toBe(95);
});

it('dedupes operational alerts and accepts anonymous playback events', function (): void {
    $alerts = app(OperationalAlertService::class);
    $alerts->open('mapping_required', 'same-fixture', 'warning', 'Fixture needs mapping', 'First');
    $alerts->open('mapping_required', 'same-fixture', 'critical', 'Fixture still needs mapping', 'Second');

    expect(OperationalAlert::query()->count())->toBe(1)
        ->and(OperationalAlert::query()->first()->severity)->toBe('critical');

    $match = GameMatch::factory()->create();
    $source = StreamSource::factory()->create();

    $this->postJson('/api/v1/playback/events', [
        'event_type' => 'recovery_failed',
        'match_slug' => $match->slug,
        'source_id' => $source->id,
    ])->assertOk();

    $this->assertDatabaseHas('playback_events', ['match_id' => $match->id, 'stream_source_id' => $source->id, 'event_type' => 'recovery_failed']);
});

it('exposes operations dashboards to admins', function (): void {
    Sanctum::actingAs(phase3OwnerUser());
    phase3ProviderMappings();
    app(FixtureSyncService::class)->sync(now()->subDay()->toImmutable(), now()->addDay()->toImmutable());

    $this->getJson('/api/v1/admin/today')->assertOk()->assertJsonStructure(['data' => ['live', 'starting_soon', 'later_today', 'finished', 'readiness']]);
    $this->getJson('/api/v1/admin/stream-health')->assertOk()->assertJsonStructure(['data']);
    $this->getJson('/api/v1/admin/alerts')->assertOk()->assertJsonStructure(['data']);
    $this->getJson('/api/v1/admin/sync-runs')->assertOk()->assertJsonStructure(['data']);
    $this->getJson('/api/v1/admin/imports/fixtures')->assertOk()->assertJsonStructure(['data']);
    $this->getJson('/api/v1/admin/queue-health')->assertOk()->assertJsonStructure(['data' => ['failed_jobs', 'pending_jobs']]);
});
