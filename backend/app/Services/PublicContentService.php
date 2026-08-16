<?php

namespace App\Services;

use App\Enums\MatchStatus;
use App\Models\Announcement;
use App\Models\Competition;
use App\Models\GameMatch;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class PublicContentService
{
    public function homePayload(): array
    {
        $timezone = (string) config('rifitv.display_timezone', 'Africa/Casablanca');
        $localNow = Carbon::now($timezone);
        $cacheKey = $this->homeCacheKey($timezone, $localNow->toDateString());

        if (app()->environment('testing')) {
            return $this->buildHomePayload($timezone, $localNow);
        }

        return Cache::remember($cacheKey, now()->addSeconds(30), fn (): array => $this->buildHomePayload($timezone, $localNow));
    }

    public function forgetHome(): void
    {
        $timezone = (string) config('rifitv.display_timezone', 'Africa/Casablanca');
        $localDate = Carbon::now($timezone)->toDateString();

        Cache::forget($this->homeCacheKey($timezone, $localDate));
    }

    private function buildHomePayload(string $timezone, Carbon $localNow): array
    {
        $now = Carbon::now('UTC');
        $localDate = $localNow->toDateString();
        $startUtc = $localNow->copy()->startOfDay()->utc();
        $endUtc = $localNow->copy()->endOfDay()->utc();

        $base = GameMatch::query()->published()->publicGraph();
        $scheduleOrder = 'COALESCE(kickoff_at, scheduled_date)';
        $todayQuery = fn ($query) => $query
            ->whereBetween('kickoff_at', [$startUtc, $endUtc])
            ->orWhereDate('scheduled_date', $localDate);
        $today = (clone $base)
            ->where($todayQuery)
            ->orderByRaw("CASE status WHEN 'live' THEN 0 WHEN 'halftime' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'finished' THEN 2 ELSE 3 END")
            ->orderByRaw($scheduleOrder)
            ->limit(24)
            ->get();

        return [
            'server_time' => $now->toIso8601String(),
            'date' => $localDate,
            'date_label' => $localNow->isoFormat('dddd, D MMMM'),
            'timezone' => $timezone,
            'matches' => $today,
            'live_count' => $today->whereIn('status', [MatchStatus::Live, MatchStatus::Halftime])->count(),
            'today_count' => $today->count(),
            'next_match' => (clone $base)
                ->where(fn ($query) => $query
                    ->where('kickoff_at', '>', $endUtc)
                    ->orWhereDate('scheduled_date', '>', $localDate))
                ->where('status', MatchStatus::Scheduled)
                ->orderByRaw($scheduleOrder)
                ->first(),
            'announcements' => Announcement::query()
                ->where('active', true)
                ->where(fn ($query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
                ->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>=', now()))
                ->latest()
                ->limit(3)
                ->get(),
            'competitions' => Competition::query()
                ->where('active', true)
                ->where('featured', true)
                ->orderBy('sort_order')
                ->get(),
        ];
    }

    private function homeCacheKey(string $timezone, string $localDate): string
    {
        return 'rifitv:public:home:'.sha1($timezone.'|'.$localDate);
    }
}
