<?php

namespace App\Enums;

enum MatchStatus: string
{
    case Scheduled = 'scheduled';
    case Live = 'live';
    case Halftime = 'halftime';
    case Finished = 'finished';
    case Postponed = 'postponed';
    case Cancelled = 'cancelled';

    public function isWatchable(): bool
    {
        return in_array($this, [self::Live, self::Halftime], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Scheduled => 'Scheduled',
            self::Live => 'Live',
            self::Halftime => 'Halftime',
            self::Finished => 'Finished',
            self::Postponed => 'Postponed',
            self::Cancelled => 'Cancelled',
        };
    }

    public function scheduleRank(): int
    {
        return match ($this) {
            self::Live => 0,
            self::Halftime => 1,
            self::Scheduled => 2,
            self::Finished => 3,
            self::Postponed => 4,
            self::Cancelled => 5,
        };
    }
}
