<?php

namespace App\Services;

use App\Enums\MatchStatus;
use App\Enums\MatchVisibility;
use App\Models\GameMatch;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class MatchService
{
    public function __construct(private readonly AuditService $audit) {}

    public function create(array $data, ?User $actor): GameMatch
    {
        $match = GameMatch::query()->create($this->payload($data));
        $this->syncChannels($match, $data['channel_ids'] ?? []);
        $this->audit->record($actor, 'match.created', $match, ['slug' => $match->slug]);

        return $match->fresh(['competition', 'homeTeam', 'awayTeam', 'channels.streamSources']);
    }

    public function update(GameMatch $match, array $data, ?User $actor): GameMatch
    {
        $before = $match->only(['status', 'home_score', 'away_score', 'minute', 'published_at', 'featured']);
        $match->update($this->payload($data, $match));

        if (array_key_exists('channel_ids', $data)) {
            $this->syncChannels($match, $data['channel_ids']);
        }

        $this->audit->record($actor, 'match.updated', $match, ['before' => $before]);

        return $match->fresh(['competition', 'homeTeam', 'awayTeam', 'channels.streamSources']);
    }

    public function duplicate(GameMatch $match, ?User $actor): GameMatch
    {
        $copy = $match->replicate(['slug', 'home_score', 'away_score', 'minute', 'status', 'published_at', 'source_external_id', 'source_hash']);
        $copy->slug = $this->uniqueSlug($match->homeTeam->name.' vs '.$match->awayTeam->name.' copy');
        $copy->status = MatchStatus::Scheduled;
        $copy->home_score = null;
        $copy->away_score = null;
        $copy->minute = null;
        $copy->published_at = null;
        $copy->kickoff_at = $match->kickoff_at ? Carbon::parse($match->kickoff_at)->addWeek() : null;
        $copy->verification_status = 'pending_verification';
        $copy->source_provider = 'manual-copy';
        $copy->source_external_id = null;
        $copy->source_verified_at = null;
        $copy->source_hash = null;
        $copy->save();
        $copy->channels()->sync($match->channels->pluck('id')->all());
        $this->audit->record($actor, 'match.duplicated', $copy, ['from' => $match->id]);

        return $copy->fresh(['competition', 'homeTeam', 'awayTeam', 'channels.streamSources']);
    }

    public function archive(GameMatch $match, ?User $actor): void
    {
        $match->delete();
        $this->audit->record($actor, 'match.archived', $match);
    }

    public function bulk(array $ids, string $action, ?User $actor): int
    {
        $matches = GameMatch::query()->whereIn('id', $ids)->get();

        foreach ($matches as $match) {
            match ($action) {
                'publish' => $match->update(['published_at' => now(), 'visibility' => MatchVisibility::Public]),
                'unpublish' => $match->update(['published_at' => null]),
                'feature' => $match->update(['featured' => true]),
                'unfeature' => $match->update(['featured' => false]),
                'delete' => $match->delete(),
                default => null,
            };
        }

        $this->audit->record($actor, 'matches.bulk_'.$action, null, ['count' => $matches->count()]);

        return $matches->count();
    }

    private function payload(array $data, ?GameMatch $existing = null): array
    {
        $homeName = $data['home_team_name'] ?? $existing?->homeTeam?->name ?? 'home';
        $awayName = $data['away_team_name'] ?? $existing?->awayTeam?->name ?? 'away';

        return [
            'competition_id' => $data['competition_id'] ?? $existing?->competition_id,
            'home_team_id' => $data['home_team_id'] ?? $existing?->home_team_id,
            'away_team_id' => $data['away_team_id'] ?? $existing?->away_team_id,
            'kickoff_at' => isset($data['kickoff_at']) ? Carbon::parse($data['kickoff_at'])->utc() : $existing?->kickoff_at,
            'status' => $data['status'] ?? $existing?->status ?? MatchStatus::Scheduled,
            'home_score' => $data['home_score'] ?? $existing?->home_score,
            'away_score' => $data['away_score'] ?? $existing?->away_score,
            'minute' => $data['minute'] ?? $existing?->minute,
            'featured' => $data['featured'] ?? $existing?->featured ?? false,
            'published_at' => ($data['published'] ?? (bool) $existing?->published_at) ? ($existing?->published_at ?? now()) : null,
            'visibility' => $data['visibility'] ?? $existing?->visibility ?? MatchVisibility::Public,
            'seo_title' => $data['seo_title'] ?? $existing?->seo_title,
            'seo_description' => $data['seo_description'] ?? $existing?->seo_description,
            'notes' => $data['notes'] ?? $existing?->notes,
            'slug' => $data['slug'] ?? $existing?->slug ?? $this->uniqueSlug($homeName.' vs '.$awayName),
        ];
    }

    private function syncChannels(GameMatch $match, array $channelIds): void
    {
        $sync = collect($channelIds)->values()->mapWithKeys(fn (int|string $id, int $index): array => [
            (int) $id => ['sort_order' => ($index + 1) * 10],
        ])->all();

        $match->channels()->sync($sync);
    }

    private function uniqueSlug(string $base): string
    {
        $slug = Str::slug($base);
        $candidate = $slug;
        $counter = 2;

        while (GameMatch::query()->where('slug', $candidate)->exists()) {
            $candidate = "{$slug}-{$counter}";
            $counter++;
        }

        return $candidate;
    }
}
