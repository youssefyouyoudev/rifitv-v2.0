<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('matches')
            ->whereNotNull('source_provider')
            ->whereNotIn('source_provider', ['manual', 'manual-admin', 'manual-copy'])
            ->whereNull('manual_overrides')
            ->update(['featured' => false]);
    }

    public function down(): void
    {
        // The previous automatic featured state is not recoverable safely.
    }
};
