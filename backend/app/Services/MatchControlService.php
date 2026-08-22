<?php

namespace App\Services;

use App\Enums\MatchStatus;
use App\Http\Resources\AuditLogResource;
use App\Http\Resources\MatchResource;
use App\Models\AuditLog;
use App\Models\Channel;
use App\Models\GameMatch;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class MatchControlService
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly PlaybackWindowService $playbackWindow,
        private readonly PublicContentService $content,
    ) {}

    public function payload(GameMatch $match): array
    {
        $match->loadMissing(['competition', 'season', 'homeTeam', 'awayTeam', 'channels.streamSources', 'broadcasts.broadcaster', 'broadcasts.channel']);

        return [
            'match' => new MatchResource($match),
            'playback_window' => $this->playbackWindow->stateFor($match),
            'assigned_channels' => $this->assignedChannels($match),
            'stream_summary' => $this->streamSummary($match),
            'audit_history' => AuditLogResource::collection(AuditLog::query()
                ->with('actor')
                ->where('entity_type', GameMatch::class)
                ->where('entity_id', $match->id)
                ->latest()
                ->limit(10)
                ->get()),
            'actions' => [
                'statuses' => array_column(MatchStatus::cases(), 'value'),
                'playback' => ['open_now', 'close_now', 'extend_15', 'extend_30', 'reopen_30'],
            ],
        ];
    }

    public function assignChannels(GameMatch $match, array $channelIds, ?User $actor): GameMatch
    {
        $nextSort = ((int) $match->channels()->max('match_channels.sort_order')) + 10;

        foreach (array_values($channelIds) as $channelId) {
            $channel = Channel::query()->whereKey($channelId)->where('active', true)->firstOrFail();

            if (! $match->channels()->whereKey($channel->id)->exists()) {
                $match->channels()->attach($channel->id, ['sort_order' => $nextSort]);
                $nextSort += 10;
            }
        }

        $this->audit->record($actor, 'match.channels_assigned', $match, ['channel_ids' => $channelIds]);

        return $match->fresh(['competition', 'season', 'homeTeam', 'awayTeam', 'channels.streamSources', 'broadcasts.broadcaster', 'broadcasts.channel']);
    }

    public function removeChannel(GameMatch $match, Channel $channel, ?User $actor): GameMatch
    {
        $match->channels()->detach($channel->id);
        $this->audit->record($actor, 'match.channel_removed', $match, ['channel_id' => $channel->id]);

        return $match->fresh(['competition', 'season', 'homeTeam', 'awayTeam', 'channels.streamSources', 'broadcasts.broadcaster', 'broadcasts.channel']);
    }

    public function promoteChannel(GameMatch $match, Channel $channel, ?User $actor): GameMatch
    {
        if (! $match->channels()->whereKey($channel->id)->exists()) {
            throw ValidationException::withMessages(['channel_id' => ['That channel is not assigned to this match.']]);
        }

        $orderedIds = $match->channels()->pluck('channels.id')->reject(fn (int $id): bool => $id === $channel->id)->prepend($channel->id)->values();

        foreach ($orderedIds as $index => $channelId) {
            $match->channels()->updateExistingPivot($channelId, ['sort_order' => ($index + 1) * 10]);
        }

        $this->audit->record($actor, 'match.channel_promoted', $match, ['channel_id' => $channel->id]);

        return $match->fresh(['competition', 'season', 'homeTeam', 'awayTeam', 'channels.streamSources', 'broadcasts.broadcaster', 'broadcasts.channel']);
    }

    public function playbackAction(GameMatch $match, string $action, ?User $actor): GameMatch
    {
        $now = now();
        $baseClose = Carbon::parse($match->playback_close_override_at ?? $match->actual_started_at ?? $match->kickoff_at ?? $now)->max($now);
        $payload = match ($action) {
            'open_now' => ['playback_open_override_at' => $now],
            'close_now' => ['playback_close_override_at' => $now],
            'extend_15' => ['playback_close_override_at' => $baseClose->copy()->addMinutes(15)],
            'extend_30' => ['playback_close_override_at' => $baseClose->copy()->addMinutes(30)],
            'reopen_30' => ['playback_open_override_at' => $now, 'playback_close_override_at' => $now->copy()->addMinutes(30)],
            default => throw ValidationException::withMessages(['action' => ['Unsupported playback action.']]),
        };

        $match->update($payload);
        $this->audit->record($actor, 'match.playback_'.$action, $match);

        return $match->fresh(['competition', 'season', 'homeTeam', 'awayTeam', 'channels.streamSources', 'broadcasts.broadcaster', 'broadcasts.channel']);
    }

    public function updateScore(GameMatch $match, array $data, ?User $actor): GameMatch
    {
        $before = $match->only(['home_score', 'away_score', 'minute']);
        $match->update([
            'home_score' => max(0, (int) $data['home_score']),
            'away_score' => max(0, (int) $data['away_score']),
            'minute' => isset($data['minute']) ? max(0, min(130, (int) $data['minute'])) : $match->minute,
        ]);
        $this->audit->record($actor, 'match.score_updated', $match, ['before' => $before]);

        return $match->fresh(['competition', 'season', 'homeTeam', 'awayTeam', 'channels.streamSources', 'broadcasts.broadcaster', 'broadcasts.channel']);
    }

    public function updateKickoff(GameMatch $match, array $data, ?User $actor): GameMatch
    {
        $timezone = (string) ($data['timezone'] ?? config('rifitv.display_timezone', 'Africa/Casablanca'));
        $kickoff = Carbon::parse((string) $data['kickoff_at'], $timezone);
        $manualOverrides = $match->manual_overrides ?? [];
        data_set($manualOverrides, 'kickoff_at', true);
        $before = $match->only(['kickoff_at', 'scheduled_date', 'kickoff_precision', 'kickoff_status', 'source_timezone']);

        $match->update([
            'kickoff_at' => $kickoff->copy()->utc(),
            'scheduled_date' => $kickoff->toDateString(),
            'kickoff_precision' => 'confirmed',
            'kickoff_status' => 'admin_override',
            'source_timezone' => $timezone,
            'manual_overrides' => $manualOverrides,
        ]);

        $this->audit->record($actor, 'match.kickoff_overridden', $match, [
            'before' => $before,
            'timezone' => $timezone,
            'reason' => $data['reason'] ?? null,
        ]);
        $this->content->forgetHome();

        return $match->fresh(['competition', 'season', 'homeTeam', 'awayTeam', 'channels.streamSources', 'broadcasts.broadcaster', 'broadcasts.channel']);
    }

    public function restoreProviderKickoff(GameMatch $match, ?User $actor): GameMatch
    {
        $manualOverrides = $match->manual_overrides ?? [];
        data_forget($manualOverrides, 'kickoff_at');
        $match->update(['manual_overrides' => $manualOverrides]);
        $this->audit->record($actor, 'match.kickoff_restore_provider', $match);
        $this->content->forgetHome();

        return $match->fresh(['competition', 'season', 'homeTeam', 'awayTeam', 'channels.streamSources', 'broadcasts.broadcaster', 'broadcasts.channel']);
    }

    /** @return list<array<string,mixed>> */
    private function assignedChannels(GameMatch $match): array
    {
        return $match->channels->values()->map(function (Channel $channel, int $index): array {
            $sources = $channel->streamSources;

            return [
                'id' => $channel->id,
                'name' => $channel->name,
                'logo_path' => $channel->logo_path,
                'role' => $index === 0 ? 'main' : 'backup',
                'sort_order' => $channel->pivot?->sort_order,
                'playlist_group' => $channel->playlist_group,
                'quality_label' => $channel->quality_label,
                'health' => [
                    'sources' => $sources->count(),
                    'enabled' => $sources->where('enabled', true)->count(),
                    'healthy' => $sources->where('last_known_status.value', 'healthy')->count(),
                    'offline' => $sources->where('last_known_status.value', 'offline')->count(),
                ],
                'stream_sources' => $sources->map(fn ($source): array => [
                    'id' => $source->id,
                    'name' => $source->name,
                    'protocol' => $source->protocol->value,
                    'priority' => $source->priority,
                    'enabled' => $source->enabled,
                    'is_backup' => $source->is_backup,
                    'last_known_status' => $source->last_known_status?->value,
                    'health_score' => $source->health_score,
                    'masked_url' => $this->maskUrl($source->url),
                ])->all(),
            ];
        })->all();
    }

    /** @return array<string,int> */
    private function streamSummary(GameMatch $match): array
    {
        $sources = $match->channels->flatMap(fn (Channel $channel) => $channel->streamSources);

        return [
            'channels' => $match->channels->count(),
            'sources' => $sources->count(),
            'enabled_sources' => $sources->where('enabled', true)->count(),
            'healthy_sources' => $sources->where('last_known_status.value', 'healthy')->count(),
            'offline_sources' => $sources->where('last_known_status.value', 'offline')->count(),
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
