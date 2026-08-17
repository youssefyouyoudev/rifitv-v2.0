<?php

namespace App\Services;

use App\Enums\MatchStatus;
use App\Enums\MatchVisibility;
use App\Models\GameMatch;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MatchService
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly MatchSlugService $slugs,
        private readonly PublicContentService $content,
    ) {}

    public function create(array $data, ?User $actor): GameMatch
    {
        $payload = $this->payload($data);
        $home = Team::query()->findOrFail((int) $data['home_team_id']);
        $away = Team::query()->findOrFail((int) $data['away_team_id']);
        $payload['slug'] = $this->slugs->uniqueSlug($home->name, $away->name, $payload['kickoff_at'], $payload['scheduled_date']);
        $match = GameMatch::query()->create($payload);
        $this->slugs->assign($match);
        $this->syncChannels($match, $data['channel_ids'] ?? []);
        $this->content->forgetHome();
        $this->audit->record($actor, 'match.created', $match, ['slug' => $match->slug]);

        return $match->fresh(['competition', 'homeTeam', 'awayTeam', 'channels.streamSources']);
    }

    public function update(GameMatch $match, array $data, ?User $actor): GameMatch
    {
        $before = $match->only(['status', 'home_score', 'away_score', 'minute', 'published_at', 'featured', 'slug']);
        $match->update($this->payload($data, $match));
        $this->slugs->assign($match);

        if (array_key_exists('channel_ids', $data)) {
            $this->syncChannels($match, $data['channel_ids']);
        }

        $this->audit->record($actor, 'match.updated', $match, ['before' => $before]);
        $this->content->forgetHome();

        return $match->fresh(['competition', 'homeTeam', 'awayTeam', 'channels.streamSources']);
    }

    public function setPublication(GameMatch $match, bool $published, ?string $visibility, ?User $actor): GameMatch
    {
        $before = $match->only(['published_at', 'visibility']);
        $match->update([
            'published_at' => $published ? ($match->published_at ?? now()) : null,
            'visibility' => $visibility ?? ($published ? MatchVisibility::Public : $match->visibility),
        ]);
        $this->audit->record($actor, $published ? 'match.published' : 'match.unpublished', $match, ['before' => $before]);
        $this->content->forgetHome();

        return $match->fresh(['competition', 'homeTeam', 'awayTeam', 'channels.streamSources']);
    }

    public function duplicate(GameMatch $match, ?User $actor): GameMatch
    {
        $copy = $match->replicate(['slug', 'home_score', 'away_score', 'minute', 'status', 'published_at', 'source_external_id', 'source_hash']);
        $copy->slug = $match->slug.'-copy-'.Str::lower(Str::random(8));
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
        $this->slugs->assign($copy);
        $copy->channels()->sync($match->channels->pluck('id')->all());
        $this->audit->record($actor, 'match.duplicated', $copy, ['from' => $match->id]);
        $this->content->forgetHome();

        return $copy->fresh(['competition', 'homeTeam', 'awayTeam', 'channels.streamSources']);
    }

    public function archive(GameMatch $match, ?User $actor): void
    {
        $match->delete();
        $this->audit->record($actor, 'match.archived', $match);
        $this->content->forgetHome();
    }

    public function bulk(array $ids, string $action, ?User $actor, array $options = []): int
    {
        if ($action === 'delete' && ! (bool) ($options['confirm_delete'] ?? false)) {
            throw ValidationException::withMessages(['confirm_delete' => ['Delete confirmation is required.']]);
        }

        $matches = GameMatch::query()->whereIn('id', $ids)->get();

        foreach ($matches as $match) {
            match ($action) {
                'publish' => $match->update(['published_at' => $match->published_at ?? now(), 'visibility' => MatchVisibility::Public]),
                'unpublish' => $match->update(['published_at' => null]),
                'feature' => $this->setFeatured($match, true),
                'unfeature' => $this->setFeatured($match, false),
                'verify' => $match->update(['verification_status' => 'manual_verified', 'source_verified_at' => now()]),
                'assign_competition' => $match->update(['competition_id' => (int) $options['competition_id']]),
                'set_status' => $match->update(['status' => MatchStatus::from($options['status'])]),
                'delete' => $match->delete(),
                default => null,
            };
        }

        $this->audit->record($actor, 'matches.bulk_'.$action, null, ['count' => $matches->count(), 'options' => $options]);
        $this->content->forgetHome();

        return $matches->count();
    }

    private function payload(array $data, ?GameMatch $existing = null): array
    {
        $timezone = (string) config('rifitv.display_timezone', 'Africa/Casablanca');
        $kickoff = isset($data['kickoff_at']) ? Carbon::parse($data['kickoff_at'], $timezone) : $existing?->kickoff_at;
        $published = (bool) ($data['published'] ?? (bool) $existing?->published_at);
        $sourceProvider = $existing?->source_provider ?? 'manual-admin';
        $isManual = in_array($sourceProvider, ['manual', 'manual-admin', 'manual-copy'], true);
        $verificationStatus = $existing?->verification_status ?? 'pending_verification';
        $sourceVerifiedAt = $existing?->source_verified_at;
        $manualOverrides = $existing?->manual_overrides ?? [];

        if (array_key_exists('featured', $data)) {
            data_set($manualOverrides, 'featured', true);
        }

        if ($isManual && $published) {
            $verificationStatus = 'manual_verified';
            $sourceVerifiedAt ??= now();
        }

        return [
            'competition_id' => $data['competition_id'] ?? $existing?->competition_id,
            'home_team_id' => $data['home_team_id'] ?? $existing?->home_team_id,
            'away_team_id' => $data['away_team_id'] ?? $existing?->away_team_id,
            'kickoff_at' => $kickoff?->utc(),
            'scheduled_date' => $kickoff?->toDateString() ?? $existing?->scheduled_date,
            'source_provider' => $sourceProvider,
            'source_external_id' => $existing?->source_external_id,
            'source_verified_at' => $sourceVerifiedAt,
            'verification_status' => $verificationStatus,
            'status' => $data['status'] ?? $existing?->status ?? MatchStatus::Scheduled,
            'home_score' => $data['home_score'] ?? $existing?->home_score,
            'away_score' => $data['away_score'] ?? $existing?->away_score,
            'minute' => $data['minute'] ?? $existing?->minute,
            'featured' => $data['featured'] ?? $existing?->featured ?? false,
            'manual_overrides' => $manualOverrides,
            'published_at' => $published ? ($existing?->published_at ?? now()) : null,
            'visibility' => $data['visibility'] ?? $existing?->visibility ?? MatchVisibility::Public,
            'seo_title' => $data['seo_title'] ?? $existing?->seo_title,
            'seo_description' => $data['seo_description'] ?? $existing?->seo_description,
            'notes' => $data['notes'] ?? $existing?->notes,
            'slug' => $existing?->slug,
        ];
    }

    private function syncChannels(GameMatch $match, array $channelIds): void
    {
        $sync = collect($channelIds)->values()->mapWithKeys(fn (int|string $id, int $index): array => [
            (int) $id => ['sort_order' => ($index + 1) * 10],
        ])->all();

        $match->channels()->sync($sync);
    }

    public function setFeatured(GameMatch $match, bool $featured): GameMatch
    {
        $manualOverrides = $match->manual_overrides ?? [];
        data_set($manualOverrides, 'featured', true);

        $match->update(['featured' => $featured, 'manual_overrides' => $manualOverrides]);
        $this->content->forgetHome();

        return $match->fresh(['competition', 'homeTeam', 'awayTeam', 'channels.streamSources']);
    }
}
