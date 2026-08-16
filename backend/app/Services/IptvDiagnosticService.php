<?php

namespace App\Services;

use App\Models\Playlist;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class IptvDiagnosticService
{
    public function __construct(
        private readonly SafeUrlValidator $safeUrl,
        private readonly M3uParser $parser,
        private readonly StreamHealthService $health,
    ) {}

    public function diagnosePlaylist(Playlist $playlist): array
    {
        $content = match ($playlist->type) {
            'uploaded_m3u' => Storage::disk('local')->get($playlist->file_path),
            'm3u_url' => $this->fetchPlaylist($playlist->source_url),
            default => '',
        };

        return $this->diagnoseContent($content, $playlist->source_url ?? $playlist->server_url, $playlist->name);
    }

    public function diagnoseUrl(string $url, string $name = 'Runtime playlist'): array
    {
        return $this->diagnoseContent($this->fetchPlaylist($url), $url, $name);
    }

    private function fetchPlaylist(?string $url): string
    {
        $safe = $this->safeUrl->ensurePublicHttpUrl($url, 'playlist_url');

        return Http::timeout(20)
            ->withOptions(['allow_redirects' => ['max' => 3]])
            ->withHeaders(['User-Agent' => 'RiFiTV IPTV Diagnostic'])
            ->get($safe)
            ->throw()
            ->body();
    }

    private function diagnoseContent(string $content, ?string $url, string $name): array
    {
        $entries = str_starts_with(ltrim($content), '#EXTM3U') ? $this->parser->parse($content) : [];
        $groups = collect($entries)->pluck('group')->filter()->unique()->values();
        $samples = collect($entries)->take(5)->map(fn (array $entry): array => $this->diagnoseStream($entry))->all();
        $schemes = collect($entries)->map(fn (array $entry): ?string => parse_url($entry['url'], PHP_URL_SCHEME))->filter()->countBy();

        return [
            'playlist' => [
                'name' => $name,
                'host' => $url ? parse_url($url, PHP_URL_HOST) : null,
                'reachable' => $content !== '',
                'valid_m3u' => str_starts_with(ltrim($content), '#EXTM3U'),
                'first_bytes' => $this->firstBytesLabel($content),
            ],
            'counts' => [
                'channels' => count($entries),
                'groups' => $groups->count(),
                'http_sources' => (int) ($schemes['http'] ?? 0),
                'https_sources' => (int) ($schemes['https'] ?? 0),
            ],
            'groups' => $groups->take(20)->all(),
            'samples' => $samples,
            'ffprobe_available' => $this->ffprobeAvailable(),
        ];
    }

    private function diagnoseStream(array $entry): array
    {
        $url = $this->safeUrl->ensurePublicHttpUrl($entry['url'], 'stream_url');
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $result = [
            'channel' => $entry['name'],
            'host' => parse_url($url, PHP_URL_HOST),
            'scheme' => $scheme,
            'mixed_content_risk' => $scheme === 'http',
            'cors' => 'unknown',
            'content_type' => null,
            'protocol' => 'unknown',
            'browser_compatible' => 'unknown',
            'transport' => 'gateway',
            'error_category' => null,
        ];

        try {
            $response = Http::timeout(8)
                ->withOptions(['allow_redirects' => ['max' => 2]])
                ->withHeaders(['Range' => 'bytes=0-262143', 'Origin' => (string) config('app.url'), 'User-Agent' => 'RiFiTV IPTV Diagnostic'])
                ->get($url);
            $body = substr((string) $response->body(), 0, 262144);
            $result['content_type'] = $response->header('content-type');
            $result['cors'] = $response->header('access-control-allow-origin') ? 'present' : 'missing';
            $result['protocol'] = match (true) {
                $this->health->looksLikeHls($body) => 'hls',
                $this->health->looksLikeTransportStream($body) => 'mpegts',
                default => 'unknown',
            };
            $result['browser_compatible'] = $result['protocol'] === 'unknown' ? 'unknown' : 'likely_compatible';
            $result['transport'] = $scheme === 'https' && $result['cors'] === 'present' ? 'direct' : 'gateway';
            $result['error_category'] = $response->successful() ? null : 'http_error';
        } catch (Throwable $exception) {
            $result['error_category'] = Str::slug(class_basename($exception));
        }

        return $result;
    }

    private function firstBytesLabel(string $content): string
    {
        $prefix = ltrim(substr($content, 0, 64));

        return match (true) {
            $prefix === '' => 'empty body',
            str_starts_with($prefix, '#EXTM3U') => '#EXTM3U',
            str_starts_with(Str::lower($prefix), '<html') => 'HTML error',
            str_contains(Str::lower($prefix), 'auth') => 'authentication failure',
            default => 'invalid playlist',
        };
    }

    private function ffprobeAvailable(): bool
    {
        exec('ffprobe -version 2>NUL', $output, $code);

        return $code === 0;
    }
}
