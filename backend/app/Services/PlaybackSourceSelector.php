<?php

namespace App\Services;

use App\Enums\StreamHealth;
use App\Enums\StreamProtocol;
use App\Models\GameMatch;
use App\Models\StreamSource;
use Illuminate\Support\Collection;

class PlaybackSourceSelector
{
    public function __construct(
        private readonly PlaybackWindowService $window,
        private readonly PlaybackTokenService $tokens,
        private readonly HlsRelayManager $relay,
    ) {}

    /** @return Collection<int, StreamSource> */
    public function candidatesFor(GameMatch $match): Collection
    {
        return $match->channels
            ->where('active', true)
            ->flatMap(fn ($channel) => $channel->streamSources->map(function (StreamSource $source) use ($channel): StreamSource {
                $source->setRelation('channel', $channel);

                return $source;
            }))
            ->filter(fn (StreamSource $source): bool => $source->enabled)
            ->filter(fn (StreamSource $source): bool => ! in_array($source->last_known_status, [
                StreamHealth::Offline,
                StreamHealth::BrowserIncompatible,
                StreamHealth::Disabled,
            ], true))
            ->sort(function (StreamSource $left, StreamSource $right): int {
                $leftHealth = $this->healthRank($left);
                $rightHealth = $this->healthRank($right);

                return [$leftHealth, $left->priority, $left->id] <=> [$rightHealth, $right->priority, $right->id];
            })
            ->values();
    }

    private function healthRank(StreamSource $source): int
    {
        return match ($source->last_known_status) {
            StreamHealth::Offline => 3,
            StreamHealth::Degraded => 1,
            StreamHealth::Healthy => 0,
            default => 0,
        };
    }

    public function responseFor(GameMatch $match): array
    {
        $playback = $this->window->stateFor($match);
        $sources = $playback['status'] === 'open' ? $this->candidatesFor($match) : collect();
        $status = $playback['status'] === 'open' && $sources->isEmpty() ? 'unavailable' : $playback['status'];

        return [
            'match_slug' => $match->slug,
            'status' => $status,
            'window' => $playback,
            'server_time' => $playback['server_time'],
            'kickoff_at' => $playback['kickoff_at'],
            'playback_opens_at' => $playback['opens_at'],
            'playback_closes_at' => $playback['closes_at'],
            'is_live_event' => $match->status->isWatchable() || $playback['status'] === 'open',
            'default_source_id' => $sources->first()?->id,
            'sources' => $sources->map(fn (StreamSource $source): array => $this->sourcePayload($match, $source))->all(),
            'policy' => [
                'max_recovery_attempts_per_source' => 2,
                'max_source_failures_per_session' => 1,
                'stall_detection_ms' => 8000,
                'retry_backoff_ms' => [1000, 2500, 5000],
            ],
        ];
    }

    private function sourcePayload(GameMatch $match, StreamSource $source): array
    {
        $transport = $source->transport ?? 'gateway';

        if ($this->shouldUseRelay($source)) {
            $relayPayload = $this->relayPayload($source);
            if ($relayPayload) {
                return [
                    'id' => $source->id,
                    'channel_id' => $source->channel_id,
                    'channel_name' => $source->channel?->name,
                    'name' => $source->name,
                    'protocol' => 'hls',
                    'transport' => 'hls_relay',
                    'playback_url' => $relayPayload['url'],
                    'url' => $relayPayload['url'],
                    'quality' => $source->channel?->quality_label,
                    'browser_compatible' => 'likely_compatible',
                    'priority' => $source->priority,
                    'is_backup' => $source->is_backup,
                    'last_known_status' => $source->last_known_status?->value,
                    'health_score' => $source->health_score,
                    'relay' => $relayPayload['status'],
                ];
            }
        }

        if ($transport === 'direct' && $source->direct_playable) {
            $playbackUrl = $source->url;
        } else {
            $token = $this->tokens->issue($match, $source);
            $playbackUrl = rtrim((string) config('rifitv.media_gateway.base_url'), '/').'/live/'.$token;
        }

        return [
            'id' => $source->id,
            'channel_id' => $source->channel_id,
            'channel_name' => $source->channel?->name,
            'name' => $source->name,
            'protocol' => $source->protocol->value,
            'transport' => $transport,
            'playback_url' => $playbackUrl,
            'url' => $playbackUrl,
            'quality' => $source->channel?->quality_label,
            'browser_compatible' => $source->browser_compatible,
            'priority' => $source->priority,
            'is_backup' => $source->is_backup,
            'last_known_status' => $source->last_known_status?->value,
            'health_score' => $source->health_score,
        ];
    }

    private function shouldUseRelay(StreamSource $source): bool
    {
        if (! (bool) config('rifitv.stable_relay.enabled', true)) {
            return false;
        }

        if ($source->transport === 'hls_relay') {
            return true;
        }

        return (bool) config('rifitv.stable_relay.default_for_mpegts', true)
            && $source->protocol === StreamProtocol::MpegTs;
    }

    private function relayPayload(StreamSource $source): ?array
    {
        if (! $this->relay->ffmpegAvailable()) {
            return null;
        }

        $ingest = $this->relay->ensure($source);
        if ($ingest->status !== 'ready') {
            return null;
        }

        $baseUrl = rtrim((string) config('rifitv.stable_relay.public_base_url'), '/');

        return [
            'url' => $baseUrl.'/'.basename($ingest->output_path).'/index.m3u8',
            'status' => [
                'status' => $ingest->status,
                'segment_count' => $ingest->segment_count,
                'last_segment_at' => $ingest->last_segment_at?->toIso8601String(),
            ],
        ];
    }
}
