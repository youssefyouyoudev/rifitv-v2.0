<?php

use App\Enums\StreamProtocol;
use App\Jobs\CheckStreamHealthJob;
use App\Models\LiveIngest;
use App\Models\StreamSource;
use App\Services\HlsRelayManager;
use App\Services\StreamHealthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;

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

it('does not mark stale hls files with a dead pid as ready', function (): void {
    config()->set('rifitv.stable_relay.storage_path', storage_path('framework/testing/live-hls'));
    config()->set('rifitv.stable_relay.ready_segments', 3);
    config()->set('rifitv.stable_relay.stall_seconds', 8);
    $source = StreamSource::factory()->create();
    $relay = app(HlsRelayManager::class);
    $ingest = $relay->sessionFor($source);
    prepareRelayFiles($ingest, now()->subMinute()->timestamp, 3);
    $ingest->update(['status' => 'ready', 'pid' => 999999999]);

    $refreshed = $relay->refreshHealth($ingest->refresh());

    expect($refreshed->status)->toBe('failed')
        ->and($refreshed->pid)->toBeNull()
        ->and($refreshed->last_error)->toBe('ffmpeg_not_running');
});

it('marks a live relay ready only when fresh segments exist', function (): void {
    config()->set('rifitv.stable_relay.storage_path', storage_path('framework/testing/live-hls'));
    config()->set('rifitv.stable_relay.ready_segments', 3);
    config()->set('rifitv.stable_relay.stall_seconds', 8);
    $source = StreamSource::factory()->create();
    $relay = new class extends HlsRelayManager
    {
        public string $command = '';

        protected function processCommand(int $pid): ?string
        {
            return $pid === getmypid() ? $this->command : null;
        }
    };
    $ingest = $relay->sessionFor($source);
    $relay->command = 'ffmpeg '.$ingest->output_path.'/index.m3u8';
    prepareRelayFiles($ingest, time(), 3);
    $ingest->update(['status' => 'starting', 'pid' => getmypid()]);

    $refreshed = $relay->refreshHealth($ingest->refresh());

    expect($refreshed->status)->toBe('ready')
        ->and($refreshed->ready_at)->not->toBeNull()
        ->and($refreshed->last_error)->toBeNull();
});

it('makes a stale ready relay eligible for restart when the process is dead', function (): void {
    config()->set('rifitv.stable_relay.storage_path', storage_path('framework/testing/live-hls'));
    $source = StreamSource::factory()->create();
    $relay = app(HlsRelayManager::class);
    $ingest = $relay->sessionFor($source);
    $ingest->update(['status' => 'ready', 'pid' => 999999999]);

    $refreshed = $relay->refreshHealth($ingest->refresh());

    expect($refreshed->status)->toBe('failed')
        ->and($refreshed->pid)->toBeNull()
        ->and($refreshed->last_error)->toBe('ffmpeg_not_running');
});

it('reuses one live relay for repeated ensure calls on the same source', function (): void {
    config()->set('rifitv.stable_relay.storage_path', storage_path('framework/testing/live-hls'));
    $source = StreamSource::factory()->create();
    $relay = new class extends HlsRelayManager
    {
        public int $launches = 0;
        private string $command = '';

        protected function ffmpegPath(): ?string
        {
            return PHP_BINARY;
        }

        protected function launchDetachedProcess(array $args): ?int
        {
            $this->launches++;
            $this->command = 'ffmpeg '.implode(' ', $args);

            return getmypid();
        }

        protected function processCommand(int $pid): ?string
        {
            return $pid === getmypid() ? $this->command : null;
        }
    };

    $first = $relay->ensure($source);
    $second = $relay->ensure($source);

    expect($relay->launches)->toBe(1)
        ->and($first->id)->toBe($second->id)
        ->and($second->pid)->toBe(getmypid())
        ->and($second->restart_count)->toBe(1);
});

it('coalesces same-source relay starts into one tracked launch', function (): void {
    config()->set('rifitv.stable_relay.storage_path', storage_path('framework/testing/live-hls'));
    $source = StreamSource::factory()->create();
    $relay = new class extends HlsRelayManager
    {
        public int $launches = 0;
        private string $command = '';

        protected function ffmpegPath(): ?string
        {
            return PHP_BINARY;
        }

        protected function launchDetachedProcess(array $args): ?int
        {
            $this->launches++;
            $this->command = 'ffmpeg '.implode(' ', $args);

            return 424242;
        }

        protected function processAlive(?int $pid): bool
        {
            return $pid === 424242;
        }

        protected function processCommand(int $pid): ?string
        {
            return $pid === 424242 ? $this->command : null;
        }
    };

    $first = $relay->ensure($source);
    $second = $relay->start($source, $first);
    $third = $relay->ensure($source);

    expect($relay->launches)->toBe(1)
        ->and($second->pid)->toBe(424242)
        ->and($third->pid)->toBe(424242)
        ->and($third->restart_count)->toBe(1);
});

it('stopped relay with stale hls files is never marked ready', function (): void {
    config()->set('rifitv.stable_relay.storage_path', storage_path('framework/testing/live-hls'));
    config()->set('rifitv.stable_relay.ready_segments', 2);
    config()->set('rifitv.stable_relay.stall_seconds', 60);
    $source = StreamSource::factory()->create();
    $relay = app(HlsRelayManager::class);
    $ingest = $relay->sessionFor($source);
    prepareRelayFiles($ingest, time(), 2);
    $ingest->update(['status' => 'stopped', 'pid' => null, 'ready_at' => null]);

    $refreshed = $relay->refreshHealth($ingest->refresh());

    expect($refreshed->status)->toBe('stopped')
        ->and($refreshed->pid)->toBeNull()
        ->and($refreshed->ready_at)->toBeNull();
});

it('terminates duplicate relays for the same output path and keeps the tracked pid', function (): void {
    config()->set('rifitv.stable_relay.storage_path', storage_path('framework/testing/live-hls'));
    $source = StreamSource::factory()->create();
    $relay = new class extends HlsRelayManager
    {
        public array $terminated = [];
        public string $command = '';

        protected function ffmpegPath(): ?string
        {
            return PHP_BINARY;
        }

        protected function launchDetachedProcess(array $args): ?int
        {
            throw new RuntimeException('tracked relay should be reused');
        }

        protected function processAlive(?int $pid): bool
        {
            return in_array($pid, [111, 222], true);
        }

        protected function processCommand(int $pid): ?string
        {
            return in_array($pid, [111, 222], true) ? $this->command : null;
        }

        protected function relayPidsForOutputPath(string $outputPath): array
        {
            return [111, 222];
        }

        protected function terminateProcess(int $pid): void
        {
            $this->terminated[] = $pid;
        }
    };
    $ingest = $relay->sessionFor($source);
    $relay->command = 'ffmpeg '.$ingest->output_path.'/index.m3u8';
    $ingest->update(['status' => 'starting', 'pid' => 111]);

    $ingest = $relay->ensure($source);

    expect($ingest->pid)->toBe(111)
        ->and($relay->terminated)->toBe([222]);
});

it('requires health jobs to target one source', function (): void {
    expect(fn () => new CheckStreamHealthJob)->toThrow(ArgumentCountError::class);

    $job = new CheckStreamHealthJob(123);

    expect($job->sourceId)->toBe(123)
        ->and($job->tries)->toBe(1)
        ->and($job->timeout)->toBe(15)
        ->and($job->failOnTimeout)->toBeTrue();
});

it('exits one-source health jobs safely for missing or disabled sources', function (): void {
    $service = app(StreamHealthService::class);
    (new CheckStreamHealthJob(999999999))->handle($service);

    $disabled = StreamSource::factory()->create(['enabled' => false]);
    (new CheckStreamHealthJob($disabled->id))->handle($service);

    $this->assertDatabaseCount('stream_health_checks', 0);
});

it('fans scheduled health checks into per-source jobs', function (): void {
    Bus::fake();
    $due = StreamSource::factory()->create(['enabled' => true, 'last_checked_at' => now()->subMinutes(10)]);
    StreamSource::factory()->create(['enabled' => false, 'last_checked_at' => now()->subMinutes(10)]);
    StreamSource::factory()->create(['enabled' => true, 'last_checked_at' => now()]);

    $count = app(StreamHealthService::class)->dispatchDueChecks();

    expect($count)->toBe(1);
    Bus::assertDispatched(CheckStreamHealthJob::class, fn (CheckStreamHealthJob $job): bool => $job->sourceId === $due->id);
});

function prepareRelayFiles(LiveIngest $ingest, int $mtime, int $segments): void
{
    if (! is_dir($ingest->output_path)) {
        mkdir($ingest->output_path, 0775, true);
    }

    $manifest = $ingest->output_path.DIRECTORY_SEPARATOR.'index.m3u8';
    file_put_contents($manifest, "#EXTM3U\n");
    touch($manifest, $mtime);

    for ($index = 0; $index < $segments; $index++) {
        $segment = $ingest->output_path.DIRECTORY_SEPARATOR.'segment'.$index.'.ts';
        file_put_contents($segment, str_repeat('x', 188));
        touch($segment, $mtime);
    }
}
