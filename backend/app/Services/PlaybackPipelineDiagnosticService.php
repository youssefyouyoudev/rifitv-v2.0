<?php

namespace App\Services;

use App\Models\StreamSource;

class PlaybackPipelineDiagnosticService
{
    public function __construct(
        private readonly StreamHealthService $health,
        private readonly HlsRelayManager $relay,
    ) {}

    public function test(StreamSource $source): array
    {
        $health = $this->health->check($source->refresh());
        $relayAvailable = $this->relay->ffmpegAvailable();
        $ingest = $relayAvailable ? $this->relay->ensure($source->refresh()) : $this->relay->sessionFor($source->refresh());
        $ingest = $this->relay->refreshHealth($ingest);

        return [
            'source_id' => $source->id,
            'provider' => [
                'status' => $health['status'],
                'latency_ms' => $health['latency_ms'],
                'error_category' => $health['error_category'],
                'health_score' => $health['health_score'],
            ],
            'gateway' => [
                'transport' => $source->transport ?? 'gateway',
                'requires_gateway' => $source->gateway_required,
                'provider_url_hidden' => true,
            ],
            'relay' => [
                'ffmpeg_available' => $relayAvailable,
                'status' => $ingest->status,
                'segment_count' => $ingest->segment_count,
                'last_segment_at' => $ingest->last_segment_at?->toIso8601String(),
                'last_error' => $ingest->last_error,
            ],
            'browser' => [
                'preferred_protocol' => $ingest->status === 'ready' ? 'hls' : $source->protocol->value,
                'browser_compatible' => $source->browser_compatible ?? 'unknown',
            ],
        ];
    }
}
