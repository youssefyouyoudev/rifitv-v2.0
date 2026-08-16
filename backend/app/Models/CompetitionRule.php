<?php

namespace App\Models;

use App\Enums\CompetitionSelectionMode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompetitionRule extends Model
{
    protected $fillable = ['competition_id', 'mode', 'active', 'configuration'];

    protected function casts(): array
    {
        return [
            'mode' => CompetitionSelectionMode::class,
            'active' => 'boolean',
            'configuration' => 'array',
        ];
    }

    public function competition(): BelongsTo
    {
        return $this->belongsTo(Competition::class);
    }
}
