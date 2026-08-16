<?php

namespace App\Services;

use App\Enums\StreamProtocol;
use App\Jobs\CheckStreamHealthJob;
use App\Models\Channel;
use App\Models\Playlist;
use App\Models\PlaylistSyncRun;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class PlaylistImportService
{
    public function __construct(
        private readonly SafeUrlValidator $safeUrl,
        private readonly M3uParser $parser,
        private readonly AuditService $audit,
        private readonly ChannelNameNormalizer $normalizer,
    ) {}

    public function import(Playlist $playlist, ?User $actor = null): PlaylistSyncRun
    {
        $run = PlaylistSyncRun::query()->create([
            'playlist_id' => $playlist->id,
            'status' => 'syncing',
            'phase' => 'fetching',
            'started_at' => now(),
        ]);

        $playlist->update([
            'status' => 'syncing',
            'last_sync_at' => now(),
            'last_error_category' => null,
            'last_error_message' => null,
        ]);

        try {
            $entries = $this->entriesFor($playlist);
            $run->update(['phase' => 'importing']);
            $stats = $this->persistEntries($playlist, $entries);
            $groups = collect($entries)->pluck('group')->filter()->unique()->count();

            $playlist->update([
                'status' => 'completed',
                'health_status' => 'healthy',
                'channel_count' => $playlist->channels()->count(),
                'group_count' => $groups,
                'last_successful_sync_at' => now(),
            ]);
            $run->update([
                'status' => 'completed',
                'phase' => 'completed',
                'imported_count' => $stats['created'],
                'updated_count' => $stats['updated'],
                'finished_at' => now(),
            ]);
            $this->audit->record($actor, 'playlist.synced', $playlist, $stats);
        } catch (Throwable $exception) {
            $category = $exception instanceof ValidationException ? 'blocked_url' : 'import_failed';
            $message = $category === 'blocked_url' ? 'The playlist URL was blocked by server-side safety checks.' : 'Playlist import failed. Check the source and try again.';

            $playlist->update([
                'status' => 'failed',
                'health_status' => 'offline',
                'last_error_category' => $category,
                'last_error_message' => $message,
            ]);
            $run->update([
                'status' => 'failed',
                'phase' => 'failed',
                'error_category' => $category,
                'safe_message' => $message,
                'finished_at' => now(),
            ]);
            $this->audit->record($actor, 'playlist.sync_failed', $playlist, ['error_category' => $category]);
        }

        return $run->fresh();
    }

    /** @return list<array{name:string,url:string,external_id:?string,group:?string,logo:?string,metadata:array<string,string>}> */
    private function entriesFor(Playlist $playlist): array
    {
        if ($playlist->type === 'xtream') {
            return $this->xtreamEntries($playlist);
        }

        $content = match ($playlist->type) {
            'uploaded_m3u' => Storage::disk('local')->get($playlist->file_path),
            default => Http::timeout(20)
                ->withHeaders(['User-Agent' => 'RiFiTV Playlist Importer'])
                ->get($this->safeUrl->ensurePublicHttpUrl($playlist->source_url, 'source_url'))
                ->throw()
                ->body(),
        };

        return $this->parser->parse($content);
    }

    /** @return list<array{name:string,url:string,external_id:?string,group:?string,logo:?string,metadata:array<string,string>}> */
    private function xtreamEntries(Playlist $playlist): array
    {
        $base = rtrim($this->safeUrl->ensurePublicHttpUrl($playlist->server_url, 'server_url'), '/');
        $response = Http::timeout(20)
            ->withHeaders(['User-Agent' => 'RiFiTV Playlist Importer'])
            ->get($base.'/player_api.php', [
                'username' => $playlist->username,
                'password' => $playlist->password,
                'action' => 'get_live_streams',
            ])
            ->throw()
            ->json();

        return collect(is_array($response) ? $response : [])
            ->map(fn (array $item): array => [
                'name' => (string) ($item['name'] ?? 'Unnamed Channel'),
                'url' => $base.'/live/'.$playlist->username.'/'.$playlist->password.'/'.($item['stream_id'] ?? '').'.m3u8',
                'external_id' => isset($item['stream_id']) ? 'xtream-'.$item['stream_id'] : null,
                'group' => $item['category_name'] ?? null,
                'logo' => $item['stream_icon'] ?? null,
                'metadata' => array_map('strval', array_filter($item, fn ($value) => is_scalar($value))),
            ])
            ->filter(fn (array $item): bool => $item['url'] !== '' && $item['name'] !== '')
            ->values()
            ->all();
    }

    /** @param list<array{name:string,url:string,external_id:?string,group:?string,logo:?string,metadata:array<string,string>}> $entries */
    private function persistEntries(Playlist $playlist, array $entries): array
    {
        $created = 0;
        $updated = 0;
        $seenExternalIds = [];

        foreach ($entries as $entry) {
            if (! $this->shouldImportEntry($entry)) {
                continue;
            }

            $url = $this->safeUrl->ensurePublicHttpUrl($entry['url'], 'stream_url');
            $parts = parse_url($url);
            $externalId = $entry['external_id'] ?: sha1(Str::lower($entry['name']).'|'.$url);
            $seenExternalIds[] = $externalId;
            $urlHash = hash('sha256', $url);
            $existing = Channel::query()->where('playlist_id', $playlist->id)->where('external_id', $externalId)->first();
            $normalized = $this->normalizer->normalize($entry['name'], $entry['group']);
            $protocol = $this->protocolFor($url);
            $transport = $this->transportFor($url);

            $channel = Channel::query()->updateOrCreate(
                ['playlist_id' => $playlist->id, 'external_id' => $externalId],
                [
                    'name' => $entry['name'],
                    'original_name' => $normalized['original_name'],
                    'canonical_name' => $normalized['canonical_name'],
                    'normalized_name' => $normalized['normalized_name'],
                    'slug' => $existing?->slug ?? $this->uniqueChannelSlug($playlist, $entry['name'], $externalId),
                    'logo_path' => $entry['logo'],
                    'tvg_id' => $entry['metadata']['tvg-id'] ?? $entry['external_id'],
                    'category' => 'sports',
                    'playlist_group' => $entry['group'],
                    'original_group_name' => $normalized['original_group_name'],
                    'normalized_group' => $normalized['normalized_group'],
                    'quality_label' => $normalized['quality_label'],
                    'protocol' => $protocol->value,
                    'health_status' => 'unknown',
                    'browser_compatible' => 'unknown',
                    'natural_sort' => $normalized['natural_sort'],
                    'stream_url_hash' => $urlHash,
                    'last_seen_at' => now(),
                    'catalog_status' => 'active',
                    'metadata' => $entry['metadata'],
                    'active' => true,
                ],
            );

            $source = $channel->streamSources()->updateOrCreate(
                ['import_key' => $externalId],
                [
                    'playlist_id' => $playlist->id,
                    'name' => 'Playlist primary',
                    'protocol' => $protocol,
                    'transport' => $transport,
                    'direct_playable' => $transport === 'direct',
                    'gateway_required' => $transport === 'gateway',
                    'url' => $url,
                    'priority' => 10,
                    'enabled' => true,
                    'is_backup' => false,
                    'source_origin' => 'playlist',
                    'url_hash' => $urlHash,
                    'browser_compatible' => $transport === 'direct' ? 'likely_compatible' : 'unknown',
                ],
            );

            if (! $playlist->host && isset($parts['host'])) {
                $playlist->forceFill(['host' => $parts['host']])->save();
            }
            if (($created + $updated) < (int) config('rifitv.iptv.initial_health_sample_limit', 50)) {
                CheckStreamHealthJob::dispatch($source->id);
            }

            $existing ? $updated++ : $created++;
        }

        Channel::query()
            ->where('playlist_id', $playlist->id)
            ->whereNotIn('external_id', $seenExternalIds)
            ->update(['catalog_status' => 'missing']);

        return ['created' => $created, 'updated' => $updated];
    }

    private function protocolFor(string $url): StreamProtocol
    {
        return str_contains(Str::lower(parse_url($url, PHP_URL_PATH) ?: $url), '.m3u8') ? StreamProtocol::Hls : StreamProtocol::MpegTs;
    }

    private function transportFor(string $url): string
    {
        return strtolower((string) parse_url($url, PHP_URL_SCHEME)) === 'https' ? 'gateway' : 'gateway';
    }

    /** @param array{name:string,url:string,external_id:?string,group:?string,logo:?string,metadata:array<string,string>} $entry */
    private function shouldImportEntry(array $entry): bool
    {
        $group = Str::of((string) ($entry['group'] ?? ''))->lower()->toString();

        if (str_contains($group, 'vod') || str_contains($group, 'movie') || str_contains($group, 'series')) {
            return false;
        }

        return true;
    }

    private function uniqueChannelSlug(Playlist $playlist, string $name, string $externalId): string
    {
        $base = Str::slug($name) ?: 'playlist-channel';
        $candidate = "{$base}-p{$playlist->id}";
        $suffix = substr($externalId, 0, 8);

        if (! Channel::query()->where('slug', $candidate)->exists()) {
            return $candidate;
        }

        return "{$candidate}-{$suffix}";
    }
}
