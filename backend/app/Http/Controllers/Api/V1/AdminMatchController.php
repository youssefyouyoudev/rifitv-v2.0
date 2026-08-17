<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminMatchRequest;
use App\Http\Requests\LiveControlRequest;
use App\Http\Resources\MatchResource;
use App\Models\GameMatch;
use App\Services\LiveMatchService;
use App\Services\MatchScheduleService;
use App\Services\MatchService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminMatchController extends Controller
{
    public function index(Request $request, MatchScheduleService $schedule)
    {
        $matches = $schedule->adminQuery($request)
            ->paginate((int) min($request->integer('per_page', 20), 100));

        return MatchResource::collection($matches)->additional([
            'admin_meta' => $schedule->adminMeta($request),
        ]);
    }

    public function store(AdminMatchRequest $request, MatchService $service)
    {
        return new MatchResource($service->create($request->validated(), $request->user()));
    }

    public function show(GameMatch $match)
    {
        return new MatchResource($match->load(['competition', 'season', 'homeTeam', 'awayTeam', 'channels.streamSources', 'broadcasts.broadcaster', 'broadcasts.channel']));
    }

    public function update(AdminMatchRequest $request, GameMatch $match, MatchService $service)
    {
        return new MatchResource($service->update($match, $request->validated(), $request->user()));
    }

    public function destroy(Request $request, GameMatch $match, MatchService $service)
    {
        $service->archive($match, $request->user());

        return response()->json(['data' => ['message' => 'Match archived']]);
    }

    public function duplicate(Request $request, GameMatch $match, MatchService $service)
    {
        abort_unless($request->user()?->hasPermission('matches.manage'), 403);

        return new MatchResource($service->duplicate($match->load(['homeTeam', 'awayTeam', 'channels']), $request->user()));
    }

    public function liveControl(LiveControlRequest $request, GameMatch $match, LiveMatchService $service)
    {
        return new MatchResource($service->update($match, $request->validated(), $request->user()));
    }

    public function bulk(Request $request, MatchService $service)
    {
        abort_unless($request->user()?->hasPermission('matches.manage'), 403);
        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'exists:matches,id'],
            'action' => ['required', 'in:publish,unpublish,feature,unfeature,verify,assign_competition,set_status,delete'],
            'competition_id' => ['required_if:action,assign_competition', 'integer', 'exists:competitions,id'],
            'status' => ['required_if:action,set_status', Rule::in(['scheduled', 'live', 'halftime', 'finished', 'postponed', 'cancelled'])],
            'confirm_delete' => ['required_if:action,delete', 'accepted'],
        ]);

        return response()->json(['data' => ['updated' => $service->bulk($validated['ids'], $validated['action'], $request->user(), $validated)]]);
    }
}
