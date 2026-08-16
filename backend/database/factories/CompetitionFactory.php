<?php

namespace Database\Factories;

use App\Models\Competition;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Competition> */
class CompetitionFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->words(3, true);

        return [
            'name' => Str::headline($name),
            'slug' => Str::slug($name),
            'short_name' => Str::upper(Str::substr($name, 0, 4)),
            'logo_path' => null,
            'country_code' => fake()->optional()->countryCode(),
            'active' => true,
            'featured' => false,
            'selection_mode' => 'featured_teams_only',
            'sort_order' => fake()->numberBetween(1, 100),
        ];
    }
}
