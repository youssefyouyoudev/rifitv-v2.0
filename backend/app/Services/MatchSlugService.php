<?php

namespace App\Services;

use App\Models\GameMatch;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class MatchSlugService
{
    public function __construct(private readonly MatchDateWindowService $dateWindow) {}

    public function assign(GameMatch $match): void
    {
        $match->loadMissing(['homeTeam', 'awayTeam']);

        $slug = $this->uniqueSlug(
            $match->homeTeam->name,
            $match->awayTeam->name,
            $match->kickoff_at,
            $match->scheduled_date?->toDateString(),
            $match->id,
        );

        $legacySlugs = $match->legacy_slugs ?? [];
        if ($match->slug && $match->slug !== $slug) {
            $legacySlugs[] = $match->slug;
        }

        $match->forceFill([
            'slug' => $slug,
            'legacy_slugs' => array_values(array_unique(array_filter($legacySlugs))),
        ])->saveQuietly();
    }

    public function uniqueSlug(string $homeName, string $awayName, mixed $kickoffAt = null, ?string $scheduledDate = null, ?int $ignoreId = null): string
    {
        $date = $kickoffAt
            ? Carbon::parse($kickoffAt)->timezone($this->dateWindow->timezone())->toDateString()
            : ($scheduledDate ?: 'tbc');
        $base = Str::slug(Str::ascii("{$homeName} vs {$awayName} {$date}"));
        $candidate = $base;
        $counter = 2;

        while (GameMatch::withTrashed()
            ->where('slug', $candidate)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists()) {
            $candidate = "{$base}-{$counter}";
            $counter++;
        }

        return $candidate;
    }
}
