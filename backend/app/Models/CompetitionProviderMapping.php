<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompetitionProviderMapping extends Model
{
    protected $fillable = ['competition_id', 'provider', 'external_id', 'external_name', 'aliases'];

    protected function casts(): array
    {
        return ['aliases' => 'array'];
    }

    public function competition(): BelongsTo
    {
        return $this->belongsTo(Competition::class);
    }
}
