<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\Competition;
use App\Models\GameMatch;
use App\Models\Team;
use Illuminate\Http\Request;

class AdminSearchController extends Controller
{
    public function __invoke(Request $request)
    {
        abort_unless($request->user()?->hasPermission('admin.search'), 403);
        $query = trim((string) $request->query('q', ''));

        if (mb_strlen($query) < 2) {
            return response()->json(['data' => []]);
        }

        $terms = $this->terms($query);

        $teams = Team::query()
            ->where(fn ($builder) => collect($terms)->each(fn (string $term) => $builder->orWhere('name', 'like', "%{$term}%")->orWhere('aliases', 'like', "%{$term}%")))
            ->limit(5)
            ->get()
            ->map(fn (Team $team): array => ['type' => 'Team', 'id' => $team->id, 'label' => $team->name, 'href' => '/admin/teams']);

        $matches = GameMatch::query()
            ->with(['homeTeam', 'awayTeam', 'competition'])
            ->where(fn ($builder) => collect($terms)->each(fn (string $term) => $builder
                ->orWhere('slug', 'like', "%{$term}%")
                ->orWhereHas('homeTeam', fn ($team) => $team->where('name', 'like', "%{$term}%")->orWhere('aliases', 'like', "%{$term}%"))
                ->orWhereHas('awayTeam', fn ($team) => $team->where('name', 'like', "%{$term}%")->orWhere('aliases', 'like', "%{$term}%"))
                ->orWhereHas('competition', fn ($competition) => $competition->where('name', 'like', "%{$term}%")->orWhere('short_name', 'like', "%{$term}%")->orWhere('slug', 'like', "%{$term}%"))))
            ->limit(5)
            ->get()
            ->map(fn (GameMatch $match): array => [
                'type' => 'Match',
                'id' => $match->id,
                'label' => $match->homeTeam->name.' vs '.$match->awayTeam->name,
                'href' => '/admin/matches/'.$match->id,
            ]);

        $competitions = Competition::query()
            ->where(fn ($builder) => collect($terms)->each(fn (string $term) => $builder->orWhere('name', 'like', "%{$term}%")->orWhere('short_name', 'like', "%{$term}%")->orWhere('slug', 'like', "%{$term}%")))
            ->limit(5)
            ->get()
            ->map(fn (Competition $competition): array => ['type' => 'Competition', 'id' => $competition->id, 'label' => $competition->name, 'href' => '/admin/matches']);

        $channels = Channel::query()
            ->where(fn ($builder) => collect($terms)->each(fn (string $term) => $builder->orWhere('name', 'like', "%{$term}%")->orWhere('canonical_name', 'like', "%{$term}%")))
            ->limit(5)
            ->get()
            ->map(fn (Channel $channel): array => ['type' => 'Channel', 'id' => $channel->id, 'label' => $channel->name, 'href' => '/admin/channels']);

        return response()->json(['data' => $teams->concat($matches)->concat($competitions)->concat($channels)->values()]);
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
