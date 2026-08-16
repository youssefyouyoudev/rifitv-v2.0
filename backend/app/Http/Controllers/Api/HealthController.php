<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OperationalAlert;
use App\Models\StreamHealthCheck;
use App\Models\SyncRun;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class HealthController extends Controller
{
    public function public()
    {
        return response()->json(['status' => 'ok']);
    }

    public function detailed(Request $request)
    {
        abort_unless($request->user()?->hasPermission('health.view') || $request->user()?->hasPermission('*'), 403);

        return response()->json(['data' => [
            'application' => $this->status(true),
            'database' => $this->status($this->databaseOk()),
            'cache' => $this->status($this->cacheOk()),
            'queue' => $this->status(DB::table('failed_jobs')->count() === 0, ['pending_jobs' => DB::table('jobs')->count(), 'failed_jobs' => DB::table('failed_jobs')->count()]),
            'scheduler' => $this->status((bool) Cache::get('rifitv:scheduler:last_seen_at'), ['last_seen_at' => Cache::get('rifitv:scheduler:last_seen_at')]),
            'football_provider' => $this->status(true, [
                'provider' => config('services.football.provider') ?: 'disabled',
                'external_sync_enabled' => filled(config('services.football.provider')),
            ]),
            'streams' => $this->status(OperationalAlert::query()->where('status', 'open')->where('type', 'stream_offline')->doesntExist(), ['last_check_at' => StreamHealthCheck::query()->latest('checked_at')->value('checked_at')]),
            'sync' => $this->status(SyncRun::query()->where('status', 'failed')->where('started_at', '>=', now()->subDay())->doesntExist()),
            'storage' => $this->status(Storage::disk('local')->exists('.') || is_writable(storage_path())),
        ]]);
    }

    private function status(bool $healthy, array $context = []): array
    {
        return ['status' => $healthy ? 'healthy' : 'critical'] + $context;
    }

    private function databaseOk(): bool
    {
        try {
            DB::connection()->getPdo();

            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private function cacheOk(): bool
    {
        try {
            Cache::put('rifitv:healthcheck', now()->toIso8601String(), 60);

            return true;
        } catch (Throwable) {
            return false;
        }
    }
}
