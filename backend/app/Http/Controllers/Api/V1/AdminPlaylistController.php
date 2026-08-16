<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ChannelResource;
use App\Http\Resources\PlaylistResource;
use App\Jobs\ImportPlaylistJob;
use App\Models\Channel;
use App\Models\Playlist;
use App\Services\AuditService;
use App\Services\IptvDiagnosticService;
use App\Services\PlaylistImportService;
use App\Services\SafeUrlValidator;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminPlaylistController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);

        return PlaylistResource::collection(Playlist::query()
            ->with('latestSyncRun')
            ->withCount('channels')
            ->latest()
            ->paginate((int) min($request->integer('per_page', 50), 100)));
    }

    public function store(Request $request, SafeUrlValidator $safeUrl, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::in(['m3u_url', 'xtream', 'uploaded_m3u'])],
            'source_url' => ['nullable', 'string', 'max:2000'],
            'server_url' => ['nullable', 'string', 'max:500'],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:255'],
            'file' => ['nullable', 'file', 'max:20480'],
            'auto_sync' => ['sometimes', 'boolean'],
            'sync_interval_minutes' => ['sometimes', 'integer', 'min:15', 'max:10080'],
            'sync_now' => ['sometimes', 'boolean'],
        ]);

        if ($validated['type'] === 'm3u_url') {
            $validated['source_url'] = $safeUrl->ensurePublicHttpUrl($validated['source_url'] ?? null, 'source_url');
        }

        if ($validated['type'] === 'xtream') {
            $validated['server_url'] = $safeUrl->ensurePublicHttpUrl($validated['server_url'] ?? null, 'server_url');
            $request->validate([
                'username' => ['required', 'string', 'max:255'],
                'password' => ['required', 'string', 'max:255'],
            ]);
        }

        if ($validated['type'] === 'uploaded_m3u') {
            $request->validate(['file' => ['required', 'file', 'max:20480']]);
            $validated['file_path'] = $request->file('file')->store('playlists');
        }

        $playlist = Playlist::query()->create([
            'name' => $validated['name'],
            'type' => $validated['type'],
            'source_url' => $validated['source_url'] ?? null,
            'server_url' => $validated['server_url'] ?? null,
            'username' => $validated['username'] ?? null,
            'password' => $validated['password'] ?? null,
            'file_path' => $validated['file_path'] ?? null,
            'auto_sync' => $validated['auto_sync'] ?? false,
            'sync_interval_minutes' => $validated['sync_interval_minutes'] ?? 360,
        ]);

        $audit->record($request->user(), 'playlist.created', $playlist, ['type' => $playlist->type, 'source_url' => $playlist->source_url]);

        if ($validated['sync_now'] ?? true) {
            ImportPlaylistJob::dispatch($playlist, $request->user());
            $playlist->update(['status' => 'queued']);
        }

        return new PlaylistResource($playlist->fresh('latestSyncRun'));
    }

    public function test(Request $request, IptvDiagnosticService $diagnostics)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);
        $validated = $request->validate([
            'source_url' => ['required', 'string', 'max:2000'],
        ]);

        $report = $diagnostics->diagnoseUrl($validated['source_url']);

        return response()->json(['data' => [
            'connected' => $report['playlist']['reachable'],
            'valid_m3u' => $report['playlist']['valid_m3u'],
            'channel_count' => $report['counts']['channels'],
            'group_count' => $report['counts']['groups'],
            'groups' => $report['groups'],
            'samples' => collect($report['samples'])->map(fn (array $sample): array => [
                'channel' => $sample['channel'],
                'protocol' => $sample['protocol'],
                'transport' => $sample['transport'],
                'browser_compatible' => $sample['browser_compatible'],
            ])->all(),
        ]]);
    }

    public function show(Request $request, Playlist $playlist)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);

        return new PlaylistResource($playlist->load('latestSyncRun'));
    }

    public function update(Request $request, Playlist $playlist, SafeUrlValidator $safeUrl, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'source_url' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'server_url' => ['sometimes', 'nullable', 'string', 'max:500'],
            'username' => ['sometimes', 'nullable', 'string', 'max:255'],
            'password' => ['sometimes', 'nullable', 'string', 'max:255'],
            'active' => ['sometimes', 'boolean'],
            'auto_sync' => ['sometimes', 'boolean'],
            'sync_interval_minutes' => ['sometimes', 'integer', 'min:15', 'max:10080'],
        ]);

        if (isset($validated['source_url'])) {
            $validated['source_url'] = $safeUrl->ensurePublicHttpUrl($validated['source_url'], 'source_url');
        }

        if (isset($validated['server_url'])) {
            $validated['server_url'] = $safeUrl->ensurePublicHttpUrl($validated['server_url'], 'server_url');
        }

        if (($validated['password'] ?? null) === '') {
            unset($validated['password']);
        }

        $playlist->update($validated);
        $audit->record($request->user(), 'playlist.updated', $playlist, ['source_url' => $playlist->source_url]);

        return new PlaylistResource($playlist->fresh('latestSyncRun'));
    }

    public function destroy(Request $request, Playlist $playlist, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);
        $playlist->delete();
        $audit->record($request->user(), 'playlist.deleted', $playlist);

        return response()->json(['data' => ['message' => 'Playlist archived']]);
    }

    public function sync(Request $request, Playlist $playlist)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);
        ImportPlaylistJob::dispatch($playlist, $request->user());
        $playlist->update(['status' => 'queued']);

        return new PlaylistResource($playlist->fresh('latestSyncRun'));
    }

    public function importNow(Request $request, Playlist $playlist, PlaylistImportService $service)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);

        if (! $request->boolean('blocking')) {
            ImportPlaylistJob::dispatch($playlist, $request->user());
            $playlist->update(['status' => 'queued']);

            return new PlaylistResource($playlist->fresh('latestSyncRun'));
        }

        $service->import($playlist, $request->user());

        return new PlaylistResource($playlist->fresh('latestSyncRun'));
    }

    public function channels(Request $request)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);

        return ChannelResource::collection(Channel::query()
            ->with('streamSources')
            ->withCount('streamSources')
            ->when($request->filled('playlist_id'), fn ($query) => $query->where('playlist_id', $request->integer('playlist_id')))
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->when($request->filled('active'), fn ($query) => $query->where('active', $request->boolean('active')))
            ->orderBy('name')
            ->paginate((int) min($request->integer('per_page', 50), 100)));
    }
}
