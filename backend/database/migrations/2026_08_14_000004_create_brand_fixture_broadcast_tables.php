<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seasons', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('competition_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->date('starts_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->boolean('active')->default(true);
            $table->string('source_url')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->unique(['competition_id', 'slug']);
        });

        Schema::table('teams', function (Blueprint $table): void {
            $table->json('aliases')->nullable()->after('primary_color');
        });

        Schema::table('matches', function (Blueprint $table): void {
            $table->foreignId('season_id')->nullable()->after('competition_id')->constrained()->nullOnDelete();
            $table->timestamp('kickoff_at')->nullable()->change();
            $table->date('scheduled_date')->nullable()->after('kickoff_at');
            $table->string('kickoff_precision', 24)->default('confirmed')->after('scheduled_date');
            $table->string('source_timezone', 64)->nullable()->after('kickoff_precision');
            $table->unsignedSmallInteger('source_matchday')->nullable()->after('source_timezone');
            $table->string('source_round_label')->nullable()->after('source_matchday');
            $table->string('source_reference')->nullable()->after('source_round_label');

            $table->index(['scheduled_date', 'status']);
            $table->index(['season_id', 'source_matchday']);
        });

        Schema::create('broadcasters', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('territory', 24)->default('MENA')->index();
            $table->string('website_url')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('match_broadcasts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('match_id')->constrained('matches')->cascadeOnDelete();
            $table->foreignId('broadcaster_id')->constrained()->cascadeOnDelete();
            $table->foreignId('channel_id')->nullable()->constrained()->nullOnDelete();
            $table->string('territory', 24)->default('MENA');
            $table->json('languages')->nullable();
            $table->string('assignment_status', 32)->default('network_confirmed');
            $table->string('source_reference')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->unique(['match_id', 'broadcaster_id', 'territory']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_broadcasts');
        Schema::dropIfExists('broadcasters');

        Schema::table('matches', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('season_id');
            $table->dropColumn([
                'scheduled_date',
                'kickoff_precision',
                'source_timezone',
                'source_matchday',
                'source_round_label',
                'source_reference',
            ]);
        });

        Schema::table('teams', function (Blueprint $table): void {
            $table->dropColumn('aliases');
        });

        Schema::dropIfExists('seasons');
    }
};
