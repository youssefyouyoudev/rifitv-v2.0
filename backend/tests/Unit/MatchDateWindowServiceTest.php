<?php

use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\Team;
use App\Services\MatchDateWindowService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

afterEach(function (): void {
    Carbon::setTestNow();
});

it('uses the Casablanca football day boundary consistently', function (): void {
    $window = app(MatchDateWindowService::class);

    Carbon::setTestNow(Carbon::parse('2026-08-17 04:59:59', 'UTC'));
    expect($window->today())->toBe('2026-08-16');

    Carbon::setTestNow(Carbon::parse('2026-08-17 05:00:00', 'UTC'));
    expect($window->today())->toBe('2026-08-17');

    $bounds = $window->bounds('2026-08-17');
    expect($bounds['start']->setTimezone('Africa/Casablanca')->format('Y-m-d H:i:s'))->toBe('2026-08-17 06:00:00')
        ->and($bounds['end']->setTimezone('Africa/Casablanca')->format('Y-m-d H:i:s'))->toBe('2026-08-18 05:59:59');
});

it('groups kickoff timestamps around the football day boundary', function (): void {
    $competition = Competition::factory()->create();
    $home = Team::factory()->create();
    $away = Team::factory()->create();
    $beforeBoundary = GameMatch::factory()->create([
        'competition_id' => $competition->id,
        'home_team_id' => $home->id,
        'away_team_id' => $away->id,
        'kickoff_at' => Carbon::parse('2026-08-17 04:59:59', 'UTC'),
    ]);
    $afterBoundary = GameMatch::factory()->create([
        'competition_id' => $competition->id,
        'home_team_id' => $home->id,
        'away_team_id' => $away->id,
        'kickoff_at' => Carbon::parse('2026-08-17 05:00:00', 'UTC'),
    ]);

    expect(GameMatch::query()->onLocalDate('2026-08-16')->pluck('id')->all())->toContain($beforeBoundary->id)
        ->not->toContain($afterBoundary->id)
        ->and(GameMatch::query()->onLocalDate('2026-08-17')->pluck('id')->all())->toContain($afterBoundary->id)
        ->not->toContain($beforeBoundary->id);
});
