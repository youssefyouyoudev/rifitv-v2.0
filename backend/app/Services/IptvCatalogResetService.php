<?php

namespace App\Services;

use App\Models\Channel;
use App\Models\PlaybackEvent;
use App\Models\Playlist;
use App\Models\StreamHealthCheck;
use App\Models\StreamSource;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class IptvCatalogResetService
{
    public function __construct(private readonly PlaylistImportService $importer) {}

    public function dryRun(): array
    {
        return [
            'playlists' => Playlist::withTrashed()->count(),
            'channels' => Channel::withTrashed()->count(),
            'stream_sources' => StreamSource::query()->count(),
            'stream_health_checks' => StreamHealthCheck::query()->count(),
            'match_channel_assignments' => DB::table('match_channels')->count(),
            'playback_events' => PlaybackEvent::query()->count(),
            'football_tables_preserved' => ['users', 'roles', 'teams', 'competitions', 'matches', 'seasons', 'site_settings'],
        ];
    }

    public function reset(): array
    {
        $backupPath = $this->backup();
        $counts = $this->dryRun();

        DB::transaction(function (): void {
            DB::table('match_channels')->delete();
            StreamHealthCheck::query()->delete();
            PlaybackEvent::query()->delete();
            StreamSource::query()->delete();
            Channel::withTrashed()->forceDelete();
            DB::table('playlist_sync_runs')->delete();
            Playlist::withTrashed()->forceDelete();
        });

        return ['backup' => $backupPath, 'deleted' => $counts];
    }

    public function rebuildFromPlaylist(Playlist $sourcePlaylist): array
    {
        return $this->rebuildFromUnsavedPlaylist($sourcePlaylist);
    }

    public function rebuildFromUnsavedPlaylist(Playlist $sourcePlaylist): array
    {
        $snapshot = new Playlist([
            'name' => $sourcePlaylist->name,
            'type' => $sourcePlaylist->type,
            'source_url' => $sourcePlaylist->source_url,
            'server_url' => $sourcePlaylist->server_url,
            'username' => $sourcePlaylist->username,
            'password' => $sourcePlaylist->password,
            'file_path' => $sourcePlaylist->file_path,
            'auto_sync' => true,
            'sync_interval_minutes' => 360,
        ]);

        $backupPath = $this->backup();
        $counts = $this->dryRun();

        DB::transaction(function (): void {
            DB::table('match_channels')->delete();
            StreamHealthCheck::query()->delete();
            PlaybackEvent::query()->delete();
            StreamSource::query()->delete();
            Channel::withTrashed()->forceDelete();
            DB::table('playlist_sync_runs')->delete();
            Playlist::withTrashed()->forceDelete();
        });

        $playlist = Playlist::query()->create($snapshot->only([
            'name',
            'type',
            'source_url',
            'server_url',
            'username',
            'password',
            'file_path',
            'auto_sync',
            'sync_interval_minutes',
        ]));

        $run = $this->importer->import($playlist);

        return [
            'backup' => $backupPath,
            'deleted' => $counts,
            'playlist_id' => $playlist->id,
            'import_status' => $run->status,
            'channels' => $playlist->fresh()->channel_count,
            'groups' => $playlist->fresh()->group_count,
        ];
    }

    private function backup(): string
    {
        $path = 'backups/iptv-reset-'.now()->format('Ymd-His').'.jsonl';
        Storage::disk('local')->makeDirectory('backups');
        $absolute = Storage::disk('local')->path($path);
        $handle = fopen($absolute, 'wb');

        fwrite($handle, json_encode(['type' => 'meta', 'created_at' => now()->toIso8601String()]).PHP_EOL);
        $this->writeRows($handle, 'playlists', Playlist::withTrashed()->orderBy('id'));
        $this->writeRows($handle, 'channels', Channel::withTrashed()->orderBy('id'));
        $this->writeRows($handle, 'stream_sources', StreamSource::query()->orderBy('id'));
        $this->writeRows($handle, 'stream_health_checks', StreamHealthCheck::query()->latest('checked_at')->limit(5000));

        DB::table('match_channels')->orderBy('id')->chunk(1000, function ($rows) use ($handle): void {
            foreach ($rows as $row) {
                fwrite($handle, json_encode(['type' => 'match_channels', 'row' => (array) $row]).PHP_EOL);
            }
        });

        fclose($handle);

        return Storage::disk('local')->path($path);
    }

    private function writeRows($handle, string $type, $query): void
    {
        $query->chunk(1000, function ($rows) use ($handle, $type): void {
            foreach ($rows as $row) {
                fwrite($handle, json_encode(['type' => $type, 'row' => $row->toArray()]).PHP_EOL);
            }
        });
    }
}
