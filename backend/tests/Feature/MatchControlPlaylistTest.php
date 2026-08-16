<?php

use App\Enums\MatchStatus;
use App\Enums\StreamProtocol;
use App\Models\Channel;
use App\Models\GameMatch;
use App\Models\Role;
use App\Models\StreamSource;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function matchControlOwner(): User
{
    $role = Role::query()->create(['name' => 'Owner', 'slug' => 'match-control-owner', 'permissions' => ['*']]);
    $user = User::factory()->admin()->create();
    $user->roles()->attach($role);

    return $user->fresh('roles');
}

it('keeps match status changes separate from playback exposure', function (): void {
    Sanctum::actingAs(matchControlOwner());
    $match = GameMatch::factory()->create([
        'status' => MatchStatus::Scheduled,
        'kickoff_at' => now()->addHours(2),
        'home_score' => 0,
        'away_score' => 0,
    ]);
    $channel = Channel::factory()->create(['active' => true]);
    StreamSource::factory()->create([
        'channel_id' => $channel->id,
        'protocol' => StreamProtocol::Hls,
        'url' => 'https://streams.example.com/main.m3u8',
        'enabled' => true,
    ]);

    $this->postJson("/api/v1/admin/matches/{$match->id}/control/channels", ['channel_id' => $channel->id])
        ->assertOk()
        ->assertJsonPath('data.assigned_channels.0.role', 'main');

    $this->patchJson("/api/v1/admin/matches/{$match->id}/control/status", ['status' => 'live'])
        ->assertOk()
        ->assertJsonPath('data.match.status', 'live')
        ->assertJsonPath('data.playback_window.status', 'locked');

    $this->getJson("/api/v1/matches/{$match->slug}/playback")
        ->assertOk()
        ->assertJsonPath('data.status', 'locked')
        ->assertJsonCount(0, 'data.sources');

    $this->postJson("/api/v1/admin/matches/{$match->id}/control/playback", ['action' => 'open_now'])
        ->assertOk()
        ->assertJsonPath('data.playback_window.status', 'open');

    $this->getJson("/api/v1/matches/{$match->slug}/playback")
        ->assertOk()
        ->assertJsonPath('data.status', 'open')
        ->assertJsonCount(1, 'data.sources');
});

it('imports m3u playlists idempotently and masks raw source urls', function (): void {
    Sanctum::actingAs(matchControlOwner());
    Http::fake([
        'https://iptv.example.com/list.m3u' => Http::response("#EXTM3U\n#EXTINF:-1 tvg-id=\"bein-1\" tvg-name=\"beIN Sports 1\" group-title=\"Sports\" tvg-logo=\"https://cdn.example.com/bein.png\",beIN Sports 1 HD\nhttps://streams.example.com/bein-1.m3u8\n"),
    ]);

    $playlistId = $this->postJson('/api/v1/admin/playlists', [
        'name' => 'MENA Sports',
        'type' => 'm3u_url',
        'source_url' => 'https://iptv.example.com/list.m3u',
        'sync_now' => false,
    ])->assertOk()
        ->assertJsonPath('data.source_url', 'https://iptv.example.com/...')
        ->json('data.id');

    $this->postJson("/api/v1/admin/playlists/{$playlistId}/import-now")
        ->assertOk()
        ->assertJsonPath('data.status', 'queued');

    $this->postJson("/api/v1/admin/playlists/{$playlistId}/import-now?blocking=1")
        ->assertOk()
        ->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.channel_count', 1);

    $this->postJson("/api/v1/admin/playlists/{$playlistId}/import-now?blocking=1")
        ->assertOk()
        ->assertJsonPath('data.channel_count', 1);

    $this->assertDatabaseCount('channels', 1);
    $this->assertDatabaseCount('stream_sources', 1);
    $this->assertDatabaseHas('channels', [
        'name' => 'beIN Sports 1 HD',
        'normalized_group' => 'beIN Sports',
        'quality_label' => 'HD',
        'protocol' => 'hls',
    ]);
    $this->assertDatabaseHas('stream_sources', [
        'transport' => 'gateway',
        'gateway_required' => true,
    ]);

    $this->getJson('/api/v1/admin/stream-sources')
        ->assertOk()
        ->assertJsonPath('data.0.url', null)
        ->assertJsonPath('data.0.masked_url', 'https://streams.example.com/...');
});

it('blocks playlist imports from local and private urls', function (): void {
    Sanctum::actingAs(matchControlOwner());

    $this->postJson('/api/v1/admin/playlists', [
        'name' => 'Unsafe',
        'type' => 'm3u_url',
        'source_url' => 'http://127.0.0.1/list.m3u',
    ])->assertUnprocessable();
});

it('tests an m3u url before saving without exposing credentials', function (): void {
    Sanctum::actingAs(matchControlOwner());
    Http::fake([
        'https://iptv.example.com/secret.m3u?user=real&pass=secret' => Http::response("#EXTM3U\n#EXTINF:-1 group-title=\"Sports\",Sports One\nhttps://streams.example.com/sports-one.m3u8\n"),
        'https://streams.example.com/sports-one.m3u8' => Http::response("#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:1\n"),
    ]);

    $response = $this->postJson('/api/v1/admin/playlists/test', [
        'source_url' => 'https://iptv.example.com/secret.m3u?user=real&pass=secret',
    ])->assertOk()
        ->assertJsonPath('data.valid_m3u', true)
        ->assertJsonPath('data.channel_count', 1);

    expect($response->getContent())->not->toContain('user=real');
    expect($response->getContent())->not->toContain('pass=secret');
});
