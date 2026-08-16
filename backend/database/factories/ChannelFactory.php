<?php

namespace Database\Factories;

use App\Models\Channel;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Channel> */
class ChannelFactory extends Factory
{
    public function definition(): array
    {
        $name = 'RiFi Sports '.fake()->unique()->numberBetween(1, 999);

        return [
            'name' => $name,
            'slug' => Str::slug($name),
            'logo_path' => null,
            'country_code' => null,
            'language' => 'English',
            'category' => 'Sports',
            'active' => true,
            'sort_order' => fake()->numberBetween(1, 100),
        ];
    }
}
