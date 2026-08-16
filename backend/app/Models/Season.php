<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Season extends Model
{
    protected $fillable = [
        'competition_id',
        'name',
        'slug',
        'starts_at',
        'ends_at',
        'active',
        'source_url',
        'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'date',
            'ends_at' => 'date',
            'active' => 'boolean',
            'verified_at' => 'immutable_datetime',
        ];
    }

    public function competition(): BelongsTo
    {
        return $this->belongsTo(Competition::class);
    }

    public function matches(): HasMany
    {
        return $this->hasMany(GameMatch::class);
    }
}
