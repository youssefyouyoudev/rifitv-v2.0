<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlaylistSyncRun extends Model
{
    protected $fillable = [
        'playlist_id',
        'status',
        'phase',
        'imported_count',
        'updated_count',
        'failed_count',
        'error_category',
        'safe_message',
        'started_at',
        'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'imported_count' => 'integer',
            'updated_count' => 'integer',
            'failed_count' => 'integer',
            'started_at' => 'immutable_datetime',
            'finished_at' => 'immutable_datetime',
        ];
    }

    public function playlist(): BelongsTo
    {
        return $this->belongsTo(Playlist::class);
    }
}
