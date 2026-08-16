<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MatchBroadcast extends Model
{
    protected $fillable = [
        'match_id',
        'broadcaster_id',
        'channel_id',
        'territory',
        'languages',
        'assignment_status',
        'source_reference',
        'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'languages' => 'array',
            'verified_at' => 'immutable_datetime',
        ];
    }

    public function match(): BelongsTo
    {
        return $this->belongsTo(GameMatch::class, 'match_id');
    }

    public function broadcaster(): BelongsTo
    {
        return $this->belongsTo(Broadcaster::class);
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }
}
