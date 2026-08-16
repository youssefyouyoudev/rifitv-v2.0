<?php

namespace App\Models;

use Database\Factories\ChannelFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Channel extends Model
{
    /** @use HasFactory<ChannelFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'playlist_id',
        'external_id',
        'tvg_id',
        'name',
        'original_name',
        'canonical_name',
        'normalized_name',
        'slug',
        'logo_path',
        'country_code',
        'language',
        'category',
        'playlist_group',
        'original_group_name',
        'normalized_group',
        'quality_label',
        'protocol',
        'health_status',
        'browser_compatible',
        'favorite',
        'natural_sort',
        'stream_url_hash',
        'last_seen_at',
        'catalog_status',
        'metadata',
        'active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'favorite' => 'boolean',
            'sort_order' => 'integer',
            'natural_sort' => 'integer',
            'last_seen_at' => 'immutable_datetime',
            'metadata' => 'array',
        ];
    }

    public function playlist(): BelongsTo
    {
        return $this->belongsTo(Playlist::class);
    }

    public function matches(): BelongsToMany
    {
        return $this->belongsToMany(GameMatch::class, 'match_channels', 'channel_id', 'match_id')
            ->withPivot('sort_order')
            ->withTimestamps();
    }

    public function streamSources(): HasMany
    {
        return $this->hasMany(StreamSource::class)->orderBy('priority')->orderBy('id');
    }
}
