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
}
