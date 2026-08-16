<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('playlists', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('type', 32)->index();
            $table->string('status', 32)->default('never_synced')->index();
            $table->text('source_url')->nullable();
            $table->string('server_url')->nullable();
            $table->text('username')->nullable();
            $table->text('password')->nullable();
            $table->string('file_path')->nullable();
            $table->boolean('active')->default(true)->index();
            $table->boolean('auto_sync')->default(false);
            $table->unsignedInteger('sync_interval_minutes')->default(360);
            $table->unsignedInteger('channel_count')->default(0);
            $table->unsignedInteger('group_count')->default(0);
            $table->timestamp('last_sync_at')->nullable();
            $table->timestamp('last_successful_sync_at')->nullable();
            $table->string('last_error_category', 64)->nullable();
            $table->text('last_error_message')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('playlist_sync_runs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('playlist_id')->constrained()->cascadeOnDelete();
            $table->string('status', 32)->default('queued')->index();
            $table->string('phase', 64)->nullable();
            $table->unsignedInteger('imported_count')->default(0);
            $table->unsignedInteger('updated_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->string('error_category', 64)->nullable();
            $table->text('safe_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::table('channels', function (Blueprint $table): void {
            $table->foreignId('playlist_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->string('external_id')->nullable()->after('playlist_id');
            $table->string('playlist_group')->nullable()->after('category');
            $table->string('quality_label', 32)->nullable()->after('playlist_group');
            $table->string('stream_url_hash', 64)->nullable()->after('quality_label');
            $table->timestamp('last_seen_at')->nullable()->after('stream_url_hash');
            $table->string('catalog_status', 32)->default('manual')->after('last_seen_at')->index();
            $table->json('metadata')->nullable()->after('catalog_status');
            $table->unique(['playlist_id', 'external_id']);
        });

        Schema::table('stream_sources', function (Blueprint $table): void {
            $table->foreignId('playlist_id')->nullable()->after('channel_id')->constrained()->nullOnDelete();
            $table->string('source_origin', 32)->default('manual')->after('is_backup')->index();
            $table->string('import_key', 96)->nullable()->after('source_origin')->index();
            $table->string('url_hash', 64)->nullable()->after('import_key')->index();
        });
    }

    public function down(): void
    {
        Schema::table('stream_sources', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('playlist_id');
            $table->dropColumn(['source_origin', 'import_key', 'url_hash']);
        });

        Schema::table('channels', function (Blueprint $table): void {
            $table->dropUnique(['playlist_id', 'external_id']);
            $table->dropConstrainedForeignId('playlist_id');
            $table->dropColumn(['external_id', 'playlist_group', 'quality_label', 'stream_url_hash', 'last_seen_at', 'catalog_status', 'metadata']);
        });

        Schema::dropIfExists('playlist_sync_runs');
        Schema::dropIfExists('playlists');
    }
};
