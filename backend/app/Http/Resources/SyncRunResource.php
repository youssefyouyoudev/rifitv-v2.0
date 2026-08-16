<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SyncRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        if (! $this->resource) {
            return [];
        }

        return [
            'id' => $this->id,
            'type' => $this->type,
            'provider' => $this->provider,
            'status' => $this->status,
            'started_at' => $this->started_at?->toIso8601String(),
            'finished_at' => $this->finished_at?->toIso8601String(),
            'created_count' => $this->created_count,
            'updated_count' => $this->updated_count,
            'ignored_count' => $this->ignored_count,
            'failed_count' => $this->failed_count,
            'error_summary' => $this->error_summary,
        ];
    }
}
