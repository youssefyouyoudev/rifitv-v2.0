<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\MatchResource;
use App\Models\GameMatch;
use Illuminate\Http\Request;

class MatchController extends Controller
{
    public function index(Request $request)
    {
        $matches = GameMatch::query()
            ->published()
            ->publicGraph()
            ->when($request->string('status')->isNotEmpty(), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->string('competition')->isNotEmpty(), fn ($query) => $query->whereHas('competition', fn ($competition) => $competition->where('slug', $request->string('competition'))))
            ->orderByRaw('COALESCE(kickoff_at, scheduled_date)')
            ->paginate((int) min($request->integer('per_page', 20), 50));

        return MatchResource::collection($matches);
    }

    public function show(string $slug)
    {
        $match = GameMatch::query()->published()->publicGraph()->where('slug', $slug)->firstOrFail();

        return new MatchResource($match);
    }
}
