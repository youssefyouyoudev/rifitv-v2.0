<?php

namespace App\Services;

use App\Models\SiteSetting;

class TimezoneService
{
    public function displayTimezone(): string
    {
        $value = SiteSetting::query()->where('key', 'display_timezone')->first()?->value;

        if (is_string($value) && $value !== '') {
            return $value;
        }

        return (string) config('rifitv.display_timezone', 'Africa/Casablanca');
    }
}
