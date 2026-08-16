<?php

namespace App\Jobs;

use App\Services\PublicContentService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RefreshHomepageCacheJob implements ShouldQueue
{
    use Queueable;

    public function handle(PublicContentService $content): void
    {
        $content->forgetHome();
        $content->homePayload();
    }
}
