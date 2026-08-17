<?php

namespace App\Services;

use App\Enums\MatchStatus;
use App\Models\GameMatch;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class LiveMatchService
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly PublicContentService $content,
    ) {}

    public function update(GameMatch $match, array $data, ?User $actor): GameMatch
    {
        $before = $match->only(['status', 'home_score', 'away_score', 'minute', 'featured', 'actual_started_at', 'playback_open_override_at', 'playback_close_override_at']);
        $nextStatus = MatchStatus::from($data['status'] ?? $match->status->value);

        if (! $this->canTransition($match->status, $nextStatus) && ! ($data['override_transition'] ?? false)) {
            throw ValidationException::withMessages(['status' => ['That status change is not normally allowed. Use override for real-world exceptions.']]);
        }

        $payload = [
            'home_score' => max(0, (int) ($data['home_score'] ?? $match->home_score ?? 0)),
            'away_score' => max(0, (int) ($data['away_score'] ?? $match->away_score ?? 0)),
            'minute' => isset($data['minute']) ? max(0, min(130, (int) $data['minute'])) : $match->minute,
            'status' => $nextStatus,
            'featured' => $data['featured'] ?? $match->featured,
        ];

        if (in_array($nextStatus, [MatchStatus::Live, MatchStatus::Halftime], true) && ! $match->actual_started_at) {
            $payload['actual_started_at'] = now();
        }

        $this->applyPlaybackAction($match, $payload, $data['playback_action'] ?? null);
        $match->update($payload);

        $this->audit->record($actor, 'match.live_control_updated', $match, ['before' => $before]);
        $this->content->forgetHome();

        return $match->fresh(['competition', 'homeTeam', 'awayTeam', 'channels.streamSources', 'broadcasts.broadcaster', 'broadcasts.channel']);
    }

    private function applyPlaybackAction(GameMatch $match, array &$payload, ?string $action): void
    {
        if (! $action) {
            return;
        }

        $now = now();
        $baseClose = Carbon::parse($match->playback_close_override_at ?? $match->actual_started_at ?? $match->kickoff_at ?? $now)
            ->max($now);

        match ($action) {
            'open_now' => $payload['playback_open_override_at'] = $now,
            'close_now' => $payload['playback_close_override_at'] = $now,
            'extend_15' => $payload['playback_close_override_at'] = $baseClose->copy()->addMinutes(15),
            'extend_30' => $payload['playback_close_override_at'] = $baseClose->copy()->addMinutes(30),
            'reopen_30' => [
                $payload['playback_open_override_at'] = $now,
                $payload['playback_close_override_at'] = $now->copy()->addMinutes(30),
            ],
            default => null,
        };
    }

    public function canTransition(MatchStatus $from, MatchStatus $to): bool
    {
        if ($from === $to) {
            return true;
        }

        $allowed = [
            MatchStatus::Scheduled->value => [MatchStatus::Live, MatchStatus::Postponed, MatchStatus::Cancelled],
            MatchStatus::Live->value => [MatchStatus::Halftime, MatchStatus::Finished, MatchStatus::Postponed],
            MatchStatus::Halftime->value => [MatchStatus::Live, MatchStatus::Finished],
            MatchStatus::Finished->value => [MatchStatus::Live],
            MatchStatus::Postponed->value => [MatchStatus::Scheduled, MatchStatus::Live, MatchStatus::Cancelled],
            MatchStatus::Cancelled->value => [MatchStatus::Scheduled],
        ];

        return in_array($to, $allowed[$from->value] ?? [], true);
    }
}
