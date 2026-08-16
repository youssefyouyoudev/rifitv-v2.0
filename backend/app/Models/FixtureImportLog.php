<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FixtureImportLog extends Model
{
    protected $fillable = ['sync_run_id', 'provider', 'external_id', 'home_name', 'away_name', 'competition_name', 'status', 'message', 'safe_payload'];

    protected function casts(): array
    {
        return ['safe_payload' => 'array'];
    }

    public function syncRun(): BelongsTo
    {
        return $this->belongsTo(SyncRun::class);
    }
}
