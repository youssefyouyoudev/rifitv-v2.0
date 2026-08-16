<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\GameMatch;
use App\Models\PlaybackEvent;
use App\Models\StreamSource;
use App\Services\OperationalAlertService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class PlaybackEventController extends Controller
{
    public function __invoke(Request $request, OperationalAlertService $alerts)
    {
        $key = 'playback-events:'.$request->ip();
        abort_if(RateLimiter::tooManyAttempts($key, 30), 429, 'Too many playback events.');
        RateLimiter::hit($key, 60);

        $validated = $request->validate([
            'event_type' => ['required', 'in:source_failed,startup_timeout,recovery_failed,playback_started'],
            'match_id' => ['nullable', 'integer', 'exists:matches,id'],
            'match_slug' => ['nullable', 'string', 'exists:matches,slug'],
            'source_id' => ['nullable', 'integer', 'exists:stream_sources,id'],
        ]);

        $matchId = $validated['match_id'] ?? (isset($validated['match_slug']) ? GameMatch::query()->where('slug', $validated['match_slug'])->value('id') : null);
        $sourceId = $validated['source_id'] ?? null;

        PlaybackEvent::query()->create([
            'match_id' => $matchId,
            'stream_source_id' => $sourceId,
            'event_type' => $validated['event_type'],
            'metadata' => [],
            'occurred_at' => now(),
        ]);

        if ($sourceId && in_array($validated['event_type'], ['source_failed', 'startup_timeout', 'recovery_failed'], true)) {
            $recent = PlaybackEvent::query()->where('stream_source_id', $sourceId)->where('occurred_at', '>=', now()->subMinutes(2))->count();
            if ($recent >= 10) {
                $sourceName = StreamSource::query()->find($sourceId)?->name ?? 'A source';
                $alerts->open('playback_failures', 'playback-source-'.$sourceId, 'warning', $sourceName.' has viewer playback failures', 'Multiple browsers reported playback failures recently.');
            }
        }

        return response()->json(['data' => ['message' => 'Event accepted']]);
    }
}
