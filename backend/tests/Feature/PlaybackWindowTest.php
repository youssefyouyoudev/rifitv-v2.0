<?php

use App\Enums\MatchStatus;
use App\Enums\StreamHealth;
use App\Models\Channel;
use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\StreamSource;
use App\Models\Team;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

function windowedMatch(array $overrides = []): GameMatch
{
    $competition = Competition::factory()->create(['name' => 'Premier League']);
    $home = Team::factory()->create(['name' => 'Arsenal']);
    $away = Team::factory()->create(['name' => 'Liverpool']);
    $channel = Channel::factory()->create();

    $match = GameMatch::factory()->create(array_merge([
        'competition_id' => $competition->id,
        'home_team_id' => $home->id,
        'away_team_id' => $away->id,
        'slug' => 'windowed-match',
        'kickoff_at' => Carbon::parse('2026-08-14 20:00:00', 'UTC'),
        'scheduled_date' => '2026-08-14',
        'kickoff_precision' => 'confirmed',
        'status' => MatchStatus::Scheduled,
        'published_at' => Carbon::parse('2026-08-14 10:00:00', 'UTC'),
        'visibility' => 'public',
    ], $overrides));

    $match->channels()->attach($channel->id);
    StreamSource::factory()->create([
        'channel_id' => $channel->id,
        'url' => 'https://example.test/private.m3u8',
        'last_known_status' => StreamHealth::Healthy,
    ]);

    return $match->fresh(['channels.streamSources']);
}

it('keeps sources locked until exactly ten minutes before kickoff', function (): void {
    windowedMatch();

    Carbon::setTestNow('2026-08-14 19:49:59');
    $this->getJson('/api/v1/matches/windowed-match/playback')
        ->assertOk()
        ->assertJsonPath('data.status', 'opening_soon')
        ->assertJsonCount(0, 'data.sources');

    Carbon::setTestNow('2026-08-14 19:50:00');
    $response = $this->getJson('/api/v1/matches/windowed-match/playback')
        ->assertOk()
        ->assertJsonPath('data.status', 'open')
        ->assertJsonPath('data.sources.0.transport', 'gateway');

    expect($response->getContent())->not->toContain('https://example.test/private.m3u8');
});

it('closes two hours after actual start and hides sources', function (): void {
    windowedMatch(['actual_started_at' => Carbon::parse('2026-08-14 20:05:00', 'UTC')]);

    Carbon::setTestNow('2026-08-14 22:04:59');
    $this->getJson('/api/v1/matches/windowed-match/playback')
        ->assertOk()
        ->assertJsonPath('data.status', 'open');

    Carbon::setTestNow('2026-08-14 22:05:00');
    $this->getJson('/api/v1/matches/windowed-match/playback')
        ->assertOk()
        ->assertJsonPath('data.status', 'ended')
        ->assertJsonCount(0, 'data.sources');
});

it('does not create a window for tbc kickoff times', function (): void {
    windowedMatch(['kickoff_at' => null, 'kickoff_precision' => 'tbc']);

    Carbon::setTestNow('2026-08-14 19:55:00');
    $this->getJson('/api/v1/matches/windowed-match/playback')
        ->assertOk()
        ->assertJsonPath('data.status', 'tbc')
        ->assertJsonCount(0, 'data.sources');
});

it('honors admin playback extension overrides', function (): void {
    windowedMatch([
        'actual_started_at' => Carbon::parse('2026-08-14 20:05:00', 'UTC'),
        'playback_close_override_at' => Carbon::parse('2026-08-14 22:35:00', 'UTC'),
    ]);

    Carbon::setTestNow('2026-08-14 22:20:00');
    $this->getJson('/api/v1/matches/windowed-match/playback')
        ->assertOk()
        ->assertJsonPath('data.status', 'open')
        ->assertJsonPath('data.playback_closes_at', '2026-08-14T22:35:00+00:00');
});

it('returns only local today matches on the homepage', function (): void {
    Carbon::setTestNow('2026-08-14 12:00:00');
    $today = windowedMatch(['slug' => 'today-match']);
    GameMatch::factory()->create([
        'competition_id' => $today->competition_id,
        'home_team_id' => $today->home_team_id,
        'away_team_id' => $today->away_team_id,
        'slug' => 'future-match',
        'kickoff_at' => Carbon::parse('2026-08-16 20:00:00', 'UTC'),
        'scheduled_date' => '2026-08-16',
        'published_at' => now(),
        'visibility' => 'public',
    ]);

    $this->getJson('/api/v1/home')
        ->assertOk()
        ->assertJsonPath('data.date', '2026-08-14')
        ->assertJsonPath('data.matches.0.slug', 'today-match')
        ->assertJsonMissingPath('data.matches.1');
});
