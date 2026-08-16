<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminTeamRequest;
use App\Http\Resources\TeamResource;
use App\Models\Team;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminTeamController extends Controller
{
    public function index(Request $request)
    {
        return TeamResource::collection(Team::query()
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->when($request->has('active'), fn ($query) => $query->where('active', $request->boolean('active')))
            ->orderBy('name')
            ->paginate((int) min($request->integer('per_page', 50), 100)));
    }

    public function store(AdminTeamRequest $request, AuditService $audit)
    {
        $data = $request->validated();
        $data['slug'] ??= Str::slug($data['name']);
        $team = Team::query()->create($data);
        $audit->record($request->user(), 'team.created', $team);

        return new TeamResource($team);
    }

    public function show(Team $team)
    {
        return new TeamResource($team);
    }

    public function update(AdminTeamRequest $request, Team $team, AuditService $audit)
    {
        $data = $request->validated();
        $data['slug'] ??= Str::slug($data['name']);
        $team->update($data);
        $audit->record($request->user(), 'team.updated', $team);

        return new TeamResource($team);
    }

    public function destroy(Request $request, Team $team, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('teams.manage'), 403);
        $team->delete();
        $audit->record($request->user(), 'team.archived', $team);

        return response()->json(['data' => ['message' => 'Team archived']]);
    }
}
