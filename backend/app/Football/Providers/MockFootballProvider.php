<?php

namespace App\Football\Providers;

use App\Football\Contracts\FootballDataProviderInterface;
use App\Football\DTO\ProviderFixture;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class MockFootballProvider implements FootballDataProviderInterface
{
    public function name(): string
    {
        return 'mock';
    }

    public function getFixtures(CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        $now = CarbonImmutable::now('UTC');

        return collect([
            new ProviderFixture('mock', 'mock-arsenal-liverpool', 'pl', 'Premier League', 'ars', 'Arsenal', 'liv', 'Liverpool', $now->addHours(2), 'NS'),
            new ProviderFixture('mock', 'mock-everton-fulham', 'pl', 'Premier League', 'eve', 'Everton', 'ful', 'Fulham', $now->addHours(4), 'NS'),
            new ProviderFixture('mock', 'mock-unknown-barca', 'laliga', 'La Liga', 'unknown-x', 'Unknown Team X', 'bar', 'Barcelona', $now->addHours(5), 'NS'),
            new ProviderFixture('mock', 'mock-real-atleti-live', 'laliga', 'La Liga', 'rma', 'Real Madrid', 'atm', 'Atletico Madrid', $now->subMinutes(20), '1H', 1, 0, 21),
        ])->filter(fn (ProviderFixture $fixture): bool => $fixture->kickoffAt->betweenIncluded($from, $to))->values();
    }

    public function getLiveFixtures(): Collection
    {
        return collect([
            new ProviderFixture('mock', 'mock-real-atleti-live', 'laliga', 'La Liga', 'rma', 'Real Madrid', 'atm', 'Atletico Madrid', CarbonImmutable::now('UTC')->subMinutes(30), '1H', 1, 0, 31),
        ]);
    }

    public function getResults(CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return collect([
            new ProviderFixture('mock', 'mock-real-atleti-live', 'laliga', 'La Liga', 'rma', 'Real Madrid', 'atm', 'Atletico Madrid', CarbonImmutable::now('UTC')->subHours(2), 'FT', 2, 1, null),
        ]);
    }
}
