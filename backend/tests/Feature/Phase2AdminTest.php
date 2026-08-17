<?php

use App\Enums\MatchStatus;
use App\Enums\StreamProtocol;
use App\Models\AuditLog;
use App\Models\Channel;
use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\Role;
use App\Models\Team;
use App\Models\User;
use App\Services\CompetitionRuleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function ownerUser(): User
{
    $role = Role::query()->create(['name' => 'Owner', 'slug' => 'owner', 'permissions' => ['*']]);
    $user = User::factory()->admin()->create();
    $user->roles()->attach($role);

    return $user->fresh('roles');
}

it('enforces admin permissions', function (): void {
    $role = Role::query()->create(['name' => 'Stream Manager', 'slug' => 'stream-manager', 'permissions' => ['streams.manage']]);
    $user = User::factory()->admin()->create();
    $user->roles()->attach($role);
    Sanctum::actingAs($user->fresh('roles'));

    $this->getJson('/api/v1/admin/channels')->assertOk();
    $this->postJson('/api/v1/admin/matches', [])->assertForbidden();
});

it('creates publishes duplicates archives and audits a match', function (): void {
    Sanctum::actingAs(ownerUser());
    $competition = Competition::factory()->create();
    $home = Team::factory()->create(['name' => 'Arsenal']);
    $away = Team::factory()->create(['name' => 'Liverpool']);
    $channel = Channel::factory()->create();

    $matchId = $this->postJson('/api/v1/admin/matches', [
        'competition_id' => $competition->id,
        'home_team_id' => $home->id,
        'away_team_id' => $away->id,
        'kickoff_at' => now()->addHour()->toIso8601String(),
        'featured' => true,
        'published' => true,
        'channel_ids' => [$channel->id],
    ])->assertOk()->json('data.id');

    $this->assertDatabaseHas('matches', ['id' => $matchId, 'featured' => true]);
    $this->getJson('/api/v1/matches?per_page=50')->assertJsonFragment(['id' => $matchId]);
    expect(AuditLog::query()->where('action', 'match.created')->exists())->toBeTrue();

    $this->postJson("/api/v1/admin/matches/{$matchId}/duplicate")->assertOk()->assertJsonPath('data.status', 'scheduled');
    $this->deleteJson("/api/v1/admin/matches/{$matchId}")->assertOk();
});

it('updates live score and prevents invalid status transitions without override', function (): void {
    Sanctum::actingAs(ownerUser());
    $match = GameMatch::factory()->create(['status' => MatchStatus::Scheduled]);

    $this->patchJson("/api/v1/admin/matches/{$match->id}/live-control", [
        'home_score' => 1,
        'away_score' => 0,
        'minute' => 12,
        'status' => 'finished',
    ])->assertUnprocessable();

    $this->patchJson("/api/v1/admin/matches/{$match->id}/live-control", [
        'home_score' => 1,
        'away_score' => 0,
        'minute' => 12,
        'status' => 'live',
    ])->assertOk()->assertJsonPath('data.home_score', 1)->assertJsonPath('data.status', 'live');
});

it('manages teams competitions channels sources homepage and audit logs', function (): void {
    Sanctum::actingAs(ownerUser());
    $teamId = $this->postJson('/api/v1/admin/teams', ['name' => 'Barcelona', 'short_name' => 'BAR', 'active' => true, 'featured' => true])
        ->assertCreated()
        ->json('data.id');

    $competitionId = $this->postJson('/api/v1/admin/competitions', [
        'name' => 'La Liga',
        'short_name' => 'LALIGA',
        'active' => true,
        'featured' => true,
        'selection_mode' => 'featured_teams_only',
        'featured_team_ids' => [$teamId],
    ])->assertCreated()->json('data.id');

    $channelId = $this->postJson('/api/v1/admin/channels', ['name' => 'beIN Sports 1', 'active' => true])
        ->assertCreated()
        ->json('data.id');

    $sourceId = $this->postJson('/api/v1/admin/stream-sources', [
        'channel_id' => $channelId,
        'name' => 'Main HD',
        'protocol' => StreamProtocol::Hls->value,
        'url' => 'http://localhost:65534/missing.m3u8',
        'priority' => 10,
        'enabled' => true,
    ])->assertCreated()->json('data.id');

    $this->postJson("/api/v1/admin/stream-sources/{$sourceId}/test")->assertOk()->assertJsonStructure(['data' => ['result', 'health_status', 'latency_ms']]);
    $this->putJson('/api/v1/admin/homepage', ['sections' => [[
        'key' => 'la_liga',
        'title' => 'La Liga',
        'type' => 'competition',
        'enabled' => true,
        'sort_order' => 10,
        'limit' => 8,
        'competition_id' => $competitionId,
    ]]])->assertOk();
    $this->getJson('/api/v1/admin/audit-logs')->assertOk();
});

it('orders featured-team rules correctly', function (): void {
    $competition = Competition::factory()->create(['selection_mode' => 'featured_teams_only']);
    $featured = Team::factory()->create();
    $other = Team::factory()->create();
    $competition->featuredTeams()->attach($featured->id);
    $match = GameMatch::factory()->create([
        'competition_id' => $competition->id,
        'home_team_id' => $featured->id,
        'away_team_id' => $other->id,
    ])->load('competition');

    expect(app(CompetitionRuleService::class)->qualifies($match))->toBeTrue();
});
