<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Throwable;

class AuditService
{
    public function record(?User $actor, string $action, ?Model $entity = null, array $metadata = []): ?AuditLog
    {
        try {
            return AuditLog::query()->create([
                'actor_id' => $actor?->id,
                'action' => $action,
                'entity_type' => $entity ? $entity::class : null,
                'entity_id' => $entity?->getKey(),
                'metadata' => $this->sanitize($metadata),
            ]);
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }

    private function sanitize(array $metadata): array
    {
        unset($metadata['password'], $metadata['token'], $metadata['url']);

        if (isset($metadata['source_url'])) {
            $metadata['source_url'] = '[redacted]';
        }

        return $metadata;
    }
}
