<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminMatchRequest;
use App\Http\Requests\LiveControlRequest;
use App\Http\Resources\MatchResource;
use App\Models\GameMatch;
use App\Services\LiveMatchService;
use App\Services\MatchService;
use Illuminate\Http\Request;

class AdminMatchController extends Controller
{
    public function index(Request $request)
    {
        $matches = GameMatch::query()
            ->publicGraph()
            ->when($request->filled('search'), fn ($query) => $query->where('slug', 'like', '%'.$request->string('search').'%'))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('competition_id'), fn ($query) => $query->where('competition_id', $request->integer('competition_id')))
            ->when($request->filled('team_id'), fn ($query) => $query->where(fn ($teamQuery) => $teamQuery->where('home_team_id', $request->integer('team_id'))->orWhere('away_team_id', $request->integer('team_id'))))
            ->when($request->has('featured'), fn ($query) => $query->where('featured', $request->boolean('featured')))
            ->orderByRaw('COALESCE(kickoff_at, scheduled_date) DESC')
            ->paginate((int) min($request->integer('per_page', 20), 100));

        return MatchResource::collection($matches);
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
            'action' => ['required', 'in:publish,unpublish,feature,unfeature,delete'],
        ]);

        return response()->json(['data' => ['updated' => $service->bulk($validated['ids'], $validated['action'], $request->user())]]);
    }
}
