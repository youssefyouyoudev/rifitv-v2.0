<?php

namespace App\Http\Resources;

use App\Enums\MatchStatus;
use App\Enums\MatchVisibility;
use App\Models\Channel;
use App\Services\MatchDateWindowService;
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
            'status_label' => $this->status->label(),
            'status_rank' => $this->status->scheduleRank(),
            'home_score' => $this->home_score,
            'away_score' => $this->away_score,
            'minute' => $this->minute,
            'featured' => $this->featured,
            'published_at' => $this->published_at?->toIso8601String(),
            'visibility' => $this->visibility?->value,
            'publication' => $this->publicationState(),
            'seo_title' => $this->seo_title,
            'seo_description' => $this->seo_description,
            'notes' => $this->notes,
            'last_synced_at' => $this->last_synced_at?->toIso8601String(),
            'sync_status' => $this->sync_status,
            'manual_overrides' => $this->manual_overrides,
            'stream_available_from' => $playbackWindow['opens_at'],
            'stream_closes_at' => $playbackWindow['closes_at'],
            'channels_count' => $this->whenCounted('channels'),
            'channels' => ChannelResource::collection($this->whenLoaded('channels')),
            'broadcasts' => MatchBroadcastResource::collection($this->whenLoaded('broadcasts')),
            'playback_window' => $playbackWindow,
            'admin' => [
                'verification_label' => $this->verificationLabel(),
                'stream_summary' => $this->streamSummary(),
                'warnings' => $this->warnings(),
            ],
        ];
    }

    private function verificationLabel(): string
    {
        return match ((string) $this->verification_status) {
            'verified', 'manual_verified' => 'Verified',
            'pending_verification' => 'Pending verification',
            default => 'Needs review',
        };
    }

    /** @return array{status:string,label:string,publicly_visible:bool,block_reason:?string} */
    private function publicationState(): array
    {
        $published = $this->published_at !== null;
        $public = $this->visibility === MatchVisibility::Public;
        $verified = in_array((string) $this->verification_status, ['verified', 'manual_verified'], true);
        $publiclyVisible = $published && $public && $verified;
        $status = ! $published ? 'draft' : ($public ? 'published' : 'hidden');
        $blockReason = $publiclyVisible ? null : ($published && $public && ! $verified ? 'verification_pending' : null);

        return [
            'status' => $status,
            'label' => match ($status) {
                'published' => $blockReason ? 'Published, awaiting verification' : 'Published',
                'hidden' => 'Hidden',
                default => 'Draft',
            },
            'publicly_visible' => $publiclyVisible,
            'block_reason' => $blockReason,
        ];
    }

    /** @return array<string,int> */
    private function streamSummary(): array
    {
        if (! $this->resource->relationLoaded('channels')) {
            return [
                'channels' => (int) ($this->channels_count ?? 0),
                'sources' => 0,
                'enabled_sources' => 0,
                'healthy_sources' => 0,
            ];
        }

        $sources = $this->channels->flatMap(fn (Channel $channel) => $channel->relationLoaded('streamSources') ? $channel->streamSources : collect());

        return [
            'channels' => $this->channels->count(),
            'sources' => $sources->count(),
            'enabled_sources' => $sources->where('enabled', true)->count(),
            'healthy_sources' => $sources->where('last_known_status.value', 'healthy')->count(),
        ];
    }

    /** @return list<string> */
    private function warnings(): array
    {
        $warnings = [];
        $summary = $this->streamSummary();
        $now = now();
        $dateWindow = app(MatchDateWindowService::class);
        $today = $dateWindow->today();
        $matchDate = $this->kickoff_at
            ? $dateWindow->dateForInstant($this->kickoff_at)
            : $this->scheduled_date?->toDateString();

        if ($this->kickoff_at && $this->status === MatchStatus::Scheduled && $now->lte($this->kickoff_at) && $now->diffInMinutes($this->kickoff_at, false) <= 30 && $summary['channels'] === 0) {
            $warnings[] = 'Match starts in 30 min but has no channel';
        }

        if ($this->kickoff_at && $this->status === MatchStatus::Scheduled && $now->lte($this->kickoff_at) && $now->diffInMinutes($this->kickoff_at, false) <= 30 && $summary['channels'] > 0 && $summary['healthy_sources'] === 0) {
            $warnings[] = 'Match starts in 30 min but has no healthy stream';
        }

        if (in_array($this->status, [MatchStatus::Live, MatchStatus::Halftime], true) && $summary['healthy_sources'] === 0) {
            $warnings[] = 'Match is live but no healthy stream source exists';
        }

        if ($this->verification_status === 'pending_verification' && $matchDate === $today) {
            $warnings[] = 'Fixture pending verification';
        } elseif ($matchDate === $today && ! in_array((string) $this->verification_status, ['verified', 'manual_verified', 'pending_verification'], true)) {
            $warnings[] = 'Fixture needs review';
        }

        if ($this->kickoff_at && $this->scheduled_date) {
            $localDate = $this->kickoff_at->copy()->timezone((string) config('rifitv.display_timezone', 'Africa/Casablanca'))->toDateString();
            if ($localDate !== $this->scheduled_date->toDateString()) {
                $warnings[] = 'Kickoff date conflicts with verified source';
            }
        }

        return $warnings;
    }
}
