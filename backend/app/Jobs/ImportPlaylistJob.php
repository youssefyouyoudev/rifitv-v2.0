<?php

namespace App\Jobs;

use App\Models\Playlist;
use App\Models\User;
use App\Services\PlaylistImportService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ImportPlaylistJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Playlist $playlist,
        public ?User $actor = null,
    ) {}

    public function handle(PlaylistImportService $service): void
    {
        $service->import($this->playlist->fresh(), $this->actor);
    }
}
