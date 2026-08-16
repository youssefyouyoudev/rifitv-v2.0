<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table): void {
            $table->boolean('featured')->default(false)->after('active')->index();
            $table->softDeletes();
        });

        Schema::table('competitions', function (Blueprint $table): void {
            $table->boolean('featured')->default(false)->after('active')->index();
            $table->string('selection_mode', 32)->default('featured_teams_only')->after('featured');
            $table->softDeletes();
        });

        Schema::table('channels', function (Blueprint $table): void {
            $table->string('country_code', 2)->nullable()->after('logo_path');
            $table->string('language', 32)->nullable()->after('country_code');
            $table->string('category', 48)->nullable()->after('language');
            $table->softDeletes();
        });

        Schema::table('matches', function (Blueprint $table): void {
            $table->timestamp('published_at')->nullable()->after('featured')->index();
            $table->string('visibility', 32)->default('public')->after('published_at')->index();
            $table->string('seo_title')->nullable()->after('visibility');
            $table->text('seo_description')->nullable()->after('seo_title');
            $table->text('notes')->nullable()->after('seo_description');
            $table->softDeletes();
            $table->index(['competition_id', 'published_at']);
            $table->index(['home_team_id', 'away_team_id']);
        });

        Schema::create('roles', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->json('permissions');
            $table->timestamps();
        });

        Schema::create('role_user', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['role_id', 'user_id']);
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('active')->default(true)->after('is_admin')->index();
        });

        Schema::create('featured_teams', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('competition_id')->constrained()->cascadeOnDelete();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['competition_id', 'team_id']);
        });

        Schema::create('competition_rules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('competition_id')->constrained()->cascadeOnDelete();
            $table->string('mode', 32)->default('featured_teams_only');
            $table->boolean('active')->default(true);
            $table->json('configuration')->nullable();
            $table->timestamps();
            $table->unique('competition_id');
        });

        Schema::create('homepage_sections', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique();
            $table->string('title');
            $table->string('type', 32);
            $table->boolean('enabled')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedInteger('limit')->default(8);
            $table->foreignId('competition_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('hero_match_id')->nullable()->constrained('matches')->nullOnDelete();
            $table->json('configuration')->nullable();
            $table->timestamps();
        });

        Schema::create('announcements', function (Blueprint $table): void {
            $table->id();
            $table->string('title');
            $table->text('message');
            $table->string('type', 24)->default('info');
            $table->boolean('active')->default(true)->index();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('entity_type')->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['entity_type', 'entity_id']);
            $table->index(['action', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('homepage_sections');
        Schema::dropIfExists('competition_rules');
        Schema::dropIfExists('featured_teams');
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('active');
        });
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('roles');
        Schema::table('matches', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->dropColumn(['published_at', 'visibility', 'seo_title', 'seo_description', 'notes']);
        });
        Schema::table('channels', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->dropColumn(['country_code', 'language', 'category']);
        });
        Schema::table('competitions', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->dropColumn(['featured', 'selection_mode']);
        });
        Schema::table('teams', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->dropColumn('featured');
        });
    }
};
