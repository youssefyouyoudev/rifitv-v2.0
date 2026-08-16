<?php

namespace App\Football\Contracts;

use App\Football\DTO\ProviderFixture;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

interface FootballDataProviderInterface
{
    public function name(): string;

    /** @return Collection<int, ProviderFixture> */
    public function getFixtures(CarbonImmutable $from, CarbonImmutable $to): Collection;

    /** @return Collection<int, ProviderFixture> */
    public function getLiveFixtures(): Collection;

    /** @return Collection<int, ProviderFixture> */
    public function getResults(CarbonImmutable $from, CarbonImmutable $to): Collection;
}
