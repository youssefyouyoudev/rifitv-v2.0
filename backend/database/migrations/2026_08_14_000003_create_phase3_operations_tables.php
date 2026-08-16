<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('matches', function (Blueprint $table): void {
            $table->string('provider')->nullable()->after('id');
            $table->string('external_id')->nullable()->after('provider');
            $table->timestamp('last_synced_at')->nullable()->after('external_id');
            $table->string('sync_status', 32)->nullable()->after('last_synced_at');
            $table->json('manual_overrides')->nullable()->after('sync_status');
            $table->unique(['provider', 'external_id']);
            $table->index(['provider', 'sync_status']);
        });

        Schema::table('stream_sources', function (Blueprint $table): void {
            $table->unsignedInteger('latency_ms')->nullable()->after('last_checked_at');
            $table->timestamp('last_success_at')->nullable()->after('latency_ms');
            $table->unsignedInteger('consecutive_failures')->default(0)->after('last_success_at');
            $table->unsignedInteger('consecutive_successes')->default(0)->after('consecutive_failures');
            $table->unsignedTinyInteger('health_score')->default(50)->after('consecutive_successes');
            $table->string('last_error_type', 64)->nullable()->after('health_score');
            $table->index(['enabled', 'last_known_status']);
        });

        Schema::create('team_provider_mappings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->string('provider');
            $table->string('external_id');
            $table->string('external_name');
            $table->json('aliases')->nullable();
            $table->timestamps();
            $table->unique(['provider', 'external_id']);
        });

        Schema::create('competition_provider_mappings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('competition_id')->constrained()->cascadeOnDelete();
            $table->string('provider');
            $table->string('external_id');
            $table->string('external_name');
            $table->json('aliases')->nullable();
            $table->timestamps();
            $table->unique(['provider', 'external_id']);
        });

        Schema::create('sync_runs', function (Blueprint $table): void {
            $table->id();
            $table->string('type', 48);
            $table->string('provider')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->string('status', 32)->default('running');
            $table->unsignedInteger('created_count')->default(0);
            $table->unsignedInteger('updated_count')->default(0);
            $table->unsignedInteger('ignored_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->text('error_summary')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['type', 'started_at']);
            $table->index(['status', 'started_at']);
        });

        Schema::create('fixture_import_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sync_run_id')->nullable()->constrained('sync_runs')->nullOnDelete();
            $table->string('provider');
            $table->string('external_id')->nullable();
            $table->string('home_name')->nullable();
            $table->string('away_name')->nullable();
            $table->string('competition_name')->nullable();
            $table->string('status', 32);
            $table->text('message')->nullable();
            $table->json('safe_payload')->nullable();
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });

        Schema::create('stream_health_checks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('stream_source_id')->constrained()->cascadeOnDelete();
            $table->string('status', 32);
            $table->unsignedInteger('latency_ms')->nullable();
            $table->string('error_category', 64)->nullable();
            $table->timestamp('checked_at');
            $table->timestamps();
            $table->index(['stream_source_id', 'checked_at']);
        });

        Schema::create('operational_alerts', function (Blueprint $table): void {
            $table->id();
            $table->string('type', 64);
            $table->string('dedupe_key')->unique();
            $table->string('severity', 24)->default('warning');
            $table->string('status', 24)->default('open');
            $table->string('title');
            $table->text('message')->nullable();
            $table->string('entity_type')->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'severity']);
            $table->index(['type', 'created_at']);
        });

        Schema::create('playback_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('match_id')->nullable()->constrained('matches')->nullOnDelete();
            $table->foreignId('stream_source_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_type', 64);
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();
            $table->index(['event_type', 'occurred_at']);
            $table->index(['stream_source_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('playback_events');
        Schema::dropIfExists('operational_alerts');
        Schema::dropIfExists('stream_health_checks');
        Schema::dropIfExists('fixture_import_logs');
        Schema::dropIfExists('sync_runs');
        Schema::dropIfExists('competition_provider_mappings');
        Schema::dropIfExists('team_provider_mappings');
        Schema::table('stream_sources', function (Blueprint $table): void {
            $table->dropColumn(['latency_ms', 'last_success_at', 'consecutive_failures', 'consecutive_successes', 'health_score', 'last_error_type']);
        });
        Schema::table('matches', function (Blueprint $table): void {
            $table->dropUnique(['provider', 'external_id']);
            $table->dropColumn(['provider', 'external_id', 'last_synced_at', 'sync_status', 'manual_overrides']);
        });
    }
};
