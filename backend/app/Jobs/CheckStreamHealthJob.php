<?php

namespace App\Jobs;

use App\Models\StreamSource;
use App\Services\StreamHealthService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CheckStreamHealthJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public ?int $sourceId = null) {}

    public function handle(StreamHealthService $service): void
    {
        if ($this->sourceId) {
            $source = StreamSource::query()->find($this->sourceId);
            if ($source) {
                $service->check($source);
            }

            return;
        }

        $service->checkAll();
    }
}
