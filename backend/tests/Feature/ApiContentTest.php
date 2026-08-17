<?php

use App\Enums\MatchStatus;
use App\Enums\MatchVisibility;
use App\Enums\StreamHealth;
use App\Enums\StreamProtocol;
use App\Models\Channel;
use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\StreamSource;
use App\Models\Team;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function publicApiFixture(string $slug = 'arsenal-vs-chelsea-live'): GameMatch
{
    $competition = Competition::factory()->create([
        'name' => 'Premier League',
        'slug' => 'premier-league',
        'active' => true,
        'featured' => true,
        'sort_order' => 10,
    ]);
    $home = Team::factory()->create(['name' => 'Arsenal', 'slug' => 'arsenal', 'active' => true]);
    $away = Team::factory()->create(['name' => 'Chelsea', 'slug' => 'chelsea', 'active' => true]);

    return GameMatch::factory()->create([
        'competition_id' => $competition->id,
        'home_team_id' => $home->id,
        'away_team_id' => $away->id,
        'slug' => $slug,
        'status' => MatchStatus::Live,
        'kickoff_at' => now()->subMinutes(30),
        'scheduled_date' => today(),
        'published_at' => now(),
        'visibility' => MatchVisibility::Public,
        'verification_status' => 'verified',
        'source_verified_at' => now(),
    ]);
}

it('returns an optimized home payload', function (): void {
    publicApiFixture();

    $this->getJson('/api/v1/home')
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                'server_time',
                'date',
                'timezone',
                'live_count',
                'today_count',
                'matches',
                'next_match',
                'competitions',
            ],
        ]);
});

it('lists and shows matches with relationships', function (): void {
    $slug = 'arsenal-vs-chelsea-live';
    publicApiFixture($slug);

    $this->getJson('/api/v1/matches')
        ->assertOk()
        ->assertJsonPath('data.0.competition.name', 'Premier League');

    $this->getJson("/api/v1/matches/{$slug}")
        ->assertOk()
        ->assertJsonPath('data.slug', $slug)
        ->assertJsonPath('data.home_team.name', 'Arsenal');
});

it('returns deterministic playback source selection', function (): void {
    $competition = Competition::factory()->create();
    $home = Team::factory()->create();
    $away = Team::factory()->create();
    $channel = Channel::factory()->create();
    $match = GameMatch::factory()->create([
        'competition_id' => $competition->id,
        'home_team_id' => $home->id,
        'away_team_id' => $away->id,
        'status' => MatchStatus::Live,
        'slug' => 'test-live-match',
        'kickoff_at' => now()->subMinutes(5),
        'actual_started_at' => now()->subMinutes(5),
    ]);
    $match->channels()->attach($channel->id);

    StreamSource::factory()->create([
        'channel_id' => $channel->id,
        'name' => 'Offline primary',
        'priority' => 1,
        'last_known_status' => StreamHealth::Offline,
    ]);
    StreamSource::factory()->create([
        'channel_id' => $channel->id,
        'name' => 'Backup',
        'priority' => 20,
        'is_backup' => true,
        'last_known_status' => StreamHealth::Healthy,
    ]);
    $primary = StreamSource::factory()->create([
        'channel_id' => $channel->id,
        'name' => 'Primary',
        'priority' => 10,
        'protocol' => StreamProtocol::Hls,
        'last_known_status' => StreamHealth::Healthy,
    ]);

    $this->getJson('/api/v1/matches/test-live-match/playback')
        ->assertOk()
        ->assertJsonPath('data.default_source_id', $primary->id)
        ->assertJsonPath('data.sources.0.name', 'Primary')
        ->assertJsonMissing(['name' => 'Offline primary'])
        ->assertJsonPath('data.sources.0.transport', 'gateway')
        ->assertJsonPath('data.sources.0.playback_url', fn (string $url): bool => str_contains($url, '/media/live/'))
        ->assertJsonPath('data.policy.max_recovery_attempts_per_source', 3);
});

it('returns competitions and competition details', function (): void {
    publicApiFixture();

    $this->getJson('/api/v1/competitions')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Premier League');

    $this->getJson('/api/v1/competitions/premier-league')
        ->assertOk()
        ->assertJsonPath('data.slug', 'premier-league')
        ->assertJsonStructure(['data' => ['matches']]);
});

it('keeps pending imported fixtures private while allowing explicitly published admin fixtures', function (): void {
    $manual = GameMatch::factory()->create([
        'slug' => 'manual-published-match',
        'source_provider' => 'manual-admin',
        'source_external_id' => null,
        'source_verified_at' => null,
        'verification_status' => 'pending_verification',
        'published_at' => now(),
        'visibility' => MatchVisibility::Public,
    ]);
    $imported = GameMatch::factory()->create([
        'slug' => 'pending-imported-match',
        'source_provider' => 'provider-feed',
        'source_external_id' => 'provider-pending-1',
        'verification_status' => 'pending_verification',
        'published_at' => now(),
        'visibility' => MatchVisibility::Public,
    ]);

    $this->getJson('/api/v1/matches?per_page=50')
        ->assertOk()
        ->assertJsonFragment(['slug' => $manual->slug])
        ->assertJsonMissing(['slug' => $imported->slug]);
});
