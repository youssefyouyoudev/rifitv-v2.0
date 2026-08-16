<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlaylistSyncRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'playlist_id' => $this->playlist_id,
            'status' => $this->status,
            'phase' => $this->phase,
            'imported_count' => $this->imported_count,
            'updated_count' => $this->updated_count,
            'failed_count' => $this->failed_count,
            'error_category' => $this->error_category,
            'safe_message' => $this->safe_message,
            'started_at' => $this->started_at?->toIso8601String(),
            'finished_at' => $this->finished_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
