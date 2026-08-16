<?php

namespace App\Services;

use App\Enums\StreamHealth;
use App\Models\StreamSource;
use App\Models\User;
use Illuminate\Support\Facades\Http;

class StreamSourceService
{
    public function __construct(private readonly AuditService $audit) {}

    public function test(StreamSource $source, ?User $actor): array
    {
        $started = microtime(true);
        $status = StreamHealth::Unknown;
        $result = 'Unsupported';
        $httpStatus = null;

        if (! filter_var($source->url, FILTER_VALIDATE_URL)) {
            $result = 'Unsupported';
        } else {
            try {
                $response = Http::timeout(5)->withHeaders(['User-Agent' => 'RiFiTV Stream Tester'])->get($source->url);
                $httpStatus = $response->status();
                $status = $response->successful() ? StreamHealth::Healthy : StreamHealth::Degraded;
                $result = $response->successful() ? 'Reachable' : 'Possibly playable';
            } catch (\Throwable) {
                $status = StreamHealth::Offline;
                $result = 'Unreachable';
            }
        }

        $latencyMs = (int) round((microtime(true) - $started) * 1000);
        $source->update([
            'last_known_status' => $status,
            'last_checked_at' => now(),
        ]);
        $this->audit->record($actor, 'stream_source.tested', $source, ['result' => $result, 'http_status' => $httpStatus, 'latency_ms' => $latencyMs]);

        return [
            'result' => $result,
            'health_status' => $status->value,
            'http_status' => $httpStatus,
            'latency_ms' => $latencyMs,
            'message' => $result === 'Reachable' ? 'The source endpoint responded. This does not guarantee playable video.' : 'Check the URL or try again.',
        ];
    }

    public function reorder(array $orderedIds, ?User $actor): void
    {
        foreach (array_values($orderedIds) as $index => $id) {
            StreamSource::query()->whereKey($id)->update(['priority' => ($index + 1) * 10]);
        }

        $this->audit->record($actor, 'stream_source.reordered', null, ['count' => count($orderedIds)]);
    }
}
