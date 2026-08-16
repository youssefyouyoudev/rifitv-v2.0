<?php

namespace App\Enums;

enum CompetitionSelectionMode: string
{
    case AllMatches = 'all_matches';
    case FeaturedTeamsOnly = 'featured_teams_only';
    case ManualOnly = 'manual_only';

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $mode): string => $mode->value, self::cases());
    }
}
