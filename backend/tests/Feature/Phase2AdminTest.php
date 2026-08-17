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
use Illuminate\Support\Carbon;
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
    $this->deleteJson("/api/v1/admin/matches/{$matchId}", ['confirm_delete' => true])->assertOk();
});

it('requires explicit confirmation for single deletion and supports publication state changes', function (): void {
    Sanctum::actingAs(ownerUser());
    $match = GameMatch::factory()->create(['published_at' => null]);

    $this->deleteJson("/api/v1/admin/matches/{$match->id}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('confirm_delete');

    $this->patchJson("/api/v1/admin/matches/{$match->id}/publication", ['published' => true])
        ->assertOk()
        ->assertJsonPath('data.publication.status', 'published');

    $this->deleteJson("/api/v1/admin/matches/{$match->id}", ['confirm_delete' => true])->assertOk();
    expect($match->fresh()->trashed())->toBeTrue();
});

it('keeps featured separate from verification and reports aggregate counters', function (): void {
    Carbon::setTestNow(Carbon::parse('2026-08-17 12:00:00', 'Africa/Casablanca'));
    Sanctum::actingAs(ownerUser());

    $today = GameMatch::factory()->create(['kickoff_at' => Carbon::parse('2026-08-17 13:00:00', 'Africa/Casablanca')->utc()]);
    $live = GameMatch::factory()->create(['kickoff_at' => Carbon::parse('2026-08-17 11:00:00', 'Africa/Casablanca')->utc(), 'status' => MatchStatus::Live]);
    $upcoming = GameMatch::factory()->create(['kickoff_at' => Carbon::parse('2026-08-20 13:00:00', 'Africa/Casablanca')->utc()]);
    $finished = GameMatch::factory()->create(['kickoff_at' => Carbon::parse('2026-08-10 13:00:00', 'Africa/Casablanca')->utc(), 'status' => MatchStatus::Finished]);
    $pending = GameMatch::factory()->create(['kickoff_at' => Carbon::parse('2026-08-17 15:00:00', 'Africa/Casablanca')->utc(), 'verification_status' => 'pending_verification']);
    $featured = GameMatch::factory()->create(['featured' => true, 'kickoff_at' => Carbon::parse('2026-09-20 13:00:00', 'Africa/Casablanca')->utc()]);
    $today->channels()->attach(Channel::factory()->create()->id);

    $counters = $this->getJson('/api/v1/admin/matches?per_page=50')->assertOk()->json('admin_meta.counters');

    expect($counters['today'])->toBe(3)
        ->and($counters['live'])->toBe(1)
        ->and($counters['upcoming'])->toBe(3)
        ->and($counters['finished'])->toBe(1)
        ->and($counters['needs_channel'])->toBe(4)
        ->and($counters['needs_verification'])->toBe(1)
        ->and($counters['featured'])->toBe(1)
        ->and($today->featured)->toBeFalse()
        ->and($live->featured)->toBeFalse()
        ->and($upcoming->featured)->toBeFalse()
        ->and($finished->featured)->toBeFalse()
        ->and($pending->featured)->toBeFalse()
        ->and($featured->featured)->toBeTrue();

    Carbon::setTestNow();
});

it('applies bulk verification and status changes without implicit feature changes', function (): void {
    Sanctum::actingAs(ownerUser());
    $matches = GameMatch::factory()->count(2)->create(['verification_status' => 'pending_verification', 'featured' => false]);

    $this->postJson('/api/v1/admin/matches/bulk', ['ids' => $matches->pluck('id')->all(), 'action' => 'verify'])
        ->assertOk()
        ->assertJsonPath('data.updated', 2);

    expect(GameMatch::query()->whereIn('id', $matches->pluck('id'))->where('verification_status', 'manual_verified')->count())->toBe(2);

    $this->postJson('/api/v1/admin/matches/bulk', ['ids' => $matches->pluck('id')->all(), 'action' => 'set_status', 'status' => 'postponed'])
        ->assertOk();

    expect(GameMatch::query()->whereIn('id', $matches->pluck('id'))->where('status', MatchStatus::Postponed)->count())->toBe(2);
});

it('requires explicit confirmation before bulk archiving matches', function (): void {
    Sanctum::actingAs(ownerUser());
    $matches = GameMatch::factory()->count(2)->create();

    $this->postJson('/api/v1/admin/matches/bulk', [
        'ids' => $matches->pluck('id')->all(),
        'action' => 'delete',
    ])->assertUnprocessable()->assertJsonValidationErrors('confirm_delete');

    expect(GameMatch::withTrashed()->whereIn('id', $matches->pluck('id'))->whereNull('deleted_at')->count())->toBe(2);

    $this->postJson('/api/v1/admin/matches/bulk', [
        'ids' => $matches->pluck('id')->all(),
        'action' => 'delete',
        'confirm_delete' => true,
    ])->assertOk()->assertJsonPath('data.updated', 2);

    expect(GameMatch::withTrashed()->whereIn('id', $matches->pluck('id'))->whereNotNull('deleted_at')->count())->toBe(2);
});

it('persists a manual feature choice across future fixture syncs', function (): void {
    Sanctum::actingAs(ownerUser());
    $match = GameMatch::factory()->create(['featured' => false, 'manual_overrides' => null]);

    $this->patchJson("/api/v1/admin/matches/{$match->id}/control/feature", ['featured' => true])
        ->assertOk()
        ->assertJsonPath('data.match.featured', true);

    expect($match->fresh()->hasManualOverride('featured'))->toBeTrue();
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
