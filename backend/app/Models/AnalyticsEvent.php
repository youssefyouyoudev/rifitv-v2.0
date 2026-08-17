<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AnalyticsEvent extends Model
{
    protected $fillable = [
        'event',
        'visitor_hash',
        'path',
        'payload',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'occurred_at' => 'datetime',
        ];
    }
}
