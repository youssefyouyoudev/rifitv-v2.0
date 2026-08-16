<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function authOwner(array $attributes = []): User
{
    $role = Role::query()->updateOrCreate(['slug' => 'owner'], ['name' => 'Owner', 'permissions' => ['*']]);
    $user = User::factory()->admin()->create($attributes);
    $user->roles()->syncWithoutDetaching([$role->id]);

    return $user->fresh('roles');
}

it('allows an active owner admin to login and persist a session across requests', function (): void {
    authOwner([
        'email' => 'admin@example.com',
        'password' => 'secret-password',
    ]);

    $this->withHeader('Origin', 'http://localhost:3000')->postJson('/api/v1/auth/login', [
        'email' => 'admin@example.com',
        'password' => 'secret-password',
    ])
        ->assertOk()
        ->assertJsonPath('data.user.email', 'admin@example.com')
        ->assertCookie(config('session.cookie'));

    $this->getJson('/api/v1/auth/user')
        ->assertOk()
        ->assertJsonPath('data.email', 'admin@example.com');

    $this->getJson('/api/v1/admin/dashboard')->assertOk();
    $this->getJson('/api/v1/admin/health')->assertOk();
});

it('logs out by invalidating the server session', function (): void {
    authOwner([
        'email' => 'admin@example.com',
        'password' => 'secret-password',
    ]);

    $this->withHeader('Origin', 'http://localhost:3000')->postJson('/api/v1/auth/login', [
        'email' => 'admin@example.com',
        'password' => 'secret-password',
    ])->assertOk();

    $this->withHeader('Origin', 'http://localhost:3000')->postJson('/api/v1/auth/logout')->assertOk();
    $this->withHeader('Origin', 'http://localhost:3000')->getJson('/api/v1/auth/user')->assertUnauthorized();
});

it('returns 401 for guests accessing admin routes', function (): void {
    $this->getJson('/api/v1/auth/user')->assertUnauthorized();
    $this->getJson('/api/v1/admin/dashboard')->assertUnauthorized();
});

it('returns 403 for authenticated non-admin users', function (): void {
    $user = User::factory()->create();

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/admin/dashboard')->assertForbidden();
});

it('returns 403 for inactive admins', function (): void {
    Sanctum::actingAs(authOwner(['active' => false]));

    $this->getJson('/api/v1/admin/dashboard')->assertForbidden();
});

it('returns 403 when an admin lacks route permissions', function (): void {
    $user = User::factory()->admin()->create();

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/admin/health')->assertForbidden();
});

it('rejects non-admin login and protects admin routes', function (): void {
    $user = User::factory()->create([
        'email' => 'user@example.com',
        'password' => 'secret-password',
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'user@example.com',
        'password' => 'secret-password',
    ])->assertUnprocessable();

    Sanctum::actingAs($user);
    $this->getJson('/api/v1/admin/dashboard')->assertForbidden();
});

it('returns validation errors for wrong passwords', function (): void {
    authOwner([
        'email' => 'admin@example.com',
        'password' => 'secret-password',
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'admin@example.com',
        'password' => 'wrong-password',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email'])
        ->assertJsonPath('errors.email.0', 'The provided credentials could not be verified.');
});

it('validates login input', function (): void {
    $this->postJson('/api/v1/auth/login', [])->assertJsonValidationErrors(['email', 'password']);
});
