<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CompetitionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'short_name' => $this->short_name,
            'logo_path' => $this->logo_path,
            'country_code' => $this->country_code,
            'active' => $this->active,
            'featured' => $this->featured,
            'selection_mode' => $this->selection_mode?->value,
            'sort_order' => $this->sort_order,
            'featured_teams' => TeamResource::collection($this->whenLoaded('featuredTeams')),
            'matches' => MatchResource::collection($this->whenLoaded('matches')),
        ];
    }
}
