<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminStreamSourceRequest;
use App\Http\Resources\StreamSourceResource;
use App\Models\StreamSource;
use App\Services\AuditService;
use App\Services\PlaybackPipelineDiagnosticService;
use App\Services\StreamSourceService;
use Illuminate\Http\Request;

class AdminStreamSourceController extends Controller
{
    public function index(Request $request)
    {
        return StreamSourceResource::collection(StreamSource::query()
            ->with('channel')
            ->when($request->filled('channel_id'), fn ($query) => $query->where('channel_id', $request->integer('channel_id')))
            ->orderBy('channel_id')
            ->orderBy('priority')
            ->paginate((int) min($request->integer('per_page', 50), 100)));
    }

    public function store(AdminStreamSourceRequest $request, AuditService $audit)
    {
        $source = StreamSource::query()->create($request->validated());
        $audit->record($request->user(), 'stream_source.created', $source, ['source_url' => $source->url]);

        return new StreamSourceResource($source->load('channel'));
    }

    public function show(StreamSource $streamSource)
    {
        return new StreamSourceResource($streamSource->load('channel'));
    }

    public function update(AdminStreamSourceRequest $request, StreamSource $streamSource, AuditService $audit)
    {
        $streamSource->update($request->validated());
        $audit->record($request->user(), 'stream_source.updated', $streamSource, ['source_url' => $streamSource->url]);

        return new StreamSourceResource($streamSource->load('channel'));
    }

    public function destroy(Request $request, StreamSource $streamSource, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);
        $streamSource->delete();
        $audit->record($request->user(), 'stream_source.deleted', $streamSource);

        return response()->json(['data' => ['message' => 'Source deleted']]);
    }

    public function test(Request $request, StreamSource $streamSource, StreamSourceService $service)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);

        return response()->json(['data' => $service->test($streamSource, $request->user())]);
    }

    public function pipelineTest(Request $request, StreamSource $streamSource, PlaybackPipelineDiagnosticService $diagnostics)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);

        return response()->json(['data' => $diagnostics->test($streamSource)]);
    }

    public function reorder(Request $request, StreamSourceService $service)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);
        $validated = $request->validate(['ids' => ['required', 'array'], 'ids.*' => ['integer', 'exists:stream_sources,id']]);
        $service->reorder($validated['ids'], $request->user());

        return response()->json(['data' => ['message' => 'Source priorities updated']]);
    }
}
