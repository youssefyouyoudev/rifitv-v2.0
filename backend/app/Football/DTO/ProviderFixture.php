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
        public readonly string $homeExternalId,
        public readonly string $homeName,
        public readonly string $awayExternalId,
        public readonly string $awayName,
        public readonly CarbonImmutable $kickoffAt,
        public readonly string $statusCode,
        public readonly ?int $homeScore = null,
        public readonly ?int $awayScore = null,
        public readonly ?int $minute = null,
    ) {}
}
