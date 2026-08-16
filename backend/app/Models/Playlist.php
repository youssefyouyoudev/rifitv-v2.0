<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Playlist extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'type',
        'host',
        'status',
        'health_status',
        'source_url',
        'server_url',
        'username',
        'password',
        'file_path',
        'active',
        'auto_sync',
        'sync_interval_minutes',
        'channel_count',
        'group_count',
        'last_sync_at',
        'last_successful_sync_at',
        'last_error_category',
        'last_error_message',
    ];

    protected function casts(): array
    {
        return [
            'username' => 'encrypted',
            'password' => 'encrypted',
            'active' => 'boolean',
            'auto_sync' => 'boolean',
            'sync_interval_minutes' => 'integer',
            'channel_count' => 'integer',
            'group_count' => 'integer',
            'last_sync_at' => 'immutable_datetime',
            'last_successful_sync_at' => 'immutable_datetime',
        ];
    }

    public function channels(): HasMany
    {
        return $this->hasMany(Channel::class);
    }

    public function syncRuns(): HasMany
    {
        return $this->hasMany(PlaylistSyncRun::class);
    }

    public function latestSyncRun()
    {
        return $this->hasOne(PlaylistSyncRun::class)->latestOfMany();
    }
}
