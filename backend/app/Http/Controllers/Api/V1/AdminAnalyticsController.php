<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use Illuminate\Http\Request;

class AdminAnalyticsController extends Controller
{
    public function __invoke(Request $request)
    {
        abort_unless($request->user()?->hasPermission('analytics.view') || $request->user()?->hasPermission('*'), 403);

        $days = max(1, min(30, $request->integer('days', 7)));
        $events = AnalyticsEvent::query()
            ->where('occurred_at', '>=', now()->subDays($days - 1)->startOfDay())
            ->get(['event', 'visitor_hash', 'path', 'payload', 'occurred_at']);
        $visitorDays = $events
            ->filter(static fn (AnalyticsEvent $event): bool => filled($event->visitor_hash))
            ->groupBy('visitor_hash')
            ->map(static fn ($visitorEvents) => $visitorEvents->map(fn (AnalyticsEvent $event): string => $event->occurred_at->toDateString())->unique()->values());

        return response()->json(['data' => [
            'range_days' => $days,
            'today_visitors' => $visitorDays->filter(static fn ($dates): bool => $dates->contains(now()->toDateString()))->count(),
            'period_unique_visitors' => $visitorDays->count(),
            'returning_visitors' => $visitorDays->filter(static fn ($dates): bool => $dates->count() > 1)->count(),
            'event_counts' => $events->countBy('event')->sortDesc()->take(12)->all(),
            'traffic_sources' => $this->countPayloadValue($events, 'source'),
            'device_categories' => $this->countPayloadValue($events, 'device_category'),
            'top_pages' => $this->countPaths($events),
            'top_matches' => $this->countPayloadValue($events, 'match_slug'),
            'daily' => $this->dailyVisitors($events),
        ]]);
    }

    private function countPayloadValue($events, string $key): array
    {
        return $events
            ->map(static fn (AnalyticsEvent $event): mixed => $event->payload[$key] ?? null)
            ->filter(static fn (mixed $value): bool => is_string($value) && $value !== '')
            ->countBy()
            ->sortDesc()
            ->take(10)
            ->all();
    }

    private function countPaths($events): array
    {
        return $events
            ->map(static fn (AnalyticsEvent $event): ?string => $event->path)
            ->filter()
            ->countBy()
            ->sortDesc()
            ->take(10)
            ->all();
    }

    private function dailyVisitors($events): array
    {
        return $events
            ->filter(static fn (AnalyticsEvent $event): bool => filled($event->visitor_hash))
            ->groupBy(fn (AnalyticsEvent $event): string => $event->occurred_at->toDateString())
            ->map(static fn ($dayEvents): array => [
                'visitors' => $dayEvents->pluck('visitor_hash')->unique()->count(),
                'events' => $dayEvents->count(),
            ])
            ->sortKeys()
            ->all();
    }
}
