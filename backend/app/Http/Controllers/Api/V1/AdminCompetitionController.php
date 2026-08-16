<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminCompetitionRequest;
use App\Http\Resources\CompetitionResource;
use App\Models\Competition;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminCompetitionController extends Controller
{
    public function index(Request $request)
    {
        return CompetitionResource::collection(Competition::query()
            ->with('featuredTeams')
            ->orderBy('sort_order')
            ->paginate((int) min($request->integer('per_page', 50), 100)));
    }

    public function store(AdminCompetitionRequest $request, AuditService $audit)
    {
        $data = $request->validated();
        $featuredTeamIds = $data['featured_team_ids'] ?? [];
        unset($data['featured_team_ids']);
        $data['slug'] ??= Str::slug($data['name']);
        $competition = Competition::query()->create($data);
        $competition->rule()->create(['mode' => $competition->selection_mode, 'active' => true]);
        $competition->featuredTeams()->sync($featuredTeamIds);
        $audit->record($request->user(), 'competition.created', $competition);

        return new CompetitionResource($competition->load('featuredTeams'));
    }

    public function show(Competition $competition)
    {
        return new CompetitionResource($competition->load('featuredTeams'));
    }

    public function update(AdminCompetitionRequest $request, Competition $competition, AuditService $audit)
    {
        $data = $request->validated();
        $featuredTeamIds = $data['featured_team_ids'] ?? null;
        unset($data['featured_team_ids']);
        $data['slug'] ??= Str::slug($data['name']);
        $competition->update($data);
        $competition->rule()->updateOrCreate(['competition_id' => $competition->id], ['mode' => $competition->selection_mode, 'active' => true]);
        if (is_array($featuredTeamIds)) {
            $competition->featuredTeams()->sync($featuredTeamIds);
        }
        $audit->record($request->user(), 'competition.updated', $competition);

        return new CompetitionResource($competition->load('featuredTeams'));
    }

    public function destroy(Request $request, Competition $competition, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('competitions.manage'), 403);
        abort_if($competition->matches()->exists(), 422, 'Archive or reassign matches before deleting this competition.');
        $competition->delete();
        $audit->record($request->user(), 'competition.archived', $competition);

        return response()->json(['data' => ['message' => 'Competition archived']]);
    }
}
