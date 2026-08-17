<?php

namespace App\Jobs;

use App\Models\AnalyticsEvent;
use App\Models\OperationalAlert;
use App\Models\PlaybackEvent;
use App\Models\StreamHealthCheck;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CleanupOperationalDataJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        StreamHealthCheck::query()->where('checked_at', '<', now()->subDays((int) config('rifitv.stream_health.history_retention_days', 7)))->delete();
        PlaybackEvent::query()->where('occurred_at', '<', now()->subDays(7))->delete();
        AnalyticsEvent::query()->where('occurred_at', '<', now()->subDays(90))->delete();
        OperationalAlert::query()->where('status', 'resolved')->where('resolved_at', '<', now()->subDays(30))->delete();
    }
}
