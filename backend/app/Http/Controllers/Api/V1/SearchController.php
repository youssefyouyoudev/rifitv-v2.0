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
        $terms = $this->terms($query);

        return response()->json(['data' => [
            'teams' => TeamResource::collection(Team::query()
                ->where('active', true)
                ->where(fn ($builder) => $builder
                    ->where(fn ($termQuery) => collect($terms)->each(fn (string $term) => $termQuery
                        ->orWhere('name', 'like', "%{$term}%")
                        ->orWhere('short_name', 'like', "%{$term}%")
                        ->orWhere('aliases', 'like', "%{$term}%"))))
                ->orderByDesc('featured')
                ->orderBy('name')
                ->limit(8)
                ->get()),
            'matches' => MatchResource::collection(GameMatch::query()
                ->publicGraph()
                ->published()
                ->where(fn ($matchQuery) => $matchQuery
                    ->whereHas('homeTeam', fn ($builder) => $builder->where(fn ($termQuery) => collect($terms)->each(fn (string $term) => $termQuery->orWhere('name', 'like', "%{$term}%")->orWhere('aliases', 'like', "%{$term}%"))))
                    ->orWhereHas('awayTeam', fn ($teamQuery) => $teamQuery->where(fn ($termQuery) => collect($terms)->each(fn (string $term) => $termQuery->orWhere('name', 'like', "%{$term}%")->orWhere('aliases', 'like', "%{$term}%"))))
                    ->orWhereHas('competition', fn ($competitionQuery) => $competitionQuery->where(fn ($termQuery) => collect($terms)->each(fn (string $term) => $termQuery->orWhere('name', 'like', "%{$term}%")->orWhere('short_name', 'like', "%{$term}%")->orWhere('slug', 'like', "%{$term}%")))))
                ->orderByRaw('COALESCE(kickoff_at, scheduled_date)')
                ->limit(8)
                ->get()),
            'competitions' => CompetitionResource::collection(Competition::query()
                ->where('active', true)
                ->where(fn ($builder) => collect($terms)->each(fn (string $term) => $builder->orWhere('name', 'like', "%{$term}%")->orWhere('short_name', 'like', "%{$term}%")->orWhere('slug', 'like', "%{$term}%")))
                ->orderBy('sort_order')
                ->limit(8)
                ->get()),
            'channels' => PublicChannelResource::collection(Channel::query()
                ->where('active', true)
                ->where(fn ($builder) => $builder
                    ->where(fn ($termQuery) => collect($terms)->each(fn (string $term) => $termQuery
                        ->orWhere('name', 'like', "%{$term}%")
                        ->orWhere('canonical_name', 'like', "%{$term}%")
                        ->orWhere('language', 'like', "%{$term}%"))))
                ->orderBy('sort_order')
                ->orderBy('name')
                ->limit(8)
                ->get()),
        ]]);
    }

    /** @return list<string> */
    private function terms(string $query): array
    {
        $terms = [$query];
        $lower = mb_strtolower($query);

        if (str_contains($lower, 'bundesliga') || str_contains($lower, 'german') || str_contains($lower, 'الألماني') || str_contains($lower, 'الالماني')) {
            array_push($terms, 'Bundesliga', 'German Super Cup', 'german-super-cup');
        }

        if (str_contains($lower, 'mbc') || str_contains($lower, 'إم بي سي') || str_contains($lower, 'ام بي سي')) {
            array_push($terms, 'MBC Action', 'mbc-action');
        }

        return array_values(array_unique($terms));
    }
}
