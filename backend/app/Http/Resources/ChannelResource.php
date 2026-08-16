<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ChannelResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'original_name' => $this->original_name,
            'canonical_name' => $this->canonical_name,
            'normalized_name' => $this->normalized_name,
            'slug' => $this->slug,
            'logo_path' => $this->logo_path,
            'country_code' => $this->country_code,
            'language' => $this->language,
            'category' => $this->category,
            'playlist_id' => $this->playlist_id,
            'playlist_group' => $this->playlist_group,
            'original_group_name' => $this->original_group_name,
            'normalized_group' => $this->normalized_group,
            'quality_label' => $this->quality_label,
            'protocol' => $this->protocol,
            'health_status' => $this->health_status,
            'browser_compatible' => $this->browser_compatible,
            'favorite' => $this->favorite,
            'catalog_status' => $this->catalog_status,
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
            'active' => $this->active,
            'sort_order' => $this->sort_order,
            'sources_count' => $this->whenCounted('streamSources'),
            'stream_sources' => StreamSourceResource::collection($this->whenLoaded('streamSources')),
        ];
    }
}
