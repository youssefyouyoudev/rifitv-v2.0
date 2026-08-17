<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\MatchResource;
use App\Http\Resources\OperationalAlertResource;
use App\Http\Resources\StreamSourceResource;
use App\Http\Resources\SyncRunResource;
use App\Models\Channel;
use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\OperationalAlert;
use App\Models\StreamSource;
use App\Models\SyncRun;
use App\Models\Team;
use App\Services\MatchScheduleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    public function __invoke(MatchScheduleService $schedule)
    {
        $attentionMatches = collect($schedule->attentionMatches(new Request))
            ->filter(fn (GameMatch $match): bool => $match->channels->isEmpty())
            ->values();
        $counterLabels = $schedule->counterLabels();

        return response()->json([
            'data' => [
                'counts' => $schedule->counters(),
                'counter_labels' => $counterLabels,
                'system_counts' => [
                    'stream_problems' => StreamSource::query()->whereIn('last_known_status', ['offline', 'degraded'])->count(),
                    'open_alerts' => OperationalAlert::query()->where('status', 'open')->count(),
                    'pending_jobs' => DB::table('jobs')->count(),
                    'failed_jobs' => DB::table('failed_jobs')->count(),
                    'unassigned_broadcasts' => GameMatch::query()->doesntHave('channels')->count(),
                    'matches' => GameMatch::query()->withTrashed()->count(),
                    'teams' => Team::query()->count(),
                    'competitions' => Competition::query()->count(),
                    'channels' => Channel::query()->count(),
                    'stream_sources' => StreamSource::query()->count(),
                ],
                'live_now' => MatchResource::collection(GameMatch::query()->publicGraph()->whereIn('status', ['live', 'halftime'])->orderByRaw('COALESCE(kickoff_at, scheduled_date)')->limit(6)->get()),
                'attention' => [
                    'alerts' => OperationalAlertResource::collection(OperationalAlert::query()->where('status', 'open')->latest()->limit(8)->get()),
                    'stream_problems' => StreamSourceResource::collection(StreamSource::query()->with('channel')->whereIn('last_known_status', ['offline', 'degraded'])->limit(8)->get()),
                    'unassigned_matches' => MatchResource::collection($attentionMatches),
                ],
                'operations' => [
                    'scheduler_last_seen_at' => Cache::get('rifitv:scheduler:last_seen_at'),
                    'last_fixture_sync' => new SyncRunResource(SyncRun::query()->where('type', 'fixtures')->latest('started_at')->first()),
                    'last_result_sync' => new SyncRunResource(SyncRun::query()->where('type', 'results')->latest('started_at')->first()),
                ],
            ],
        ]);
    }
}
