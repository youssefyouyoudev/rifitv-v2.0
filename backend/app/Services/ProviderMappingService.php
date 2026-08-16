<?php

namespace App\Services;

use App\Football\DTO\ProviderFixture;
use App\Models\Competition;
use App\Models\CompetitionProviderMapping;
use App\Models\Team;
use App\Models\TeamProviderMapping;

class ProviderMappingService
{
    public function competitionFor(ProviderFixture $fixture): ?Competition
    {
        return CompetitionProviderMapping::query()
            ->where('provider', $fixture->provider)
            ->where('external_id', $fixture->competitionExternalId)
            ->first()
            ?->competition;
    }

    public function teamFor(string $provider, string $externalId): ?Team
    {
        return TeamProviderMapping::query()
            ->where('provider', $provider)
            ->where('external_id', $externalId)
            ->first()
            ?->team;
    }
}
