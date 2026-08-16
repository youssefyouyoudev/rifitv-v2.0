<?php

namespace App\Http\Resources;

use App\Services\PlaybackWindowService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MatchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $playbackWindow = app(PlaybackWindowService::class)->stateFor($this->resource);

        return [
            'id' => $this->id,
            'provider' => $this->provider,
            'external_id' => $this->external_id,
            'source_provider' => $this->source_provider,
            'source_external_id' => $this->source_external_id,
            'slug' => $this->slug,
            'competition' => new CompetitionResource($this->whenLoaded('competition')),
            'season' => new SeasonResource($this->whenLoaded('season')),
            'home_team' => new TeamResource($this->whenLoaded('homeTeam')),
            'away_team' => new TeamResource($this->whenLoaded('awayTeam')),
            'kickoff_at' => $this->kickoff_at?->toIso8601String(),
            'actual_started_at' => $this->actual_started_at?->toIso8601String(),
            'playback_open_override_at' => $this->playback_open_override_at?->toIso8601String(),
            'playback_close_override_at' => $this->playback_close_override_at?->toIso8601String(),
            'scheduled_date' => $this->scheduled_date?->toDateString(),
            'kickoff_precision' => $this->kickoff_precision,
            'kickoff_status' => $this->kickoff_status,
            'source_timezone' => $this->source_timezone,
            'source_matchday' => $this->source_matchday,
            'source_round_label' => $this->source_round_label,
            'source_verified_at' => $this->source_verified_at?->toIso8601String(),
            'verification_status' => $this->verification_status,
            'status' => $this->status->value,
            'home_score' => $this->home_score,
            'away_score' => $this->away_score,
            'minute' => $this->minute,
            'featured' => $this->featured,
            'published_at' => $this->published_at?->toIso8601String(),
            'visibility' => $this->visibility?->value,
            'seo_title' => $this->seo_title,
            'seo_description' => $this->seo_description,
            'notes' => $this->notes,
            'last_synced_at' => $this->last_synced_at?->toIso8601String(),
            'sync_status' => $this->sync_status,
            'manual_overrides' => $this->manual_overrides,
            'channels' => ChannelResource::collection($this->whenLoaded('channels')),
            'broadcasts' => MatchBroadcastResource::collection($this->whenLoaded('broadcasts')),
            'playback_window' => $playbackWindow,
        ];
    }
}
