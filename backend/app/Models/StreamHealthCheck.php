<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StreamHealthCheck extends Model
{
    protected $fillable = ['stream_source_id', 'status', 'latency_ms', 'error_category', 'checked_at'];

    protected function casts(): array
    {
        return ['checked_at' => 'immutable_datetime'];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(StreamSource::class, 'stream_source_id');
    }
}
