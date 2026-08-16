<?php

namespace App\Services;

use App\Models\LiveIngest;
use App\Models\StreamSource;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

class HlsRelayManager
{
    public function ensure(StreamSource $source): LiveIngest
    {
        return Cache::lock('live_ingest:'.$source->id, 10)->block(3, function () use ($source): LiveIngest {
            $ingest = $this->sessionFor($source);
            $this->refreshHealth($ingest);

            if (in_array($ingest->status, ['starting', 'ready', 'reconnecting'], true)) {
                return $ingest->refresh();
            }

            return $this->start($source, $ingest);
        });
    }

    public function start(StreamSource $source, ?LiveIngest $ingest = null): LiveIngest
    {
        $ingest ??= $this->sessionFor($source);
        $ffmpeg = $this->ffmpegPath();

        if (! $ffmpeg) {
            $ingest->update([
                'status' => 'failed',
                'last_error' => 'ffmpeg_unavailable',
            ]);

            return $ingest->refresh();
        }

        if (! is_dir($ingest->output_path)) {
            mkdir($ingest->output_path, 0775, true);
        }

        $process = new Process($this->ffmpegArgs($ffmpeg, $source, $ingest));
        $process->setTimeout(null);
        $process->setIdleTimeout(null);
        $process->setOptions(['create_new_console' => true]);
        $process->disableOutput();
        $process->start();

        $ingest->update([
            'status' => 'starting',
            'pid' => $process->getPid(),
            'process_started_at' => now(),
            'ready_at' => null,
            'last_error' => null,
            'restart_count' => $ingest->restart_count + 1,
            'metrics' => [
                'ffmpeg_args' => $this->sanitizedFfmpegArgs($source, $ingest),
                'segment_seconds' => (int) config('rifitv.stable_relay.segment_seconds', 2),
            ],
        ]);

        return $ingest->refresh();
    }

    public function stop(StreamSource $source): LiveIngest
    {
        $ingest = $this->sessionFor($source);

        if ($ingest->pid) {
            $this->terminatePid($ingest->pid);
        }

        $ingest->update([
            'status' => 'stopped',
            'pid' => null,
            'last_error' => null,
        ]);

        return $ingest->refresh();
    }

    public function refreshHealth(LiveIngest $ingest): LiveIngest
    {
        $manifest = $ingest->output_path.DIRECTORY_SEPARATOR.'index.m3u8';
        $segments = glob($ingest->output_path.DIRECTORY_SEPARATOR.'*.ts') ?: [];
        $lastSegmentAt = collect($segments)
            ->map(fn (string $path): int|false => filemtime($path))
            ->filter(fn (int|false $time): bool => $time !== false)
            ->max();

        $updates = [
            'segment_count' => count($segments),
            'last_segment_at' => $lastSegmentAt ? now()->setTimestamp($lastSegmentAt) : null,
        ];

        if (is_file($manifest) && count($segments) >= (int) config('rifitv.stable_relay.ready_segments', 3)) {
            $updates['status'] = 'ready';
            $updates['ready_at'] = $ingest->ready_at ?? now();
            $updates['last_error'] = null;
        } elseif ($ingest->status === 'ready' && (! $lastSegmentAt || $lastSegmentAt < now()->subSeconds((int) config('rifitv.stable_relay.stall_seconds', 8))->timestamp)) {
            $updates['status'] = 'degraded';
            $updates['last_error'] = 'segment_stall';
        }

        $ingest->update($updates);

        return $ingest->refresh();
    }

    public function sessionFor(StreamSource $source): LiveIngest
    {
        $existing = LiveIngest::query()->where('stream_source_id', $source->id)->first();
        if ($existing) {
            return $existing;
        }

        $sessionKey = 'src-'.$source->id.'-'.Str::random(24);
        $root = rtrim((string) config('rifitv.stable_relay.storage_path'), DIRECTORY_SEPARATOR);
        $publicBase = trim((string) config('rifitv.stable_relay.public_base_path', '/media/hls'), '/');

        return LiveIngest::query()->create([
            'stream_source_id' => $source->id,
            'status' => 'stopped',
            'transport' => 'hls_relay',
            'session_key' => $sessionKey,
            'output_path' => $root.DIRECTORY_SEPARATOR.$sessionKey,
            'public_path' => '/'.$publicBase.'/'.$sessionKey.'/index.m3u8',
        ]);
    }

    public function ffmpegArgs(string $ffmpeg, StreamSource $source, LiveIngest $ingest): array
    {
        $segmentSeconds = (string) config('rifitv.stable_relay.segment_seconds', 2);
        $listSize = (string) config('rifitv.stable_relay.list_size', 10);
        $deleteThreshold = (string) config('rifitv.stable_relay.delete_threshold', 4);

        return [
            $ffmpeg,
            '-hide_banner',
            '-loglevel',
            'warning',
            '-user_agent',
            'VLC/3.0.20 LibVLC/3.0.20',
            '-headers',
            "Icy-MetaData: 1\r\n",
            '-reconnect',
            '1',
            '-reconnect_at_eof',
            '1',
            '-reconnect_streamed',
            '1',
            '-reconnect_on_network_error',
            '1',
            '-reconnect_on_http_error',
            '5xx',
            '-reconnect_delay_max',
            '2',
            '-i',
            $source->url,
            '-map',
            '0:v:0',
            '-map',
            '0:a:0?',
            '-c',
            'copy',
            '-f',
            'hls',
            '-hls_time',
            $segmentSeconds,
            '-hls_list_size',
            $listSize,
            '-hls_delete_threshold',
            $deleteThreshold,
            '-hls_flags',
            'delete_segments+append_list+omit_endlist+temp_file',
            $ingest->output_path.DIRECTORY_SEPARATOR.'index.m3u8',
        ];
    }

    public function sanitizedFfmpegArgs(StreamSource $source, LiveIngest $ingest): array
    {
        $args = $this->ffmpegArgs('ffmpeg', $source, $ingest);
        $inputIndex = array_search($source->url, $args, true);
        if ($inputIndex !== false) {
            $args[$inputIndex] = '[authorized-source-url-hidden]';
        }

        return $args;
    }

    public function ffmpegAvailable(): bool
    {
        return $this->ffmpegPath() !== null;
    }

    private function ffmpegPath(): ?string
    {
        return (new ExecutableFinder)->find((string) config('rifitv.stable_relay.ffmpeg_binary', 'ffmpeg'));
    }

    private function terminatePid(int $pid): void
    {
        if (PHP_OS_FAMILY === 'Windows') {
            Process::fromShellCommandline('taskkill /PID '.$pid.' /T /F')->run();

            return;
        }

        if (function_exists('posix_kill')) {
            @posix_kill($pid, SIGTERM);
        }
    }
}
