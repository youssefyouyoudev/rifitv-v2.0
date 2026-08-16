<?php

namespace Database\Factories;

use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Team> */
class TeamFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->city().' FC';

        return [
            'name' => $name,
            'slug' => Str::slug($name),
            'short_name' => Str::upper(Str::substr(Str::slug($name, ''), 0, 3)),
            'logo_path' => null,
            'country_code' => fake()->countryCode(),
            'primary_color' => fake()->hexColor(),
            'active' => true,
            'featured' => false,
        ];
    }
}
