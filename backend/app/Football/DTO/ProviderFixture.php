<?php

namespace App\Football\DTO;

use Carbon\CarbonImmutable;

class ProviderFixture
{
    public function __construct(
        public readonly string $provider,
        public readonly string $externalId,
        public readonly string $competitionExternalId,
        public readonly string $competitionName,
        public readonly string $competitionSlug,
        public readonly string $homeExternalId,
        public readonly string $homeTeamName,
        public readonly string $homeTeamSlug,
        public readonly string $awayExternalId,
        public readonly string $awayTeamName,
        public readonly string $awayTeamSlug,
        public readonly CarbonImmutable $kickoffAt,
        public readonly string $statusCode,
        public readonly ?int $homeScore,
        public readonly ?int $awayScore,
        public readonly ?int $minute
    ) {
    }
}