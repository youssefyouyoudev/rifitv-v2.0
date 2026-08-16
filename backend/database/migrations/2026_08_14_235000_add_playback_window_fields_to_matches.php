<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('matches', function (Blueprint $table): void {
            $table->timestamp('actual_started_at')->nullable()->after('kickoff_at');
            $table->timestamp('playback_open_override_at')->nullable()->after('actual_started_at');
            $table->timestamp('playback_close_override_at')->nullable()->after('playback_open_override_at');
        });
    }

    public function down(): void
    {
        Schema::table('matches', function (Blueprint $table): void {
            $table->dropColumn(['actual_started_at', 'playback_open_override_at', 'playback_close_override_at']);
        });
    }
};
