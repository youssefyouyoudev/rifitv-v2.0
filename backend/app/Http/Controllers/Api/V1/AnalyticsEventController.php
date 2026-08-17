<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AnalyticsEventRequest;
use App\Models\AnalyticsEvent;
use Illuminate\Http\JsonResponse;

class AnalyticsEventController extends Controller
{
    public function __invoke(AnalyticsEventRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $payload = collect($validated['payload'] ?? [])
            ->only(['match_slug', 'competition', 'status', 'playback_status', 'share_method', 'source_id', 'source_count', 'error_type', 'source', 'device_category', 'query_length', 'result_count', 'target', 'enabled', 'ad_zone', 'ad_placement', 'ad_format', 'reason'])
            ->map(static fn (mixed $value): string|int|float|bool|null => is_scalar($value) || $value === null ? $value : null)
            ->filter(static fn (mixed $value): bool => $value !== null)
            ->all();

        $path = $validated['path'] ?? ($payload['path'] ?? null);
        unset($payload['path']);

        AnalyticsEvent::query()->create([
            'event' => $validated['event'],
            'visitor_hash' => filled($validated['visitor_id'] ?? null) ? hash_hmac('sha256', $validated['visitor_id'], (string) config('app.key')) : null,
            'path' => $path,
            'payload' => $payload,
            'occurred_at' => now(),
        ]);

        return response()->json(['status' => 'accepted'], 202);
    }
}
