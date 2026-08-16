<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OperationalAlert extends Model
{
    protected $fillable = ['type', 'dedupe_key', 'severity', 'status', 'title', 'message', 'entity_type', 'entity_id', 'metadata', 'acknowledged_at', 'resolved_at'];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'acknowledged_at' => 'immutable_datetime',
            'resolved_at' => 'immutable_datetime',
        ];
    }
}
