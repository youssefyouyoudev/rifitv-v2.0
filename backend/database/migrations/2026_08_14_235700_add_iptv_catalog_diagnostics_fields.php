<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('playlists', function (Blueprint $table): void {
            $table->string('host')->nullable()->after('type')->index();
            $table->string('health_status', 32)->default('unknown')->after('status')->index();
        });

        Schema::table('channels', function (Blueprint $table): void {
            $table->string('original_name')->nullable()->after('name');
            $table->string('canonical_name')->nullable()->after('original_name')->index();
            $table->string('normalized_name')->nullable()->after('canonical_name')->index();
            $table->string('original_group_name')->nullable()->after('playlist_group');
            $table->string('normalized_group')->nullable()->after('original_group_name')->index();
            $table->string('tvg_id')->nullable()->after('external_id')->index();
            $table->string('protocol', 24)->nullable()->after('quality_label')->index();
            $table->string('health_status', 32)->default('unknown')->after('protocol')->index();
            $table->string('browser_compatible', 32)->nullable()->after('health_status')->index();
            $table->boolean('favorite')->default(false)->after('browser_compatible')->index();
            $table->unsignedInteger('natural_sort')->default(100000)->after('favorite')->index();
        });

        Schema::table('stream_sources', function (Blueprint $table): void {
            $table->string('transport', 32)->default('gateway')->after('protocol')->index();
            $table->boolean('direct_playable')->default(false)->after('transport');
            $table->boolean('gateway_required')->default(true)->after('direct_playable');
            $table->string('browser_compatible', 32)->nullable()->after('url_hash')->index();
            $table->string('video_codec', 64)->nullable()->after('browser_compatible');
            $table->string('audio_codec', 64)->nullable()->after('video_codec');
            $table->string('container', 64)->nullable()->after('audio_codec');
            $table->string('resolution', 32)->nullable()->after('container');
            $table->decimal('frame_rate', 8, 3)->nullable()->after('resolution');
        });
    }

    public function down(): void
    {
        Schema::table('stream_sources', function (Blueprint $table): void {
            $table->dropColumn(['transport', 'direct_playable', 'gateway_required', 'browser_compatible', 'video_codec', 'audio_codec', 'container', 'resolution', 'frame_rate']);
        });

        Schema::table('channels', function (Blueprint $table): void {
            $table->dropColumn(['original_name', 'canonical_name', 'normalized_name', 'original_group_name', 'normalized_group', 'tvg_id', 'protocol', 'health_status', 'browser_compatible', 'favorite', 'natural_sort']);
        });

        Schema::table('playlists', function (Blueprint $table): void {
            $table->dropColumn(['host', 'health_status']);
        });
    }
};
