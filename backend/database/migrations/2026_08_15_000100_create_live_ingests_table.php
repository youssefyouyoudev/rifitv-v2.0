<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('live_ingests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('stream_source_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('status', 32)->default('stopped')->index();
            $table->string('transport', 32)->default('hls_relay');
            $table->string('session_key', 80)->unique();
            $table->string('output_path');
            $table->string('public_path');
            $table->unsignedInteger('pid')->nullable();
            $table->timestamp('process_started_at')->nullable();
            $table->timestamp('ready_at')->nullable();
            $table->timestamp('last_segment_at')->nullable();
            $table->unsignedInteger('segment_count')->default(0);
            $table->unsignedInteger('reconnect_count')->default(0);
            $table->unsignedInteger('restart_count')->default(0);
            $table->text('last_error')->nullable();
            $table->json('metrics')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('live_ingests');
    }
};
