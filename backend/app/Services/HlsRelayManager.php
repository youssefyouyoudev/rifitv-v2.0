<?php

namespace App\Services;

use App\Models\LiveIngest;
use App\Models\StreamSource;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;
use Throwable;

class HlsRelayManager
{
    public function ensure(StreamSource $source): LiveIngest
    {
        return Cache::lock('live_ingest:'.$source->id, 10)->block(3, function () use ($source): LiveIngest {
            $ingest = $this->sessionFor($source);
            $this->refreshHealth($ingest);

            if (
                in_array($ingest->status, ['starting', 'ready', 'reconnecting'], true)
                && $this->processAlive($ingest->pid)
            ) {
                return $ingest->refresh();
            }

            if ($ingest->pid) {
                $this->terminatePid($ingest->pid, $ingest);
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
                'pid' => null,
                'last_error' => 'ffmpeg_unavailable',
            ]);

            return $ingest->refresh();
        }

        if (! is_dir($ingest->output_path)) {
            if (! @mkdir($ingest->output_path, 0775, true) && ! is_dir($ingest->output_path)) {
                $ingest->update([
                    'status' => 'failed',
                    'pid' => null,
                    'last_error' => 'output_directory_unavailable',
                ]);

                return $ingest->refresh();
            }
        }

        if ($ingest->pid) {
            $this->terminatePid($ingest->pid, $ingest);
        }

        $this->cleanupOutput($ingest);

        $pid = $this->launchDetachedProcess($this->ffmpegArgs($ffmpeg, $source, $ingest));

        if (! $pid || $pid <= 0 || ! $this->processAlive($pid)) {
            $ingest->update([
                'status' => 'failed',
                'pid' => null,
                'last_error' => 'ffmpeg_launch_failed',
            ]);

            return $ingest->refresh();
        }

        $ingest->update([
            'status' => 'starting',
            'pid' => $pid,
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
            $this->terminatePid($ingest->pid, $ingest);
        }

        $ingest->update([
            'status' => 'stopped',
            'pid' => null,
            'last_error' => null,
        ]);

        return $ingest->refresh();
    }

    public function resetStale(LiveIngest $ingest, string $reason = 'relay_reset_after_lifecycle_fix'): LiveIngest
    {
        if ($ingest->pid) {
            $this->terminatePid($ingest->pid, $ingest);
        }

        $this->cleanupOutput($ingest);

        $ingest->update([
            'status' => 'stopped',
            'pid' => null,
            'last_error' => $reason,
            'ready_at' => null,
            'segment_count' => 0,
            'last_segment_at' => null,
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

        $stallSeconds = (int) config('rifitv.stable_relay.stall_seconds', 8);
        $readySegments = (int) config('rifitv.stable_relay.ready_segments', 3);
        $startupTimeout = (int) config('rifitv.stable_relay.startup_timeout_seconds', 20);

        $segmentsFresh = $lastSegmentAt
            && $lastSegmentAt >= now()->subSeconds($stallSeconds)->timestamp;

        $processAlive = $this->processAlive($ingest->pid);
        $startupExpired = $ingest->status === 'starting'
            && $ingest->process_started_at
            && $ingest->process_started_at->lt(now()->subSeconds($startupTimeout));

        $updates = [
            'segment_count' => count($segments),
            'last_segment_at' => $lastSegmentAt
                ? now()->setTimestamp($lastSegmentAt)
                : null,
        ];

        if (
            $processAlive
            && is_file($manifest)
            && count($segments) >= $readySegments
            && $segmentsFresh
        ) {
            $updates['status'] = 'ready';
            $updates['ready_at'] = $ingest->ready_at ?? now();
            $updates['last_error'] = null;
        } elseif ($processAlive && $startupExpired && ! $segmentsFresh) {
            $updates['status'] = 'degraded';
            $updates['last_error'] = 'startup_timeout';
        } elseif (
            in_array($ingest->status, ['starting', 'ready', 'reconnecting'], true)
            && ! $processAlive
        ) {
            $updates['status'] = 'failed';
            $updates['pid'] = null;
            $updates['last_error'] = 'ffmpeg_not_running';
        } elseif (
            in_array($ingest->status, ['ready', 'reconnecting'], true)
            && ! $segmentsFresh
        ) {
            $updates['status'] = 'degraded';
            $updates['last_error'] = 'segment_stall';
        }

        $ingest->update($updates);

        return $ingest->refresh();
    }

    private function processAlive(?int $pid): bool
    {
        if (! $pid || $pid <= 0) {
            return false;
        }

        if ($pid === getmypid()) {
            return true;
        }

        $statFile = "/proc/{$pid}/stat";

        if (is_readable($statFile)) {
            $stat = file_get_contents($statFile);

            if ($stat !== false && preg_match('/\)\s+([A-Z])\s+/', $stat, $matches) === 1) {
                if (($matches[1] ?? null) === 'Z') {
                    return false;
                }
            }
        }

        if (function_exists('posix_kill')) {
            return @posix_kill($pid, 0);
        }

        if (PHP_OS_FAMILY === 'Windows') {
            $process = new Process(['tasklist', '/FI', 'PID eq '.$pid, '/NH']);
            $process->run();

            return str_contains($process->getOutput(), (string) $pid);
        }

        return is_dir("/proc/{$pid}");
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
            '5',
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
            'delete_segments+omit_endlist+temp_file',
            '-hls_segment_filename',
            $ingest->output_path.DIRECTORY_SEPARATOR.'segment-%06d.ts',
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

    protected function ffmpegPath(): ?string
    {
        return (new ExecutableFinder)->find((string) config('rifitv.stable_relay.ffmpeg_binary', 'ffmpeg'));
    }

    protected function launchDetachedProcess(array $args): ?int
    {
        if (PHP_OS_FAMILY === 'Windows') {
            return null;
        }

        $command = implode(' ', array_map('escapeshellarg', $args));
        $shell = 'if command -v setsid >/dev/null 2>&1; then nohup setsid '.$command.' </dev/null >/dev/null 2>&1 & echo $!; else nohup '.$command.' </dev/null >/dev/null 2>&1 & echo $!; fi';
        $process = Process::fromShellCommandline($shell);
        $process->setTimeout(10);
        $process->run();

        if (! $process->isSuccessful()) {
            return null;
        }

        $pid = (int) trim($process->getOutput());

        return $pid > 0 ? $pid : null;
    }

    private function cleanupOutput(LiveIngest $ingest): void
    {
        if (! $this->safeOutputPath($ingest) || ! is_dir($ingest->output_path)) {
            return;
        }

        foreach (new \DirectoryIterator($ingest->output_path) as $file) {
            if (! $file->isFile()) {
                continue;
            }

            $name = $file->getFilename();
            if (
                $name === 'index.m3u8'
                || Str::endsWith($name, ['.ts', '.tmp', '.part', '.m3u8.tmp', '.ts.tmp'])
            ) {
                @unlink($file->getPathname());
            }
        }
    }

    private function safeOutputPath(LiveIngest $ingest): bool
    {
        $path = rtrim((string) $ingest->output_path, DIRECTORY_SEPARATOR);

        return $path !== ''
            && $ingest->session_key !== ''
            && basename($path) === $ingest->session_key;
    }

    private function terminatePid(int $pid, ?LiveIngest $ingest = null): void
    {
        if (PHP_OS_FAMILY === 'Windows') {
            if ($this->isExpectedRelayProcess($pid, $ingest)) {
                Process::fromShellCommandline('taskkill /PID '.((int) $pid).' /T /F')->run();
            }

            return;
        }

        if (! function_exists('posix_kill') || ! $this->processAlive($pid) || ! $this->isExpectedRelayProcess($pid, $ingest)) {
            return;
        }

        @posix_kill($pid, SIGTERM);

        $deadline = microtime(true) + 2.0;
        while (microtime(true) < $deadline) {
            usleep(100000);
            if (! $this->processAlive($pid)) {
                return;
            }
        }

        @posix_kill($pid, SIGKILL);
    }

    private function isExpectedRelayProcess(int $pid, ?LiveIngest $ingest): bool
    {
        $command = $this->processCommand($pid);
        if ($command === null || ! str_contains(Str::lower($command), 'ffmpeg')) {
            return false;
        }

        if (! $ingest) {
            return true;
        }

        return str_contains($command, (string) $ingest->output_path)
            || str_contains($command, (string) $ingest->session_key);
    }

    private function processCommand(int $pid): ?string
    {
        try {
            $cmdline = "/proc/{$pid}/cmdline";
            if (is_readable($cmdline)) {
                $contents = file_get_contents($cmdline);

                return $contents === false ? null : str_replace("\0", ' ', $contents);
            }

            if (PHP_OS_FAMILY === 'Windows') {
                $process = Process::fromShellCommandline('wmic process where processid='.((int) $pid).' get CommandLine /VALUE');
            } else {
                $process = new Process(['ps', '-p', (string) $pid, '-o', 'command=']);
            }

            $process->setTimeout(3);
            $process->run();

            return $process->isSuccessful() ? trim($process->getOutput()) : null;
        } catch (Throwable) {
            return null;
        }
    }
}
