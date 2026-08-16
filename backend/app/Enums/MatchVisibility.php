<?php

namespace App\Enums;

enum MatchVisibility: string
{
    case Public = 'public';
    case Internal = 'internal';
    case ManualOnly = 'manual_only';

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $visibility): string => $visibility->value, self::cases());
    }
}
