<?php

namespace App\Jobs;

use App\Models\StreamSource;
use App\Services\StreamHealthService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CheckStreamHealthJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 15;

    public bool $failOnTimeout = true;

    public function __construct(public int $sourceId) {}

    public function handle(StreamHealthService $service): void
    {
        $source = StreamSource::query()->find($this->sourceId);
        if (! $source || ! $source->enabled) {
            return;
        }

        $service->check($source);
    }
}
