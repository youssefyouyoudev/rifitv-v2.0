<?php

use App\Models\AuditLog;
use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\Role;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function phase4Owner(): User
{
    $role = Role::query()->create(['name' => 'Owner', 'slug' => 'owner', 'permissions' => ['*']]);
    $user = User::factory()->admin()->create(['password' => Hash::make('correct-password')]);
    $user->roles()->attach($role);

    return $user->fresh('roles');
}

it('returns minimal public health and protected detailed health', function (): void {
    $this->getJson('/api/health')->assertOk()->assertExactJson(['status' => 'ok']);
    $this->getJson('/api/v1/admin/health')->assertUnauthorized();

    Sanctum::actingAs(phase4Owner());
    $this->getJson('/api/v1/admin/health')->assertOk()->assertJsonStructure(['data' => ['application', 'database', 'cache', 'queue']]);
});

it('searches only public active content', function (): void {
    $competition = Competition::factory()->create(['name' => 'Premier League', 'active' => true]);
    $home = Team::factory()->create(['name' => 'Arsenal', 'active' => true]);
    $away = Team::factory()->create(['name' => 'Liverpool', 'active' => true]);
    GameMatch::factory()->create(['competition_id' => $competition->id, 'home_team_id' => $home->id, 'away_team_id' => $away->id, 'published_at' => now()]);
    GameMatch::factory()->create(['competition_id' => $competition->id, 'home_team_id' => $home->id, 'away_team_id' => $away->id, 'published_at' => null]);

    $this->getJson('/api/v1/search?q=Arsenal')
        ->assertOk()
        ->assertJsonCount(1, 'data.matches')
        ->assertJsonPath('data.teams.0.name', 'Arsenal');
});

it('rejects svg logo uploads', function (): void {
    Storage::fake('public');
    Sanctum::actingAs(phase4Owner());

    $this->postJson('/api/v1/admin/uploads/logo', [
        'folder' => 'teams',
        'logo' => UploadedFile::fake()->create('logo.svg', 12, 'image/svg+xml'),
    ])->assertUnprocessable();
});

it('audits login success and generic login failure', function (): void {
    $user = phase4Owner();

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'wrong-password'])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'The given data was invalid.');

    $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'correct-password'])->assertOk();

    expect(AuditLog::query()->where('action', 'auth.login_failed')->exists())->toBeTrue()
        ->and(AuditLog::query()->where('action', 'auth.login_success')->exists())->toBeTrue();
});
