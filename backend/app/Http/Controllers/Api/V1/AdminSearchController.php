<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
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

        $teams = Team::query()
            ->where('name', 'like', "%{$query}%")
            ->limit(5)
            ->get()
            ->map(fn (Team $team): array => ['type' => 'Team', 'id' => $team->id, 'label' => $team->name, 'href' => '/admin/teams']);

        $matches = GameMatch::query()
            ->with(['homeTeam', 'awayTeam'])
            ->where('slug', 'like', "%{$query}%")
            ->limit(5)
            ->get()
            ->map(fn (GameMatch $match): array => [
                'type' => 'Match',
                'id' => $match->id,
                'label' => $match->homeTeam->name.' vs '.$match->awayTeam->name,
                'href' => '/admin/matches/'.$match->id,
            ]);

        return response()->json(['data' => $teams->concat($matches)->values()]);
    }
}
