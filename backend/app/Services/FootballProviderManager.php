<?php

namespace App\Services;

use App\Football\Contracts\FootballDataProviderInterface;
use App\Football\Providers\MockFootballProvider;

class FootballProviderManager
{
    public function provider(): FootballDataProviderInterface
    {
        return match (config('services.football.provider', 'mock')) {
            'mock' => new MockFootballProvider,
            default => new MockFootballProvider,
        };
    }
}
