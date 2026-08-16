<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncRun extends Model
{
    protected $fillable = ['type', 'provider', 'started_at', 'finished_at', 'status', 'created_count', 'updated_count', 'ignored_count', 'failed_count', 'error_summary', 'metadata'];

    protected function casts(): array
    {
        return [
            'started_at' => 'immutable_datetime',
            'finished_at' => 'immutable_datetime',
            'metadata' => 'array',
        ];
    }
}
