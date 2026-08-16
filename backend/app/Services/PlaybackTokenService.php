<?php

namespace App\Services;

use App\Models\GameMatch;
use App\Models\StreamSource;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class PlaybackTokenService
{
    public function issue(GameMatch $match, StreamSource $source): string
    {
        $token = Str::random(48);
        $ttl = now()->addMinutes((int) config('rifitv.media_gateway.token_ttl_minutes', 10));

        Cache::put($this->key($token), [
            'source_id' => $source->id,
            'match_id' => $match->id,
            'expires_at' => $ttl->toIso8601String(),
        ], $ttl);

        return $token;
    }

    public function resolve(string $token): ?array
    {
        $payload = Cache::get($this->key($token));

        if (! is_array($payload)) {
            return null;
        }

        return $payload;
    }

    public function forget(string $token): void
    {
        Cache::forget($this->key($token));
    }

    private function key(string $token): string
    {
        return 'playback:token:'.$token;
    }
}
