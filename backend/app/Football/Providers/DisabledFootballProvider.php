<?php

namespace App\Football\Providers;

use App\Football\Contracts\FootballDataProviderInterface;
use App\Football\DTO\ProviderFixture;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class DisabledFootballProvider implements FootballDataProviderInterface
{
    public function name(): string
    {
        return 'disabled';
    }

    /** @return Collection<int, ProviderFixture> */
    public function getFixtures(CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return collect();
    }

    /** @return Collection<int, ProviderFixture> */
    public function getLiveFixtures(): Collection
    {
        return collect();
    }

    /** @return Collection<int, ProviderFixture> */
    public function getResults(CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return collect();
    }
}
