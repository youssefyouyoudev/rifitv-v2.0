<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TeamResource extends JsonResource
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
            'primary_color' => $this->primary_color,
            'aliases' => $this->aliases ?? [],
            'active' => $this->active,
            'featured' => $this->featured,
        ];
    }
}
