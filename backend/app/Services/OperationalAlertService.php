<?php

namespace App\Services;

use App\Models\OperationalAlert;

class OperationalAlertService
{
    public function open(string $type, string $dedupeKey, string $severity, string $title, ?string $message = null, array $metadata = []): OperationalAlert
    {
        return OperationalAlert::query()->updateOrCreate(
            ['dedupe_key' => $dedupeKey],
            [
                'type' => $type,
                'severity' => $severity,
                'status' => 'open',
                'title' => $title,
                'message' => $message,
                'metadata' => $this->sanitize($metadata),
                'resolved_at' => null,
            ]
        );
    }

    public function resolve(string $dedupeKey): void
    {
        OperationalAlert::query()
            ->where('dedupe_key', $dedupeKey)
            ->where('status', '!=', 'resolved')
            ->update(['status' => 'resolved', 'resolved_at' => now()]);
    }

    private function sanitize(array $metadata): array
    {
        unset($metadata['url'], $metadata['token'], $metadata['password']);

        return $metadata;
    }
}
