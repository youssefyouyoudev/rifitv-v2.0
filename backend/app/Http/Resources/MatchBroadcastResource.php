<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MatchBroadcastResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'territory' => $this->territory,
            'assignment_status' => $this->assignment_status,
            'languages' => $this->languages,
            'verified_at' => $this->verified_at?->toIso8601String(),
            'broadcaster' => [
                'id' => $this->broadcaster?->id,
                'name' => $this->broadcaster?->name,
                'slug' => $this->broadcaster?->slug,
                'territory' => $this->broadcaster?->territory,
            ],
            'channel' => $this->channel ? new ChannelResource($this->channel) : null,
        ];
    }
}
