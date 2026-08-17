<?php

namespace App\Services;

use App\Enums\MatchStatus;
use App\Models\GameMatch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class MatchScheduleService
{
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
        $base = $this->applyContextFilters(GameMatch::query(), $request);
        $timezone = $this->timezone();
        $today = Carbon::now($timezone)->toDateString();

        return [
            'timezone' => $timezone,
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
            'counters' => [
                'today' => (clone $base)->onLocalDate($today, $timezone)->count(),
                'live' => (clone $base)->whereIn('status', [MatchStatus::Live->value, MatchStatus::Halftime->value])->count(),
                'upcoming' => (clone $base)->where('status', MatchStatus::Scheduled->value)->where('kickoff_at', '>=', now())->count(),
                'finished' => (clone $base)->where('status', MatchStatus::Finished->value)->count(),
                'needs_channel' => (clone $base)->doesntHave('channels')->count(),
                'needs_verification' => (clone $base)->where('verification_status', 'pending_verification')->count(),
                'featured' => (clone $base)->where('featured', true)->count(),
            ],
            'attention' => $this->attentionMatches($request),
        ];
    }

    /** @return list<GameMatch> */
    public function attentionMatches(Request $request): array
    {
        $timezone = $this->timezone();
        $now = now();
        $soon = $now->copy()->addMinutes((int) config('rifitv.missing_broadcast_alert_minutes', 30));
        $today = Carbon::now($timezone)->toDateString();

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

        $todayPending = $this->applyContextFilters(GameMatch::query()->publicGraph(), $request)
            ->onLocalDate($today, $timezone)
            ->where('verification_status', 'pending_verification')
            ->scheduleOrder()
            ->limit(5)
            ->get();

        $upcomingWithoutChannel = $this->applyContextFilters(GameMatch::query()->publicGraph(), $request)
            ->where('status', MatchStatus::Scheduled->value)
            ->where('kickoff_at', '>=', $now)
            ->doesntHave('channels')
            ->scheduleOrder()
            ->limit(5)
            ->get();

        return $liveWithoutStream
            ->concat($soonWithoutChannel)
            ->concat($todayPending)
            ->concat($upcomingWithoutChannel)
            ->unique('id')
            ->take(12)
            ->values()
            ->all();
    }

    /** @param Builder<GameMatch> $query */
    private function applyFilters(Builder $query, Request $request, bool $publicOnly = false): Builder
    {
        $this->applyContextFilters($query, $request);

        return $query
            ->when($request->string('status')->isNotEmpty(), fn (Builder $query) => $query->where('status', $request->string('status')))
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
    private function applyContextFilters(Builder $query, Request $request): Builder
    {
        $timezone = $this->timezone();
        $date = match ($request->string('date')->toString()) {
            'today' => Carbon::now($timezone)->toDateString(),
            'tomorrow' => Carbon::now($timezone)->addDay()->toDateString(),
            default => $request->string('date')->toString(),
        };

        return $query
            ->when($date !== '', fn (Builder $query) => $query->onLocalDate($date, $timezone))
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
                    ->orWhereHas('competition', fn (Builder $competition) => $competition->where('name', 'like', "%{$search}%")->orWhere('slug', 'like', "%{$search}%"))
                    ->orWhereHas('homeTeam', fn (Builder $team) => $team->where('name', 'like', "%{$search}%")->orWhere('slug', 'like', "%{$search}%"))
                    ->orWhereHas('awayTeam', fn (Builder $team) => $team->where('name', 'like', "%{$search}%")->orWhere('slug', 'like', "%{$search}%")));
            });
    }

    private function timezone(): string
    {
        return (string) config('rifitv.display_timezone', 'Africa/Casablanca');
    }
}
