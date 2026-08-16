<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\MatchResource;
use App\Http\Resources\TeamResource;
use App\Models\GameMatch;
use App\Models\Team;

class TeamController extends Controller
{
    public function show(string $slug)
    {
        $team = Team::query()->where('slug', $slug)->firstOrFail();

        return response()->json([
            'data' => [
                'team' => new TeamResource($team),
                'live' => MatchResource::collection($this->matches($team)->whereIn('status', ['live', 'halftime'])->get()),
                'upcoming' => MatchResource::collection($this->matches($team)->where(fn ($query) => $query->where('kickoff_at', '>', now())->orWhere('scheduled_date', '>', now()->toDateString()))->where('status', 'scheduled')->limit(8)->get()),
                'recent_results' => MatchResource::collection($this->matches($team)->where('status', 'finished')->orderByRaw('COALESCE(kickoff_at, scheduled_date) DESC')->limit(8)->get()),
            ],
        ]);
    }

    private function matches(Team $team)
    {
        return GameMatch::query()
            ->published()
            ->publicGraph()
            ->where(fn ($query) => $query->where('home_team_id', $team->id)->orWhere('away_team_id', $team->id))
            ->orderByRaw('COALESCE(kickoff_at, scheduled_date)');
    }
}
