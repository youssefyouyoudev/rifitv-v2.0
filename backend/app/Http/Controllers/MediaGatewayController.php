<?php

namespace App\Http\Controllers;

use App\Enums\StreamHealth;
use App\Models\GameMatch;
use App\Models\StreamSource;
use App\Services\PlaybackTokenService;
use App\Services\PlaybackWindowService;
use App\Services\SafeUrlValidator;
use App\Services\StreamHealthService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;

class MediaGatewayController extends Controller
{
    public function live(Request $request, string $token, PlaybackTokenService $tokens, PlaybackWindowService $window, SafeUrlValidator $safeUrl, StreamHealthService $health): Response
    {
        $payload = $tokens->resolve($token);
        abort_unless($payload, 404);

        $source = StreamSource::query()->with('channel')->findOrFail($payload['source_id']);
        $match = GameMatch::query()->with('channels')->findOrFail($payload['match_id']);

        abort_unless($source->enabled, 403);
        abort_unless($window->canExposeSources($match), 403);
        abort_unless($match->channels->contains('id', $source->channel_id), 403);

        $url = $safeUrl->ensurePublicHttpUrl($source->url, 'source_url');

        $origin = (string) $request->headers->get('Origin');
        $configuredOrigins = config('cors.allowed_origins', []);
        $allowedOrigins = is_array($configuredOrigins)
            ? $configuredOrigins
            : array_filter(array_map('trim', explode(',', (string) $configuredOrigins)));
        $headers = [
            'Content-Type' => $source->protocol->value === 'hls' ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
            'X-Accel-Buffering' => 'no',
            'Access-Control-Allow-Origin' => in_array($origin, $allowedOrigins, true) ? $origin : (config('app.env') === 'local' ? '*' : ''),
            'Access-Control-Expose-Headers' => 'Content-Type',
        ];

        try {
            $upstream = Http::timeout(20)
                ->withOptions([
                    'allow_redirects' => ['max' => 4],
                    'proxy' => '',
                    'stream' => true,
                ])
                ->withHeaders([
                    'Accept' => '*/*',
                    'Icy-MetaData' => '1',
                    'User-Agent' => 'VLC/3.0.20 LibVLC/3.0.20',
                ])
                ->get($url);
        } catch (\Throwable) {
            $this->markGatewayFailure($source, 'connection_error');

            return response('Upstream stream unavailable.', 502, $headers);
        }

        if (! $upstream->successful()) {
            $this->markGatewayFailure($source, 'http_'.$upstream->status());

            return response('Upstream stream unavailable.', 502, $headers);
        }

        $body = $upstream->toPsrResponse()->getBody();
        $contentType = (string) $upstream->header('content-type', '');
        $sample = $body->read(188 * 8);

        if ($this->isTextErrorContent($contentType)) {
            $this->markGatewayFailure($source, 'non_media_content');

            return response('Upstream returned non-media content.', 502, $headers);
        }

        $validMedia = $source->protocol->value === 'hls'
            ? $health->looksLikeHls($sample)
            : $health->looksLikeTransportStream($sample);

        if (! $validMedia) {
            $this->markGatewayFailure($source, 'invalid_media_response');

            return response('Upstream returned invalid media.', 502, $headers);
        }

        return response()->stream(function () use ($body, $sample): void {
            echo $sample;
            flush();

            while (! $body->eof() && connection_status() === CONNECTION_NORMAL) {
                try {
                    echo $body->read(65536);
                    flush();
                } catch (\Throwable) {
                    return;
                }
            }
        }, 200, $headers);
    }

    public function resolve(Request $request, string $token, PlaybackTokenService $tokens, PlaybackWindowService $window)
    {
        $secret = (string) config('rifitv.media_gateway.internal_secret');
        abort_unless($secret !== '' && hash_equals($secret, (string) $request->header('X-RiFiTV-Gateway-Secret')), 403);

        $payload = $tokens->resolve($token);
        abort_unless($payload, 404);

        $source = StreamSource::query()->findOrFail($payload['source_id']);
        $match = GameMatch::query()->findOrFail($payload['match_id']);
        abort_unless($source->enabled && $window->canExposeSources($match), 403);

        return response()->json(['data' => [
            'source_id' => $source->id,
            'match_id' => $match->id,
            'url' => $source->url,
            'protocol' => $source->protocol->value,
        ]]);
    }

    private function markGatewayFailure(StreamSource $source, string $error): void
    {
        $failures = $source->consecutive_failures + 1;
        $status = $failures >= 3 ? StreamHealth::Offline : StreamHealth::Degraded;

        $source->update([
            'last_known_status' => $status,
            'last_checked_at' => now(),
            'consecutive_failures' => $failures,
            'consecutive_successes' => 0,
            'health_score' => max(0, min(100, 100 - ($failures * 25))),
            'last_error_type' => $error,
        ]);

        $source->channel?->update([
            'health_status' => $status->value,
            'browser_compatible' => $source->browser_compatible ?? 'unknown',
            'protocol' => $source->protocol->value,
        ]);
    }

    private function isTextErrorContent(string $contentType): bool
    {
        return preg_match('/(?:text\/html|application\/json|text\/plain|application\/xml|text\/xml)/i', $contentType) === 1;
    }
}
