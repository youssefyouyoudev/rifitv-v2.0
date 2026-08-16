<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AnnouncementResource;
use App\Models\Announcement;
use App\Services\AuditService;
use Illuminate\Http\Request;

class AdminAnnouncementController extends Controller
{
    public function index()
    {
        return AnnouncementResource::collection(Announcement::query()->latest()->paginate(50));
    }

    public function store(Request $request, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('content.manage'), 403);
        $announcement = Announcement::query()->create($this->validated($request));
        $audit->record($request->user(), 'announcement.created', $announcement);

        return new AnnouncementResource($announcement);
    }

    public function update(Request $request, Announcement $announcement, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('content.manage'), 403);
        $announcement->update($this->validated($request));
        $audit->record($request->user(), 'announcement.updated', $announcement);

        return new AnnouncementResource($announcement);
    }

    public function destroy(Request $request, Announcement $announcement, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('content.manage'), 403);
        $announcement->delete();
        $audit->record($request->user(), 'announcement.archived', $announcement);

        return response()->json(['data' => ['message' => 'Announcement archived']]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'message' => ['required', 'string', 'max:1000'],
            'type' => ['required', 'in:info,warning,maintenance'],
            'active' => ['sometimes', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        ]);
    }
}
