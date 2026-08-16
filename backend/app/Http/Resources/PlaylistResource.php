<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlaylistResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type,
            'host' => $this->host,
            'status' => $this->status,
            'health_status' => $this->health_status,
            'source_url' => $this->maskUrl($this->source_url),
            'server_url' => $this->maskUrl($this->server_url),
            'has_credentials' => filled($this->username) || filled($this->password),
            'active' => $this->active,
            'auto_sync' => $this->auto_sync,
            'sync_interval_minutes' => $this->sync_interval_minutes,
            'channel_count' => $this->channel_count,
            'group_count' => $this->group_count,
            'last_sync_at' => $this->last_sync_at?->toIso8601String(),
            'last_successful_sync_at' => $this->last_successful_sync_at?->toIso8601String(),
            'last_error_category' => $this->last_error_category,
            'last_error_message' => $this->last_error_message,
            'latest_sync_run' => new PlaylistSyncRunResource($this->whenLoaded('latestSyncRun')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function maskUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $parts = parse_url($url);

        if (! $parts || ! isset($parts['host'])) {
            return '[hidden]';
        }

        return ($parts['scheme'] ?? 'https').'://'.$parts['host'].'/...';
    }
}
