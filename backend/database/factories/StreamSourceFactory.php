<?php

namespace Database\Factories;

use App\Enums\StreamHealth;
use App\Enums\StreamProtocol;
use App\Models\Channel;
use App\Models\StreamSource;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<StreamSource> */
class StreamSourceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'channel_id' => Channel::factory(),
            'name' => 'Primary',
            'protocol' => StreamProtocol::Hls,
            'url' => 'http://localhost:8080/dev/stream.m3u8',
            'priority' => 10,
            'enabled' => true,
            'is_backup' => false,
            'last_known_status' => StreamHealth::Healthy,
            'last_checked_at' => now(),
            'latency_ms' => 40,
            'last_success_at' => now(),
            'consecutive_failures' => 0,
            'consecutive_successes' => 3,
            'health_score' => 95,
            'last_error_type' => null,
        ];
    }
}
