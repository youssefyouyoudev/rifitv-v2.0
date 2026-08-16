<?php

namespace App\Services;

use App\Enums\MatchStatus;
use App\Models\GameMatch;
use Illuminate\Support\Carbon;

class PlaybackWindowService
{
    /** @return array{status:string,server_time:string,kickoff_at:?string,actual_started_at:?string,opens_at:?string,closes_at:?string,seconds_until_open:?int,seconds_until_kickoff:?int,seconds_until_close:?int,open_before_minutes:int,duration_minutes:int} */
    public function stateFor(GameMatch $match, ?Carbon $now = null): array
    {
        $now ??= now();
        $openBefore = (int) config('rifitv.playback_open_before_minutes', 10);
        $duration = (int) config('rifitv.playback_duration_minutes', 120);

        if (in_array($match->status, [MatchStatus::Postponed, MatchStatus::Cancelled], true)) {
            return $this->payload($match, 'unavailable', $now, null, null, $openBefore, $duration);
        }

        if ($match->kickoff_precision !== 'confirmed' || ! $match->kickoff_at) {
            return $this->payload($match, 'tbc', $now, null, null, $openBefore, $duration);
        }

        $kickoff = Carbon::parse($match->kickoff_at);
        $opensAt = $match->playback_open_override_at
            ? Carbon::parse($match->playback_open_override_at)
            : $kickoff->copy()->subMinutes($openBefore);
        $startedAt = $match->actual_started_at ? Carbon::parse($match->actual_started_at) : $kickoff;
        $closesAt = $match->playback_close_override_at
            ? Carbon::parse($match->playback_close_override_at)
            : $startedAt->copy()->addMinutes($duration);

        $status = match (true) {
            $now->lt($opensAt) && $now->diffInMinutes($opensAt, false) <= 30 => 'opening_soon',
            $now->lt($opensAt) => 'locked',
            $now->gte($closesAt) => 'ended',
            default => 'open',
        };

        return $this->payload($match, $status, $now, $opensAt, $closesAt, $openBefore, $duration);
    }

    public function canExposeSources(GameMatch $match, ?Carbon $now = null): bool
    {
        return $this->stateFor($match, $now)['status'] === 'open';
    }

    /** @return array{status:string,server_time:string,kickoff_at:?string,actual_started_at:?string,opens_at:?string,closes_at:?string,seconds_until_open:?int,seconds_until_kickoff:?int,seconds_until_close:?int,open_before_minutes:int,duration_minutes:int} */
    private function payload(GameMatch $match, string $status, Carbon $now, ?Carbon $opensAt, ?Carbon $closesAt, int $openBefore, int $duration): array
    {
        $kickoff = $match->kickoff_at ? Carbon::parse($match->kickoff_at) : null;
        $actualStartedAt = $match->actual_started_at ? Carbon::parse($match->actual_started_at) : null;

        return [
            'status' => $status,
            'server_time' => $now->toIso8601String(),
            'kickoff_at' => $kickoff?->toIso8601String(),
            'actual_started_at' => $actualStartedAt?->toIso8601String(),
            'opens_at' => $opensAt?->toIso8601String(),
            'closes_at' => $closesAt?->toIso8601String(),
            'seconds_until_open' => $opensAt ? max(0, $now->diffInSeconds($opensAt, false)) : null,
            'seconds_until_kickoff' => $kickoff ? max(0, $now->diffInSeconds($kickoff, false)) : null,
            'seconds_until_close' => $closesAt ? max(0, $now->diffInSeconds($closesAt, false)) : null,
            'open_before_minutes' => $openBefore,
            'duration_minutes' => $duration,
        ];
    }
}
