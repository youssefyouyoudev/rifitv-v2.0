<?php

namespace App\Services;

use App\Enums\MatchStatus;
use App\Enums\MatchVisibility;
use App\Models\GameMatch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class MatchScheduleService
{
    public function __construct(private readonly MatchDateWindowService $dateWindow) {}

    /** @return Builder<GameMatch> */
    public function publicQuery(Request $request): Builder
    {
        return $this->applyFilters(GameMatch::query()->published()->publicGraph(), $request, publicOnly: true)
            ->scheduleOrder();
    }

    /** @return Builder<GameMatch> */
    public function adminQuery(Request $request): Builder
    {
        $query = GameMatch::query()
            ->publicGraph()
            ->withCount('channels');

        return $this->applyFilters($query, $request)
            ->when(
                $request->string('status')->toString() === MatchStatus::Finished->value,
                fn (Builder $query) => $query->finishedOrder(),
                fn (Builder $query) => $query->scheduleOrder()
            );
    }

    /** @return array<string,mixed> */
    public function adminMeta(Request $request): array
    {
        $timezone = $this->timezone();

        return [
            'timezone' => $timezone,
            'counter_labels' => $this->counterLabels(),
            'filters' => [
                'date' => $request->string('date')->toString() ?: null,
                'competition' => $request->string('competition')->toString() ?: null,
                'competition_id' => $request->integer('competition_id') ?: null,
                'team' => $request->string('team')->toString() ?: null,
                'team_id' => $request->integer('team_id') ?: null,
                'status' => $request->string('status')->toString() ?: null,
                'featured' => $request->has('featured') ? $request->boolean('featured') : null,
                'channel' => $request->string('channel')->toString() ?: null,
                'verification' => $request->string('verification')->toString() ?: null,
                'stream_status' => $request->string('stream_status')->toString() ?: null,
                'search' => $request->string('search')->toString() ?: null,
            ],
            'statuses' => collect(MatchStatus::cases())->map(fn (MatchStatus $status): array => [
                'value' => $status->value,
                'label' => $status->label(),
                'rank' => $status->scheduleRank(),
            ])->values()->all(),
            'counters' => $this->counters(),
            'attention' => $this->attentionMatches($request),
        ];
    }

    /** @return array<string,int> */
    public function counters(): array
    {
        $base = GameMatch::query();
        $now = now();
        $today = $this->dateWindow->today();
        $upcomingDays = max(1, (int) config('rifitv.admin_upcoming_days', 7));

        return [
            'today' => (clone $base)->onLocalDate($today)->count(),
            'live' => (clone $base)->whereIn('status', [MatchStatus::Live->value, MatchStatus::Halftime->value])->count(),
            'upcoming' => $this->withinUpcomingHorizon((clone $base)->where('status', MatchStatus::Scheduled->value), $now, $today, $upcomingDays)->count(),
            'finished' => (clone $base)->where('status', MatchStatus::Finished->value)->count(),
            'needs_channel' => (clone $base)
                ->whereIn('status', [MatchStatus::Scheduled->value, MatchStatus::Live->value, MatchStatus::Halftime->value])
                ->where(function (Builder $query) use ($now, $today, $upcomingDays): void {
                    $query
                        ->where(fn (Builder $published) => $published->whereNotNull('published_at')->where('visibility', MatchVisibility::Public))
                        ->orWhere(fn (Builder $upcoming) => $this->withinUpcomingHorizon($upcoming->where('status', MatchStatus::Scheduled->value), $now, $today, $upcomingDays));
                })
                ->doesntHave('channels')
                ->count(),
            'needs_verification' => (clone $base)->whereIn('verification_status', ['pending_verification', 'problem'])->count(),
            'featured' => (clone $base)->where('featured', true)->count(),
        ];
    }

    /** @return array<string,string> */
    public function counterLabels(): array
    {
        $days = max(1, (int) config('rifitv.admin_upcoming_days', 7));

        return [
            'today' => 'Today',
            'live' => 'Live now',
            'upcoming' => "Upcoming {$days} days",
            'finished' => 'Finished (all)',
            'needs_channel' => "Needs channel ({$days} days)",
            'needs_verification' => 'Needs verification (all)',
            'featured' => 'Featured',
        ];
    }

    /** @return list<GameMatch> */
    public function attentionMatches(Request $request): array
    {
        $timezone = $this->timezone();
        $now = now();
        $soon = $now->copy()->addMinutes((int) config('rifitv.missing_broadcast_alert_minutes', 30));
        $today = $this->dateWindow->today();
        $requestedDate = $request->string('date')->toString();
        $attentionDate = $requestedDate !== '' ? $this->dateWindow->normalizeDate($requestedDate) : $today;

        $liveWithoutStream = $this->applyContextFilters(GameMatch::query()->publicGraph(), $request)
            ->whereIn('status', [MatchStatus::Live->value, MatchStatus::Halftime->value])
            ->whereDoesntHave('channels.streamSources', fn (Builder $query) => $query->where('enabled', true)->where('last_known_status', 'healthy'))
            ->scheduleOrder()
            ->limit(5)
            ->get();

        $soonWithoutChannel = $this->applyContextFilters(GameMatch::query()->publicGraph(), $request)
            ->where('status', MatchStatus::Scheduled->value)
            ->whereBetween('kickoff_at', [$now, $soon])
            ->doesntHave('channels')
            ->scheduleOrder()
            ->limit(5)
            ->get();

        $soonWithoutStream = $this->applyContextFilters(GameMatch::query()->publicGraph(), $request)
            ->where('status', MatchStatus::Scheduled->value)
            ->whereBetween('kickoff_at', [$now, $soon])
            ->whereHas('channels')
            ->whereDoesntHave('channels.streamSources', fn (Builder $query) => $query->where('enabled', true)->where('last_known_status', 'healthy'))
            ->scheduleOrder()
            ->limit(5)
            ->get();

        $todayWithoutChannel = $this->applyContextFilters(GameMatch::query()->publicGraph(), $request)
            ->onLocalDate($attentionDate, $timezone)
            ->where('status', MatchStatus::Scheduled->value)
            ->doesntHave('channels')
            ->scheduleOrder()
            ->limit(5)
            ->get();

        $todayPending = $this->applyContextFilters(GameMatch::query()->publicGraph(), $request)
            ->onLocalDate($attentionDate, $timezone)
            ->whereIn('verification_status', ['pending_verification', 'problem'])
            ->scheduleOrder()
            ->limit(5)
            ->get();

        $conflicts = $this->applyContextFilters(GameMatch::query()->publicGraph(), $request)
            ->whereNotNull('kickoff_at')
            ->whereNotNull('scheduled_date')
            ->scheduleOrder()
            ->limit(100)
            ->get()
            ->filter(fn (GameMatch $match): bool => $match->kickoff_at?->timezone($timezone)->toDateString() !== $match->scheduled_date?->toDateString())
            ->take(5);

        return $liveWithoutStream
            ->concat($soonWithoutChannel)
            ->concat($soonWithoutStream)
            ->concat($todayWithoutChannel)
            ->concat($todayPending)
            ->concat($conflicts)
            ->unique('id')
            ->take(5)
            ->values()
            ->all();
    }

    /** @param Builder<GameMatch> $query */
    private function applyFilters(Builder $query, Request $request, bool $publicOnly = false): Builder
    {
        $this->applyContextFilters($query, $request);

        return $query
            ->when($request->string('status')->isNotEmpty(), function (Builder $query) use ($request): void {
                if (in_array($request->string('status')->toString(), ['live', 'active'], true)) {
                    $query->whereIn('status', [MatchStatus::Live->value, MatchStatus::Halftime->value]);

                    return;
                }

                $query->where('status', $request->string('status')->toString());
            })
            ->when($request->has('featured'), fn (Builder $query) => $query->where('featured', $request->boolean('featured')))
            ->when($request->string('channel')->isNotEmpty(), function (Builder $query) use ($request): void {
                match ($request->string('channel')->toString()) {
                    'has' => $query->has('channels'),
                    'missing' => $query->doesntHave('channels'),
                    default => null,
                };
            })
            ->when($request->string('verification')->isNotEmpty(), function (Builder $query) use ($request): void {
                match ($request->string('verification')->toString()) {
                    'verified' => $query->whereIn('verification_status', ['verified', 'manual_verified']),
                    'pending' => $query->where('verification_status', 'pending_verification'),
                    'problem' => $query->whereNotIn('verification_status', ['verified', 'manual_verified', 'pending_verification']),
                    default => null,
                };
            })
            ->when(! $publicOnly && $request->string('stream_status')->isNotEmpty(), function (Builder $query) use ($request): void {
                match ($request->string('stream_status')->toString()) {
                    'healthy' => $query->whereHas('channels.streamSources', fn (Builder $source) => $source->where('enabled', true)->where('last_known_status', 'healthy')),
                    'missing' => $query->whereDoesntHave('channels.streamSources', fn (Builder $source) => $source->where('enabled', true)),
                    'problem' => $query->whereHas('channels.streamSources', fn (Builder $source) => $source->whereIn('last_known_status', ['offline', 'degraded', 'browser_incompatible', 'disabled'])),
                    default => null,
                };
            });
    }

    /** @param Builder<GameMatch> $query */
    private function applyContextFilters(Builder $query, Request $request, bool $includeDate = true): Builder
    {
        $timezone = $this->timezone();
        $requestedDate = $request->string('date')->toString();
        $date = $requestedDate === '' ? '' : $this->dateWindow->normalizeDate($requestedDate);

        return $query
            ->when($includeDate && $date !== '', fn (Builder $query) => $query->onLocalDate($date, $timezone))
            ->when($request->string('competition')->isNotEmpty(), fn (Builder $query) => $query->whereHas('competition', fn (Builder $competition) => $competition->where('slug', $request->string('competition'))))
            ->when($request->filled('competition_id'), fn (Builder $query) => $query->where('competition_id', $request->integer('competition_id')))
            ->when($request->string('team')->isNotEmpty(), function (Builder $query) use ($request): void {
                $team = $request->string('team')->toString();
                $query->where(fn (Builder $teamQuery) => $teamQuery
                    ->whereHas('homeTeam', fn (Builder $home) => $home->where('slug', $team)->orWhere('name', 'like', "%{$team}%"))
                    ->orWhereHas('awayTeam', fn (Builder $away) => $away->where('slug', $team)->orWhere('name', 'like', "%{$team}%")));
            })
            ->when($request->filled('team_id'), fn (Builder $query) => $query->where(fn (Builder $teamQuery) => $teamQuery->where('home_team_id', $request->integer('team_id'))->orWhere('away_team_id', $request->integer('team_id'))))
            ->when($request->string('search')->isNotEmpty(), function (Builder $query) use ($request): void {
                $search = $request->string('search')->toString();
                $query->where(fn (Builder $searchQuery) => $searchQuery
                    ->where('slug', 'like', "%{$search}%")
                    ->when(is_numeric($search), fn (Builder $numericQuery) => $numericQuery->orWhereKey((int) $search))
                    ->orWhereHas('competition', fn (Builder $competition) => $competition->where('name', 'like', "%{$search}%")->orWhere('slug', 'like', "%{$search}%"))
                    ->orWhereHas('homeTeam', fn (Builder $team) => $team->where('name', 'like', "%{$search}%")->orWhere('slug', 'like', "%{$search}%"))
                    ->orWhereHas('awayTeam', fn (Builder $team) => $team->where('name', 'like', "%{$search}%")->orWhere('slug', 'like', "%{$search}%"))
                    ->orWhereHas('channels', fn (Builder $channel) => $channel->where('name', 'like', "%{$search}%")->orWhere('slug', 'like', "%{$search}%")));
            })
            ->when($request->string('territory')->isNotEmpty(), fn (Builder $query) => $query->whereHas('broadcasts', fn (Builder $broadcast) => $broadcast->where('territory', $request->string('territory')->toString())));
    }

    private function timezone(): string
    {
        return $this->dateWindow->timezone();
    }

    private function withinUpcomingHorizon(Builder $query, Carbon $now, string $today, int $days): Builder
    {
        $lastDate = $this->dateWindow->addDays($today, $days);
        $horizon = $now->copy()->addDays($days);

        return $query->where(function (Builder $future) use ($now, $horizon, $today, $lastDate): void {
            $future
                ->whereBetween('kickoff_at', [$now, $horizon])
                ->orWhere(fn (Builder $dateOnly) => $dateOnly->whereNull('kickoff_at')->whereBetween('scheduled_date', [$today, $lastDate]));
        });
    }
}
