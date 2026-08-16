<?php

namespace App\Services;

use Illuminate\Support\Str;

class ChannelNameNormalizer
{
    /** @return array{original_name:string,canonical_name:string,normalized_name:string,original_group_name:?string,normalized_group:string,quality_label:string,natural_sort:int} */
    public function normalize(string $name, ?string $group = null): array
    {
        $original = trim(preg_replace('/\s+/', ' ', $name) ?: $name);
        $quality = $this->quality($original);
        $canonical = $this->canonicalName($original);
        $normalizedGroup = $this->group($group ?: $this->inferGroup($canonical));
        if ($normalizedGroup === 'Sports' && str_contains(Str::of($canonical)->lower()->replaceMatches('/[^a-z0-9]+/', ''), 'beinsport')) {
            $normalizedGroup = 'beIN Sports';
        }

        return [
            'original_name' => $original,
            'canonical_name' => $canonical,
            'normalized_name' => Str::of($canonical)->lower()->replaceMatches('/[^a-z0-9]+/', ' ')->squish()->toString(),
            'original_group_name' => $group,
            'normalized_group' => $normalizedGroup,
            'quality_label' => $quality,
            'natural_sort' => $this->naturalSort($canonical, $quality, $normalizedGroup),
        ];
    }

    public function quality(string $name): string
    {
        $upper = Str::upper($name);

        return match (true) {
            str_contains($upper, '4K'), str_contains($upper, 'UHD') => '4K',
            str_contains($upper, 'FULL HD'), str_contains($upper, 'FHD'), str_contains($upper, '1080') => 'FHD',
            str_contains($upper, 'HD'), str_contains($upper, '720') => 'HD',
            str_contains($upper, 'SD'), str_contains($upper, '480') => 'SD',
            default => 'UNKNOWN',
        };
    }

    public function group(?string $group): string
    {
        $value = Str::of((string) $group)->trim()->replaceMatches('/\s+/', ' ')->toString();
        $normalized = Str::of($value)->lower()->replaceMatches('/[^a-z0-9]+/', '')->toString();

        return match (true) {
            $normalized === '' => 'Other',
            in_array($normalized, ['favorite', 'favorites'], true) => 'Favorites',
            in_array($normalized, ['beinsport', 'beinsports', 'bein', 'beinmax', 'beinsportmax'], true),
            str_contains($normalized, 'beinsport') => 'beIN Sports',
            in_array($normalized, ['sport', 'sports', 'football', 'soccer'], true),
            str_contains($normalized, 'sport') => 'Sports',
            in_array($normalized, ['morocco', 'maroc', 'ma', 'marocaine'], true) => 'Morocco',
            str_contains($normalized, 'ssc') => 'SSC',
            str_contains($normalized, 'news') => 'News',
            str_contains($normalized, 'entertainment') => 'Entertainment',
            default => Str::of($value)->headline()->toString(),
        };
    }

    private function canonicalName(string $name): string
    {
        $value = Str::of($name)
            ->replace(['_', '|'], ' ')
            ->replaceMatches('/\s+/', ' ')
            ->replaceMatches('/\b(HD|FHD|FULL HD|SD|UHD|4K)\b(?:\s+\1\b)+/i', '$1')
            ->trim()
            ->toString();

        $value = preg_replace('/\bBEIN\s*SPORTS?\b/i', 'beIN Sports', $value) ?: $value;
        $value = preg_replace('/\bMAX\s+(\d+)/i', 'Max $1', $value) ?: $value;

        return trim($value);
    }

    private function inferGroup(string $name): string
    {
        $flat = Str::of($name)->lower()->replaceMatches('/[^a-z0-9]+/', '')->toString();

        return match (true) {
            str_contains($flat, 'beinsport') => 'beIN Sports',
            str_contains($flat, 'arryadia'), str_contains($flat, 'morocco'), str_contains($flat, 'maroc') => 'Morocco',
            str_contains($flat, 'ssc') => 'SSC',
            str_contains($flat, 'sport') => 'Sports',
            default => 'Other',
        };
    }

    private function naturalSort(string $name, string $quality, string $group): int
    {
        $groupRank = match ($group) {
            'Favorites' => 0,
            'beIN Sports' => 1000,
            'Sports' => 2000,
            'Morocco' => 3000,
            'SSC' => 4000,
            'News' => 5000,
            'Entertainment' => 6000,
            default => 9000,
        };

        preg_match('/(?:Sports|Max)\s*(\d+)/i', $name, $match);
        $number = isset($match[1]) ? ((int) $match[1]) : 999;
        $maxBonus = str_contains(Str::lower($name), 'max') ? 500 : 0;
        $qualityRank = match ($quality) {
            '4K' => 0,
            'FHD' => 5,
            'HD' => 10,
            'SD' => 20,
            default => 30,
        };

        return $groupRank + $maxBonus + ($number * 40) + $qualityRank;
    }
}
