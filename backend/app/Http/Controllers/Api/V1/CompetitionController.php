<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CompetitionResource;
use App\Models\Competition;

class CompetitionController extends Controller
{
    public function index()
    {
        return CompetitionResource::collection(
            Competition::query()->where('active', true)->orderBy('sort_order')->get()
        );
    }

    public function show(string $slug)
    {
        $competition = Competition::query()
            ->where('slug', $slug)
            ->with(['matches' => fn ($query) => $query->published()->publicGraph()->orderByRaw('COALESCE(kickoff_at, scheduled_date)')])
            ->firstOrFail();

        return new CompetitionResource($competition);
    }
}
