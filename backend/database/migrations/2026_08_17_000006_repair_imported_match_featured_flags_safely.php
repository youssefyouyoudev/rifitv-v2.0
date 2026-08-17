<?php

use App\Models\GameMatch;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        GameMatch::withTrashed()
            ->whereNotNull('source_provider')
            ->whereNotIn('source_provider', ['manual', 'manual-admin', 'manual-copy'])
            ->orderBy('id')
            ->chunkById(200, function ($matches): void {
                foreach ($matches as $match) {
                    if (! $match->hasManualOverride('featured') && $match->featured) {
                        $match->forceFill(['featured' => false])->saveQuietly();
                    }
                }
            });
    }

    public function down(): void
    {
        // The previous automatic featured state is not recoverable safely.
    }
};
