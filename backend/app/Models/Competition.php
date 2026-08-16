<?php

namespace App\Models;

use App\Enums\CompetitionSelectionMode;
use Database\Factories\CompetitionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Competition extends Model
{
    /** @use HasFactory<CompetitionFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'short_name',
        'logo_path',
        'country_code',
        'active',
        'featured',
        'selection_mode',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'featured' => 'boolean',
            'selection_mode' => CompetitionSelectionMode::class,
            'sort_order' => 'integer',
        ];
    }

    public function matches(): HasMany
    {
        return $this->hasMany(GameMatch::class);
    }

    public function seasons(): HasMany
    {
        return $this->hasMany(Season::class);
    }

    public function rule(): HasOne
    {
        return $this->hasOne(CompetitionRule::class);
    }

    public function featuredTeams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'featured_teams')->withPivot('sort_order')->withTimestamps();
    }
}
