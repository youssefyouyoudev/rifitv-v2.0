<?php

namespace App\Jobs;

use App\Models\GameMatch;
use App\Services\OperationalAlertService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DetectOperationalIssuesJob implements ShouldQueue
{
    use Queueable;

    public function handle(OperationalAlertService $alerts): void
    {
        $window = now()->addMinutes((int) config('rifitv.missing_broadcast_alert_minutes', 30));
        GameMatch::query()
            ->published()
            ->where('kickoff_at', '<=', $window)
            ->where('status', 'scheduled')
            ->doesntHave('channels')
            ->with(['homeTeam', 'awayTeam'])
            ->each(fn (GameMatch $match) => $alerts->open(
                'match_missing_broadcast',
                'missing-broadcast-'.$match->id,
                'warning',
                'Broadcast missing',
                $match->homeTeam->name.' vs '.$match->awayTeam->name.' starts soon.'
            ));
    }
}
