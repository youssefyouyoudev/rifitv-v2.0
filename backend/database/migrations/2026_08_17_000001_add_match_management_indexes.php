<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('matches', function (Blueprint $table): void {
            $table->index(['kickoff_at', 'competition_id', 'status'], 'matches_kickoff_competition_status_idx');
            $table->index(['status', 'kickoff_at'], 'matches_status_kickoff_idx');
            $table->index(['featured', 'kickoff_at'], 'matches_featured_kickoff_idx');
            $table->index(['verification_status', 'kickoff_at'], 'matches_verification_kickoff_idx');
        });

        Schema::table('match_channels', function (Blueprint $table): void {
            $table->index(['match_id', 'sort_order'], 'match_channels_match_sort_idx');
        });
    }

    public function down(): void
    {
        Schema::table('match_channels', function (Blueprint $table): void {
            $table->dropIndex('match_channels_match_sort_idx');
        });

        Schema::table('matches', function (Blueprint $table): void {
            $table->dropIndex('matches_kickoff_competition_status_idx');
            $table->dropIndex('matches_status_kickoff_idx');
            $table->dropIndex('matches_featured_kickoff_idx');
            $table->dropIndex('matches_verification_kickoff_idx');
        });
    }
};
