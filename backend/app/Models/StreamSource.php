<?php

namespace App\Models;

use App\Enums\StreamHealth;
use App\Enums\StreamProtocol;
use Database\Factories\StreamSourceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class StreamSource extends Model
{
    /** @use HasFactory<StreamSourceFactory> */
    use HasFactory;

    protected $fillable = [
        'channel_id',
        'playlist_id',
        'name',
        'protocol',
        'transport',
        'direct_playable',
        'gateway_required',
        'url',
        'priority',
        'enabled',
        'is_backup',
        'last_known_status',
        'last_checked_at',
        'latency_ms',
        'last_success_at',
        'consecutive_failures',
        'consecutive_successes',
        'health_score',
        'last_error_type',
        'source_origin',
        'import_key',
        'url_hash',
        'browser_compatible',
        'video_codec',
        'audio_codec',
        'container',
        'resolution',
        'frame_rate',
    ];

    protected function casts(): array
    {
        return [
            'protocol' => StreamProtocol::class,
            'direct_playable' => 'boolean',
            'gateway_required' => 'boolean',
            'priority' => 'integer',
            'enabled' => 'boolean',
            'is_backup' => 'boolean',
            'last_known_status' => StreamHealth::class,
            'last_checked_at' => 'immutable_datetime',
            'latency_ms' => 'integer',
            'last_success_at' => 'immutable_datetime',
            'consecutive_failures' => 'integer',
            'consecutive_successes' => 'integer',
            'health_score' => 'integer',
            'frame_rate' => 'decimal:3',
        ];
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    public function playlist(): BelongsTo
    {
        return $this->belongsTo(Playlist::class);
    }

    public function liveIngest(): HasOne
    {
        return $this->hasOne(LiveIngest::class);
    }
}
