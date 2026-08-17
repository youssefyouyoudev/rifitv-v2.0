<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\MatchResource;
use App\Models\GameMatch;
use App\Services\MatchScheduleService;
use Illuminate\Http\Request;

class MatchController extends Controller
{
    public function index(Request $request, MatchScheduleService $schedule)
    {
        $matches = $schedule->publicQuery($request)
            ->paginate((int) min($request->integer('per_page', 20), 50));

        return MatchResource::collection($matches);
    }

    public function show(string $slug)
    {
        $match = GameMatch::query()->published()->publicGraph()->slugOrLegacy($slug)->firstOrFail();

        return new MatchResource($match);
    }
}
