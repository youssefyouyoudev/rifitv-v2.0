<?php

namespace App\Services;

use App\Models\GameMatch;
use App\Models\SyncRun;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;

class ResultSyncService
{
    public function __construct(
        private readonly FootballProviderManager $providers,
        private readonly StatusNormalizer $statuses,
        private readonly PublicContentService $content,
    ) {}

    public function sync(CarbonImmutable $from, CarbonImmutable $to): SyncRun
    {
        return Cache::lock('rifitv:result-sync', 120)->block(2, function () use ($from, $to): SyncRun {
            $provider = $this->providers->provider();
            $run = SyncRun::query()->create(['type' => 'results', 'provider' => $provider->name(), 'started_at' => now(), 'status' => 'running']);

            foreach ($provider->getResults($from, $to)->merge($provider->getLiveFixtures()) as $fixture) {
                $match = GameMatch::query()->where('provider', $fixture->provider)->where('external_id', $fixture->externalId)->first();
                if (! $match) {
                    $run->increment('ignored_count');

                    continue;
                }

                $match->fill([
                    'status' => $match->hasManualOverride('status') ? $match->status : $this->statuses->normalize($fixture->statusCode),
                    'home_score' => $match->hasManualOverride('score') ? $match->home_score : $fixture->homeScore,
                    'away_score' => $match->hasManualOverride('score') ? $match->away_score : $fixture->awayScore,
                    'minute' => $match->hasManualOverride('score') ? $match->minute : $fixture->minute,
                    'last_synced_at' => now(),
                    'sync_status' => 'synced',
                ])->save();
                $run->increment('updated_count');
            }

            $run->update(['status' => 'succeeded', 'finished_at' => now()]);
            $this->content->forgetHome();

            return $run->fresh();
        });
    }
}
