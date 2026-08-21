<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\FixtureImportLogResource;
use App\Http\Resources\MatchResource;
use App\Http\Resources\OperationalAlertResource;
use App\Http\Resources\StreamSourceResource;
use App\Http\Resources\SyncRunResource;
use App\Jobs\RefreshHomepageCacheJob;
use App\Jobs\SyncFixturesJob;
use App\Jobs\SyncResultsJob;
use App\Models\FixtureImportLog;
use App\Models\GameMatch;
use App\Models\OperationalAlert;
use App\Models\StreamHealthCheck;
use App\Models\StreamSource;
use App\Models\SyncRun;
use App\Services\MatchDateWindowService;
use App\Services\StreamHealthService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AdminOperationsController extends Controller
{
    public function today(Request $request, MatchDateWindowService $dateWindow)
    {
        abort_unless($request->user()?->hasPermission('alerts.view') || $request->user()?->hasPermission('matches.manage'), 403);
        $now = now();
        $today = $dateWindow->today();
        $matches = GameMatch::query()
            ->publicGraph()
            ->onLocalDate($today)
            ->scheduleOrder()
            ->get();

        return response()->json(['data' => [
            'live' => MatchResource::collection($matches->filter(fn (GameMatch $match): bool => in_array($match->status->value, ['live', 'halftime'], true))->values()),
            'starting_soon' => MatchResource::collection($matches->filter(fn (GameMatch $match): bool => $match->status->value === 'scheduled' && $match->kickoff_at !== null && $match->kickoff_at->between($now, $now->copy()->addHours(2)))->values()),
            'later_today' => MatchResource::collection($matches->filter(fn (GameMatch $match): bool => $match->status->value === 'scheduled' && ($match->kickoff_at === null || $match->kickoff_at->gt($now->copy()->addHours(2))))->values()),
            'finished' => MatchResource::collection($matches->filter(fn (GameMatch $match): bool => $match->status->value === 'finished')->values()),
            'readiness' => $matches->mapWithKeys(fn (GameMatch $match): array => [$match->id => $this->readiness($match, $today, $now, $dateWindow)]),
        ]]);
    }

    public function streamHealth(Request $request)
    {
        abort_unless($request->user()?->hasPermission('health.view') || $request->user()?->hasPermission('streams.manage'), 403);

        return StreamSourceResource::collection(StreamSource::query()->with('channel')->orderBy('channel_id')->orderBy('priority')->get());
    }

    public function alerts(Request $request)
    {
        abort_unless($request->user()?->hasPermission('alerts.view'), 403);

        return OperationalAlertResource::collection(OperationalAlert::query()->where('status', 'open')->latest()->paginate(50));
    }

    public function syncRuns(Request $request)
    {
        abort_unless($request->user()?->hasPermission('sync.view'), 403);

        return SyncRunResource::collection(SyncRun::query()->latest('started_at')->paginate(50));
    }

    public function fixtureImports(Request $request)
    {
        abort_unless($request->user()?->hasPermission('sync.view'), 403);

        return FixtureImportLogResource::collection(FixtureImportLog::query()->latest()->paginate(50));
    }

    public function queueHealth(Request $request)
    {
        abort_unless($request->user()?->hasPermission('sync.view'), 403);

        return response()->json(['data' => [
            'scheduler_last_seen_at' => Cache::get('rifitv:scheduler:last_seen_at'),
            'failed_jobs' => DB::table('failed_jobs')->count(),
            'pending_jobs' => DB::table('jobs')->count(),
            'last_fixture_sync' => new SyncRunResource(SyncRun::query()->where('type', 'fixtures')->latest('started_at')->first()),
            'last_result_sync' => new SyncRunResource(SyncRun::query()->where('type', 'results')->latest('started_at')->first()),
            'last_stream_check' => StreamHealthCheck::query()->latest('checked_at')->value('checked_at'),
        ]]);
    }

    public function run(Request $request, StreamHealthService $streamHealth)
    {
        abort_unless($request->user()?->hasPermission('automation.manage'), 403);
        $validated = $request->validate(['action' => ['required', 'in:sync_fixtures,sync_results,check_streams,refresh_homepage']]);

        match ($validated['action']) {
            'sync_fixtures' => SyncFixturesJob::dispatch(),
            'sync_results' => SyncResultsJob::dispatch(),
            'check_streams' => $streamHealth->dispatchEnabledChecks(onlyDue: false),
            'refresh_homepage' => RefreshHomepageCacheJob::dispatch(),
        };

        return response()->json(['data' => ['message' => 'Operation queued']]);
    }

    private function readiness(GameMatch $match, string $today, Carbon $now, MatchDateWindowService $dateWindow): array
    {
        $sources = $match->channels->flatMap->streamSources->filter(fn (StreamSource $source): bool => (bool) $source->enabled);
        $healthy = $sources->contains(fn (StreamSource $source): bool => $source->last_known_status->value === 'healthy');
        $sourceCount = $sources->count();
        $isLive = in_array($match->status->value, ['live', 'halftime'], true);
        $startsSoon = $match->status->value === 'scheduled'
            && $match->kickoff_at !== null
            && $match->kickoff_at->between($now, $now->copy()->addMinutes(30));
        $startsToday = $match->kickoff_at === null
            ? $match->scheduled_date?->toDateString() === $today
            : $dateWindow->dateForInstant($match->kickoff_at) === $today;

        return [
            'state' => $isLive && ! $healthy
                ? 'critical'
                : (($startsSoon && ! $healthy) || ($startsToday && $match->channels->isEmpty())
                    ? 'warning'
                    : ($healthy ? 'ready' : 'normal')),
            'published' => (bool) $match->published_at,
            'channels' => $match->channels->count(),
            'healthy_source' => $healthy,
            'source_count' => $sourceCount,
        ];
    }
}
