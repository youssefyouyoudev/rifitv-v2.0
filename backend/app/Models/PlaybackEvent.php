<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlaybackEvent extends Model
{
    protected $fillable = ['match_id', 'stream_source_id', 'event_type', 'metadata', 'occurred_at'];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'occurred_at' => 'immutable_datetime',
        ];
    }
}
