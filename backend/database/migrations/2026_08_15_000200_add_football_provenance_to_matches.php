<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('matches', function (Blueprint $table): void {
            $table->string('source_provider')->nullable()->after('provider');
            $table->string('source_external_id')->nullable()->after('source_provider');
            $table->timestamp('source_verified_at')->nullable()->after('source_reference');
            $table->string('source_hash', 64)->nullable()->after('source_verified_at');
            $table->string('verification_status', 32)->default('pending_verification')->after('source_hash');
            $table->string('kickoff_status', 24)->default('tbc')->after('kickoff_precision');

            $table->unique(['source_provider', 'source_external_id'], 'matches_source_provider_external_unique');
            $table->unique('source_hash', 'matches_source_hash_unique');
            $table->index('verification_status');
            $table->index(['source_provider', 'verification_status']);
        });

        DB::table('matches')->update([
            'source_provider' => DB::raw('provider'),
            'source_external_id' => DB::raw('external_id'),
            'source_verified_at' => DB::raw('last_synced_at'),
            'kickoff_status' => DB::raw('kickoff_precision'),
        ]);
    }

    public function down(): void
    {
        Schema::table('matches', function (Blueprint $table): void {
            $table->dropUnique('matches_source_provider_external_unique');
            $table->dropUnique('matches_source_hash_unique');
            $table->dropIndex(['verification_status']);
            $table->dropIndex(['source_provider', 'verification_status']);
            $table->dropColumn([
                'source_provider',
                'source_external_id',
                'source_verified_at',
                'source_hash',
                'verification_status',
                'kickoff_status',
            ]);
        });
    }
};
