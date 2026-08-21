<?php

namespace App\Services;

use App\Enums\StreamHealth;
use App\Enums\StreamProtocol;
use App\Models\GameMatch;
use App\Models\LiveIngest;
use App\Models\StreamSource;

class PlaybackIngestLifecycleService
{
    public function __construct(
        private readonly PlaybackWindowService $window,
        private readonly HlsRelayManager $relay,
    ) {}

    public function run(): array
    {
        if (! (bool) config('rifitv.stable_relay.enabled', true) || ! $this->relay->ffmpegAvailable()) {
            return ['started' => 0, 'stopped' => 0, 'reason' => 'relay_unavailable'];
        }

        $activeSourceIds = collect();
        $started = 0;

        GameMatch::query()
            ->with('channels.streamSources')
            ->whereNotNull('kickoff_at')
            ->where('kickoff_at', '>=', now()->subHours(4))
            ->where('kickoff_at', '<=', now()->addMinutes((int) config('rifitv.playback_open_before_minutes', 10)))
            ->each(function (GameMatch $match) use (&$activeSourceIds, &$started): void {
                $state = $this->window->stateFor($match);
                if (! in_array($state['status'], ['open', 'opening_soon'], true)) {
                    return;
                }

                $source = $this->primaryRelaySource($match);
                if (! $source) {
                    return;
                }

                $activeSourceIds->push($source->id);
                $ingest = $this->relay->ensure($source);
                if (in_array($ingest->status, ['starting', 'ready'], true)) {
                    $started++;
                }
            });

        $stopped = 0;
        LiveIngest::query()
            ->whereNotIn('stream_source_id', $activeSourceIds->unique()->all())
            ->whereNotIn('status', ['stopped', 'failed'])
            ->with('streamSource')
            ->each(function (LiveIngest $ingest) use (&$stopped): void {
                if (! $ingest->streamSource) {
                    $ingest->update([
                        'status' => 'stopped',
                        'pid' => null,
                        'last_error' => 'missing_stream_source',
                    ]);

                    return;
                }

                $this->relay->stop($ingest->streamSource);
                $stopped++;
            });

        return ['started' => $started, 'stopped' => $stopped, 'reason' => 'ok'];
    }

    private function primaryRelaySource(GameMatch $match): ?StreamSource
    {
        return $match->channels
            ->where('active', true)
            ->flatMap(fn ($channel) => $channel->streamSources->map(function (StreamSource $source) use ($channel): StreamSource {
                $source->setRelation('channel', $channel);

                return $source;
            }))
            ->filter(fn (StreamSource $source): bool => $source->enabled)
            ->filter(fn (StreamSource $source): bool => $source->protocol === StreamProtocol::MpegTs)
            ->filter(fn (StreamSource $source): bool => ! in_array($source->last_known_status, [
                StreamHealth::Offline,
                StreamHealth::BrowserIncompatible,
                StreamHealth::Disabled,
            ], true))
            ->sortBy(fn (StreamSource $source): array => [$source->priority, $source->id])
            ->first();
    }
}
