<?php

namespace App\Jobs;

use App\Services\FixtureSyncService;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SyncFixturesJob implements ShouldQueue
{
    use Queueable;

    public function handle(FixtureSyncService $service): void
    {
        $service->sync(CarbonImmutable::now('UTC'), CarbonImmutable::now('UTC')->addDays((int) config('rifitv.fixture_sync_horizon_days', 14)));
    }
}
