<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_events', function (Blueprint $table): void {
            $table->id();
            $table->string('event', 64);
            $table->string('visitor_hash', 64)->nullable();
            $table->string('path', 512)->nullable();
            $table->json('payload')->nullable();
            $table->timestamp('occurred_at')->useCurrent();
            $table->timestamps();
            $table->index(['event', 'occurred_at']);
            $table->index(['visitor_hash', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_events');
    }
};
