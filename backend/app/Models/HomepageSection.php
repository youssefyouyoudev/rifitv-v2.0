<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HomepageSection extends Model
{
    protected $fillable = [
        'key',
        'title',
        'type',
        'enabled',
        'sort_order',
        'limit',
        'competition_id',
        'hero_match_id',
        'configuration',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'sort_order' => 'integer',
            'limit' => 'integer',
            'configuration' => 'array',
        ];
    }

    public function competition(): BelongsTo
    {
        return $this->belongsTo(Competition::class);
    }

    public function heroMatch(): BelongsTo
    {
        return $this->belongsTo(GameMatch::class, 'hero_match_id');
    }
}
