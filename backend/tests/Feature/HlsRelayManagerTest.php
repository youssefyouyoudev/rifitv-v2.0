<?php

use App\Enums\StreamProtocol;
use App\Models\StreamSource;
use App\Services\HlsRelayManager;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('builds sanitized ffmpeg stream-copy relay commands', function (): void {
    config()->set('rifitv.stable_relay.storage_path', storage_path('framework/testing/live-hls'));
    $source = StreamSource::factory()->create([
        'protocol' => StreamProtocol::MpegTs,
        'url' => 'http://provider.example/live?user=secret-user&pass=secret-pass',
    ]);

    $relay = app(HlsRelayManager::class);
    $ingest = $relay->sessionFor($source);
    $args = $relay->ffmpegArgs('ffmpeg', $source, $ingest);
    $sanitized = json_encode($relay->sanitizedFfmpegArgs($source, $ingest), JSON_THROW_ON_ERROR);

    expect($args)->toContain('-c')
        ->and($args)->toContain('copy')
        ->and($args)->toContain('-reconnect_streamed')
        ->and($args)->toContain('-hls_flags')
        ->and($sanitized)->not->toContain('secret-user')
        ->and($sanitized)->not->toContain('secret-pass')
        ->and($sanitized)->toContain('[authorized-source-url-hidden]');
});

it('fails safely when ffmpeg is unavailable', function (): void {
    config()->set('rifitv.stable_relay.ffmpeg_binary', 'missing-rifitv-ffmpeg-binary');
    config()->set('rifitv.stable_relay.storage_path', storage_path('framework/testing/live-hls'));
    $source = StreamSource::factory()->create();

    $ingest = app(HlsRelayManager::class)->ensure($source);

    expect($ingest->status)->toBe('failed')
        ->and($ingest->last_error)->toBe('ffmpeg_unavailable');
});
