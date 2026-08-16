<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiveIngest extends Model
{
    protected $fillable = [
        'stream_source_id',
        'status',
        'transport',
        'session_key',
        'output_path',
        'public_path',
        'pid',
        'process_started_at',
        'ready_at',
        'last_segment_at',
        'segment_count',
        'reconnect_count',
        'restart_count',
        'last_error',
        'metrics',
    ];

    protected function casts(): array
    {
        return [
            'pid' => 'integer',
            'process_started_at' => 'immutable_datetime',
            'ready_at' => 'immutable_datetime',
            'last_segment_at' => 'immutable_datetime',
            'segment_count' => 'integer',
            'reconnect_count' => 'integer',
            'restart_count' => 'integer',
            'metrics' => 'array',
        ];
    }

    public function streamSource(): BelongsTo
    {
        return $this->belongsTo(StreamSource::class);
    }
}
