<?php

use App\Models\Channel;
use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\StreamSource;
use App\Models\Team;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('connects matches to competition teams channels and sources', function (): void {
    $competition = Competition::factory()->create();
    $home = Team::factory()->create();
    $away = Team::factory()->create();
    $channel = Channel::factory()->create();
    StreamSource::factory()->create(['channel_id' => $channel->id]);

    $match = GameMatch::factory()->create([
        'competition_id' => $competition->id,
        'home_team_id' => $home->id,
        'away_team_id' => $away->id,
    ]);
    $match->channels()->attach($channel->id);

    $match->load(['competition', 'homeTeam', 'awayTeam', 'channels.streamSources']);

    expect($match->competition->is($competition))->toBeTrue()
        ->and($match->homeTeam->is($home))->toBeTrue()
        ->and($match->awayTeam->is($away))->toBeTrue()
        ->and($match->channels->first()->streamSources)->toHaveCount(1);
});
