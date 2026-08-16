<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StreamSourceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'channel_id' => $this->channel_id,
            'playlist_id' => $this->playlist_id,
            'channel' => new ChannelResource($this->whenLoaded('channel')),
            'name' => $this->name,
            'protocol' => $this->protocol->value,
            'transport' => $this->transport ?? 'gateway',
            'direct_playable' => $this->direct_playable,
            'gateway_required' => $this->gateway_required,
            'url' => $request->user()?->hasPermission('streams.manage') && $this->source_origin !== 'playlist' ? $this->url : null,
            'masked_url' => $this->maskUrl($this->url),
            'priority' => $this->priority,
            'enabled' => $this->enabled,
            'is_backup' => $this->is_backup,
            'source_origin' => $this->source_origin ?? 'manual',
            'url_hash' => $this->url_hash,
            'browser_compatible' => $this->browser_compatible,
            'video_codec' => $this->video_codec,
            'audio_codec' => $this->audio_codec,
            'container' => $this->container,
            'resolution' => $this->resolution,
            'frame_rate' => $this->frame_rate,
            'last_known_status' => $this->last_known_status?->value,
            'last_checked_at' => $this->last_checked_at?->toIso8601String(),
            'latency_ms' => $this->latency_ms,
            'last_success_at' => $this->last_success_at?->toIso8601String(),
            'consecutive_failures' => $this->consecutive_failures,
            'consecutive_successes' => $this->consecutive_successes,
            'health_score' => $this->health_score,
            'last_error_type' => $this->last_error_type,
        ];
    }

    private function maskUrl(string $url): string
    {
        $parts = parse_url($url);

        if (! $parts || ! isset($parts['host'])) {
            return '[hidden]';
        }

        return ($parts['scheme'] ?? 'https').'://'.$parts['host'].'/...';
    }
}
