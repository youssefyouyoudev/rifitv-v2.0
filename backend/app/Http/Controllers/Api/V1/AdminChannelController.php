<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminChannelRequest;
use App\Http\Resources\ChannelResource;
use App\Models\Channel;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminChannelController extends Controller
{
    public function index(Request $request)
    {
        return ChannelResource::collection(Channel::query()
            ->withCount('streamSources')
            ->with('streamSources')
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->when($request->filled('playlist_id'), fn ($query) => $query->where('playlist_id', $request->integer('playlist_id')))
            ->when($request->filled('active'), fn ($query) => $query->where('active', $request->boolean('active')))
            ->when($request->filled('group'), fn ($query) => $query->where('normalized_group', $request->string('group')))
            ->when($request->filled('quality'), fn ($query) => $query->where('quality_label', $request->string('quality')))
            ->when($request->filled('health'), fn ($query) => $query->where('health_status', $request->string('health')))
            ->when($request->boolean('favorites'), fn ($query) => $query->where('favorite', true))
            ->orderByDesc('favorite')
            ->orderBy('natural_sort')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate((int) min($request->integer('per_page', 50), 100)));
    }

    public function store(AdminChannelRequest $request, AuditService $audit)
    {
        $data = $request->validated();
        $data['slug'] ??= Str::slug($data['name']);
        $channel = Channel::query()->create($data);
        $audit->record($request->user(), 'channel.created', $channel);

        return new ChannelResource($channel);
    }

    public function show(Channel $channel)
    {
        return new ChannelResource($channel->load('streamSources'));
    }

    public function update(AdminChannelRequest $request, Channel $channel, AuditService $audit)
    {
        $data = $request->validated();
        $data['slug'] ??= Str::slug($data['name']);
        $channel->update($data);
        $audit->record($request->user(), 'channel.updated', $channel);

        return new ChannelResource($channel->load('streamSources'));
    }

    public function destroy(Request $request, Channel $channel, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);
        $channel->delete();
        $audit->record($request->user(), 'channel.archived', $channel);

        return response()->json(['data' => ['message' => 'Channel archived']]);
    }
}
