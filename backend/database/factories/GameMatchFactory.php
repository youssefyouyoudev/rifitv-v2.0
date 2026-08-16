<?php

namespace Database\Factories;

use App\Enums\MatchStatus;
use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<GameMatch> */
class GameMatchFactory extends Factory
{
    public function definition(): array
    {
        $kickoff = fake()->dateTimeBetween('-2 days', '+10 days');

        return [
            'competition_id' => Competition::factory(),
            'provider' => null,
            'external_id' => null,
            'source_provider' => 'manual-test',
            'source_external_id' => (string) fake()->uuid(),
            'source_verified_at' => now(),
            'source_hash' => hash('sha256', fake()->uuid()),
            'verification_status' => 'manual_verified',
            'last_synced_at' => null,
            'sync_status' => null,
            'manual_overrides' => null,
            'home_team_id' => Team::factory(),
            'away_team_id' => Team::factory(),
            'kickoff_at' => $kickoff,
            'kickoff_status' => 'confirmed',
            'status' => MatchStatus::Scheduled,
            'home_score' => null,
            'away_score' => null,
            'minute' => null,
            'featured' => false,
            'published_at' => now(),
            'visibility' => 'public',
            'slug' => Str::slug(fake()->unique()->sentence(5)),
        ];
    }
}
