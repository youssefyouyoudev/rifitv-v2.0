<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

it('allows an admin to login and persist a session across requests', function (): void {
    User::factory()->admin()->create([
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
});

it('logs out by invalidating the server session', function (): void {
    User::factory()->admin()->create([
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

it('rejects non-admin login and protects admin routes', function (): void {
    $user = User::factory()->create([
        'email' => 'user@example.com',
        'password' => 'secret-password',
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'user@example.com',
        'password' => 'secret-password',
    ])->assertUnprocessable();

    $this->getJson('/api/v1/admin/dashboard')->assertUnauthorized();

    Sanctum::actingAs($user);
    $this->getJson('/api/v1/admin/dashboard')->assertForbidden();
});

it('validates login input', function (): void {
    $this->postJson('/api/v1/auth/login', [])->assertJsonValidationErrors(['email', 'password']);
});
