<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Broadcaster extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'territory',
        'website_url',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }

    public function matchBroadcasts(): HasMany
    {
        return $this->hasMany(MatchBroadcast::class);
    }
}
