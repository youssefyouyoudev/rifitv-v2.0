<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HomepageSectionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'key' => $this->key,
            'title' => $this->title,
            'type' => $this->type,
            'enabled' => $this->enabled,
            'sort_order' => $this->sort_order,
            'limit' => $this->limit,
            'competition_id' => $this->competition_id,
            'hero_match_id' => $this->hero_match_id,
            'configuration' => $this->configuration,
        ];
    }
}
