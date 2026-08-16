<?php

namespace App\Services;

use App\Enums\StreamHealth;
use App\Enums\StreamProtocol;
use App\Models\StreamHealthCheck;
use App\Models\StreamSource;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class StreamHealthService
{
    public function __construct(private readonly OperationalAlertService $alerts) {}

    public function check(StreamSource $source): array
    {
        return Cache::lock('rifitv:stream-health:'.$source->id, 60)->block(1, function () use ($source): array {
            if (! $source->enabled) {
                return $this->record($source, StreamHealth::Disabled, null, 'disabled');
            }

            $started = microtime(true);
            $error = null;

            if (! $this->isSafeUrl($source->url)) {
                return $this->record($source, StreamHealth::Offline, null, 'blocked_url');
            }

            try {
                $response = Http::timeout((int) config('rifitv.stream_health.timeout', 5))
                    ->withOptions(['allow_redirects' => ['max' => 4], 'proxy' => ''])
                    ->withHeaders([
                        'Accept' => '*/*',
                        'Icy-MetaData' => '1',
                        'Range' => 'bytes=0-262143',
                        'User-Agent' => 'VLC/3.0.20 LibVLC/3.0.20',
                    ])
                    ->get($source->url);
                $latency = (int) round((microtime(true) - $started) * 1000);
                $body = substr((string) $response->body(), 0, 262144);

                if (! $response->successful()) {
                    return $this->record($source, StreamHealth::Degraded, $latency, 'http_'.$response->status());
                }

                $valid = $source->protocol === StreamProtocol::Hls ? $this->looksLikeHls($body) : $this->looksLikeTransportStream($body);
                $browserCompatible = $valid ? $this->browserCompatibility($source, $body) : 'unknown';

                return $this->record($source, $valid ? StreamHealth::Healthy : StreamHealth::Degraded, $latency, $valid ? null : 'invalid_media_response', [
                    'browser_compatible' => $browserCompatible,
                    'container' => $source->protocol === StreamProtocol::Hls ? 'hls' : 'mpegts',
                ]);
            } catch (\Throwable $e) {
                $error = Str::slug(class_basename($e));
            }

            return $this->record($source, StreamHealth::Offline, null, $error ?? 'network_error');
        });
    }

    public function checkAll(): int
    {
        $count = 0;
        StreamSource::query()->where('enabled', true)->each(function (StreamSource $source) use (&$count): void {
            $this->check($source);
            $count++;
        });

        return $count;
    }

    private function record(StreamSource $source, StreamHealth $observed, ?int $latencyMs, ?string $error, array $diagnostics = []): array
    {
        $failures = $observed === StreamHealth::Healthy ? 0 : $source->consecutive_failures + 1;
        $successes = $observed === StreamHealth::Healthy ? $source->consecutive_successes + 1 : 0;
        $status = match (true) {
            $observed === StreamHealth::Disabled => StreamHealth::Disabled,
            $observed === StreamHealth::BrowserIncompatible => StreamHealth::BrowserIncompatible,
            $successes >= 2 => StreamHealth::Healthy,
            $failures >= 3 => StreamHealth::Offline,
            $failures >= 1 => StreamHealth::Degraded,
            default => StreamHealth::Unknown,
        };
        $score = max(0, min(100, 100 - ($failures * 25) - (int) (($latencyMs ?? 0) / 80)));

        $source->update([
            'last_known_status' => $status,
            'last_checked_at' => now(),
            'last_success_at' => $observed === StreamHealth::Healthy ? now() : $source->last_success_at,
            'latency_ms' => $latencyMs,
            'consecutive_failures' => $failures,
            'consecutive_successes' => $successes,
            'health_score' => $score,
            'last_error_type' => $error,
            'browser_compatible' => $diagnostics['browser_compatible'] ?? $source->browser_compatible,
            'container' => $diagnostics['container'] ?? $source->container,
        ]);

        $source->channel?->update([
            'health_status' => $status->value,
            'browser_compatible' => $diagnostics['browser_compatible'] ?? $source->browser_compatible ?? 'unknown',
            'protocol' => $source->protocol->value,
        ]);

        StreamHealthCheck::query()->create([
            'stream_source_id' => $source->id,
            'status' => $status->value,
            'latency_ms' => $latencyMs,
            'error_category' => $error,
            'checked_at' => now(),
        ]);

        $dedupe = 'stream-'.$source->id;
        if ($status === StreamHealth::Offline) {
            $this->alerts->open('stream_offline', $dedupe, 'critical', $source->name.' is offline', 'A stream source failed repeated health checks.');
        } elseif ($status === StreamHealth::Healthy) {
            $this->alerts->resolve($dedupe);
        }

        return ['status' => $status->value, 'latency_ms' => $latencyMs, 'error_category' => $error, 'health_score' => $score];
    }

    private function isSafeUrl(string $url): bool
    {
        $parts = parse_url($url);
        if (! in_array($parts['scheme'] ?? '', ['http', 'https'], true) || empty($parts['host'])) {
            return false;
        }

        $host = strtolower($parts['host']);
        if (in_array($host, ['localhost', '127.0.0.1'], true) && app()->environment('production')) {
            return false;
        }

        $ip = gethostbyname($host);

        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false || ! app()->environment('production');
    }

    public function looksLikeHls(string $body): bool
    {
        return str_starts_with(ltrim($body), '#EXTM3U')
            && (str_contains($body, '#EXT-X-') || str_contains($body, '#EXTINF'));
    }

    public function looksLikeTransportStream(string $body): bool
    {
        if (strlen($body) < 188 * 5) {
            return false;
        }

        foreach ([0, 1, 2, 3, 4] as $offset) {
            $matches = 0;
            for ($packet = 0; $packet < 5; $packet++) {
                if (($body[$offset + ($packet * 188)] ?? null) === "\x47") {
                    $matches++;
                }
            }

            if ($matches >= 4) {
                return true;
            }
        }

        return false;
    }

    private function browserCompatibility(StreamSource $source, string $body): string
    {
        if ($source->protocol === StreamProtocol::Hls && $this->looksLikeHls($body)) {
            return 'likely_compatible';
        }

        if ($source->protocol === StreamProtocol::MpegTs && $this->looksLikeTransportStream($body)) {
            return 'likely_compatible';
        }

        return 'unknown';
    }
}
