<?php

namespace App\Models;

use App\Enums\MatchStatus;
use App\Enums\MatchVisibility;
use Database\Factories\GameMatchFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class GameMatch extends Model
{
    /** @use HasFactory<GameMatchFactory> */
    use HasFactory, SoftDeletes;

    protected $table = 'matches';

    protected $fillable = [
        'competition_id',
        'season_id',
        'provider',
        'external_id',
        'source_provider',
        'source_external_id',
        'last_synced_at',
        'sync_status',
        'manual_overrides',
        'home_team_id',
        'away_team_id',
        'kickoff_at',
        'actual_started_at',
        'playback_open_override_at',
        'playback_close_override_at',
        'scheduled_date',
        'kickoff_precision',
        'kickoff_status',
        'source_timezone',
        'source_matchday',
        'source_round_label',
        'source_reference',
        'source_verified_at',
        'source_hash',
        'verification_status',
        'status',
        'home_score',
        'away_score',
        'minute',
        'featured',
        'published_at',
        'visibility',
        'seo_title',
        'seo_description',
        'notes',
        'slug',
    ];

    protected function casts(): array
    {
        return [
            'kickoff_at' => 'immutable_datetime',
            'actual_started_at' => 'immutable_datetime',
            'playback_open_override_at' => 'immutable_datetime',
            'playback_close_override_at' => 'immutable_datetime',
            'scheduled_date' => 'date',
            'last_synced_at' => 'immutable_datetime',
            'source_verified_at' => 'immutable_datetime',
            'status' => MatchStatus::class,
            'home_score' => 'integer',
            'away_score' => 'integer',
            'minute' => 'integer',
            'featured' => 'boolean',
            'published_at' => 'immutable_datetime',
            'visibility' => MatchVisibility::class,
            'manual_overrides' => 'array',
            'source_matchday' => 'integer',
        ];
    }

    public function hasManualOverride(string $field): bool
    {
        return (bool) data_get($this->manual_overrides ?? [], $field, false);
    }

    public function competition(): BelongsTo
    {
        return $this->belongsTo(Competition::class);
    }

    public function season(): BelongsTo
    {
        return $this->belongsTo(Season::class);
    }

    public function homeTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'home_team_id');
    }

    public function awayTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'away_team_id');
    }

    public function channels(): BelongsToMany
    {
        return $this->belongsToMany(Channel::class, 'match_channels', 'match_id', 'channel_id')
            ->withPivot('sort_order')
            ->withTimestamps()
            ->orderByPivot('sort_order');
    }

    public function broadcasts(): HasMany
    {
        return $this->hasMany(MatchBroadcast::class, 'match_id');
    }

    public function scopePublicGraph(Builder $query): Builder
    {
        return $query->with(['competition', 'season', 'homeTeam', 'awayTeam', 'channels.streamSources', 'broadcasts.broadcaster', 'broadcasts.channel']);
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query
            ->whereNotNull('published_at')
            ->where('visibility', MatchVisibility::Public)
            ->whereIn('verification_status', ['verified', 'manual_verified']);
    }

    public function getScoreLabelAttribute(): string
    {
        return ($this->home_score ?? '-').' - '.($this->away_score ?? '-');
    }
}
