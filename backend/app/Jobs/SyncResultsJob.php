<?php

namespace App\Jobs;

use App\Services\ResultSyncService;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SyncResultsJob implements ShouldQueue
{
    use Queueable;

    public function handle(ResultSyncService $service): void
    {
        $service->sync(CarbonImmutable::now('UTC')->subDay(), CarbonImmutable::now('UTC')->addDay());
    }
}
