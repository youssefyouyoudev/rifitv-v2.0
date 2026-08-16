<?php

namespace App\Services;

use App\Models\HomepageSection;
use App\Models\User;

class HomepageService
{
    public function __construct(private readonly AuditService $audit) {}

    public function update(array $sections, ?User $actor): void
    {
        foreach ($sections as $index => $section) {
            HomepageSection::query()->updateOrCreate(
                ['key' => $section['key']],
                [
                    'title' => $section['title'],
                    'type' => $section['type'],
                    'enabled' => $section['enabled'] ?? true,
                    'sort_order' => $section['sort_order'] ?? (($index + 1) * 10),
                    'limit' => $section['limit'] ?? 8,
                    'competition_id' => $section['competition_id'] ?? null,
                    'hero_match_id' => $section['hero_match_id'] ?? null,
                    'configuration' => $section['configuration'] ?? null,
                ]
            );
        }

        $this->audit->record($actor, 'homepage.updated', null, ['sections' => count($sections)]);
    }
}
