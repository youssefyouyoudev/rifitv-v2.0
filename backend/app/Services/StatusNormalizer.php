<?php

namespace App\Services;

use App\Enums\MatchStatus;

class StatusNormalizer
{
    public function normalize(string $providerCode): MatchStatus
    {
        return match (strtoupper($providerCode)) {
            'NS', 'TBD' => MatchStatus::Scheduled,
            '1H', '2H', 'LIVE', 'ET', 'P' => MatchStatus::Live,
            'HT' => MatchStatus::Halftime,
            'FT', 'AET', 'PEN' => MatchStatus::Finished,
            'PST', 'POSTPONED' => MatchStatus::Postponed,
            'CANC', 'CANCELLED' => MatchStatus::Cancelled,
            default => MatchStatus::Scheduled,
        };
    }
}
