<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CompetitionResource;
use App\Http\Resources\MatchResource;
use App\Http\Resources\PublicChannelResource;
use App\Http\Resources\TeamResource;
use App\Models\Channel;
use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\Team;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __invoke(Request $request)
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:80'],
        ]);

        $query = trim($validated['q']);

        return response()->json(['data' => [
            'teams' => TeamResource::collection(Team::query()
                ->where('active', true)
                ->where(fn ($builder) => $builder
                    ->where('name', 'like', "%{$query}%")
                    ->orWhere('short_name', 'like', "%{$query}%")
                    ->orWhere('aliases', 'like', "%{$query}%"))
                ->orderByDesc('featured')
                ->orderBy('name')
                ->limit(8)
                ->get()),
            'matches' => MatchResource::collection(GameMatch::query()
                ->publicGraph()
                ->published()
                ->where(fn ($matchQuery) => $matchQuery
                    ->whereHas('homeTeam', fn ($builder) => $builder->where('name', 'like', "%{$query}%")->orWhere('aliases', 'like', "%{$query}%"))
                    ->orWhereHas('awayTeam', fn ($teamQuery) => $teamQuery->where('name', 'like', "%{$query}%")->orWhere('aliases', 'like', "%{$query}%"))
                    ->orWhereHas('competition', fn ($competitionQuery) => $competitionQuery->where('name', 'like', "%{$query}%")))
                ->orderByRaw('COALESCE(kickoff_at, scheduled_date)')
                ->limit(8)
                ->get()),
            'competitions' => CompetitionResource::collection(Competition::query()
                ->where('active', true)
                ->where(fn ($builder) => $builder->where('name', 'like', "%{$query}%")->orWhere('short_name', 'like', "%{$query}%"))
                ->orderBy('sort_order')
                ->limit(8)
                ->get()),
            'channels' => PublicChannelResource::collection(Channel::query()
                ->where('active', true)
                ->where(fn ($builder) => $builder
                    ->where('name', 'like', "%{$query}%")
                    ->orWhere('canonical_name', 'like', "%{$query}%")
                    ->orWhere('language', 'like', "%{$query}%"))
                ->orderBy('sort_order')
                ->orderBy('name')
                ->limit(8)
                ->get()),
        ]]);
    }
}
