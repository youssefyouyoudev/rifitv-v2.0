<?php

use App\Jobs\CheckStreamHealthJob;
use App\Jobs\CleanupOperationalDataJob;
use App\Jobs\DetectOperationalIssuesJob;
use App\Jobs\ImportPlaylistJob;
use App\Jobs\RefreshHomepageCacheJob;
use App\Jobs\SyncFixturesJob;
use App\Jobs\SyncResultsJob;
use App\Models\Playlist;
use App\Models\Role;
use App\Models\StreamSource;
use App\Models\User;
use App\Services\DryRunRollback;
use App\Services\FootballProductionAuditService;
use App\Services\HlsRelayManager;
use App\Services\IptvCatalogResetService;
use App\Services\IptvDiagnosticService;
use App\Services\OfficialFixtureImportService;
use App\Services\PlaybackIngestLifecycleService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('rifitv:sync-fixtures', function () {
    SyncFixturesJob::dispatch();
    $this->info('Fixture sync queued.');
});

Artisan::command('rifitv:sync-results', function () {
    SyncResultsJob::dispatch();
    $this->info('Result sync queued.');
});

Artisan::command('rifitv:fixtures:import {season=2026-27} {--competition=} {--dry-run}', function (OfficialFixtureImportService $importer) {
    try {
        $summary = $importer->import(
            (string) $this->argument('season'),
            $this->option('competition') ? (string) $this->option('competition') : null,
            (bool) $this->option('dry-run'),
        );
    } catch (DryRunRollback $rollback) {
        $summary = $rollback->summary;
    }

    foreach ($summary as $key => $value) {
        $this->line($key.': '.($value === true ? 'yes' : ($value === false ? 'no' : $value)));
    }

    return 0;
})->purpose('Import official 2026/27 football fixture snapshots');

Artisan::command('rifitv:fixtures:verify {season=2026-27}', function (OfficialFixtureImportService $importer) {
    $report = $importer->verify((string) $this->argument('season'));

    $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    return $report['ok'] ? 0 : 1;
})->purpose('Verify official fixture completeness and broadcast assignments');

Artisan::command('rifitv:football:backup {--reason=football-production-hardening}', function (FootballProductionAuditService $audit) {
    $backup = $audit->backup((string) $this->option('reason'));

    $this->line(json_encode($backup, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    return 0;
})->purpose('Back up football database rows and asset manifest before production data changes');

Artisan::command('rifitv:football:audit {season=2026-27} {--write-doc}', function (FootballProductionAuditService $audit) {
    $report = $audit->report((string) $this->argument('season'));

    if ($this->option('write-doc')) {
        $report['markdown_path'] = $audit->writeMarkdownReport($report);
    }

    $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    return $report['ok'] ? 0 : 1;
})->purpose('Audit production football fixtures, provenance, public gates, and logo assets');

Artisan::command('rifitv:football:purge-demo {--force}', function (FootballProductionAuditService $audit) {
    $report = $audit->purgeDemoFootballRows((bool) $this->option('force'));

    $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    return ($report['purged'] ?? false) ? 0 : 1;
})->purpose('Remove backed-up mock/demo football matches without touching auth or IPTV data');

Artisan::command('rifitv:logos:verify', function (FootballProductionAuditService $audit) {
    $report = $audit->logoVerificationReport();

    $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    return $report['ok'] ? 0 : 1;
})->purpose('Verify local football logo files and manifest coverage');

Artisan::command('rifitv:reset-season-data {season=2026-27} {--dry-run} {--force}', function () {
    $season = (string) $this->argument('season');
    $dryRun = (bool) $this->option('dry-run');
    $force = (bool) $this->option('force');

    if (app()->environment('production') && ! $force) {
        $this->error('Production reset requires --force after an external backup has been taken.');

        return 1;
    }

    if (! $dryRun && ! $force && ! $this->confirm("Delete football dataset and live-ops rows for {$season}?")) {
        $this->warn('Reset cancelled.');

        return 1;
    }

    $tables = [
        'playback_events',
        'operational_alerts',
        'stream_health_checks',
        'fixture_import_logs',
        'sync_runs',
        'competition_provider_mappings',
        'team_provider_mappings',
        'match_broadcasts',
        'match_channels',
        'homepage_sections',
        'announcements',
        'stream_sources',
        'channels',
        'matches',
        'seasons',
        'competition_rules',
        'featured_teams',
        'teams',
        'broadcasters',
        'competitions',
    ];

    $counts = collect($tables)
        ->filter(fn (string $table): bool => Schema::hasTable($table))
        ->mapWithKeys(fn (string $table): array => [$table => DB::table($table)->count()])
        ->all();

    $preserved = ['users', 'roles', 'role_user', 'sessions', 'personal_access_tokens', 'password_reset_tokens', 'cache', 'jobs', 'failed_jobs'];
    $backupPath = 'backups/season-reset-'.$season.'-'.now()->format('Ymd-His').'.json';

    Storage::disk('local')->put($backupPath, json_encode([
        'season' => $season,
        'dry_run' => $dryRun,
        'created_at' => now()->toIso8601String(),
        'delete_tables' => $counts,
        'preserved_tables' => $preserved,
    ], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

    $this->info('Backup manifest: storage/app/'.$backupPath);
    $this->line('Preserve: '.implode(', ', $preserved));

    foreach ($counts as $table => $count) {
        $this->line("DELETE {$table}: {$count}");
    }

    if ($dryRun) {
        $this->info('Dry run only. No rows deleted.');

        return 0;
    }

    Schema::disableForeignKeyConstraints();
    try {
        foreach (array_keys($counts) as $table) {
            DB::table($table)->delete();
        }
    } finally {
        Schema::enableForeignKeyConstraints();
    }

    $this->info('Football dataset reset complete. Auth tables were preserved.');

    return 0;
})->purpose('Reset production football/content/live-ops data while preserving users and roles');

Artisan::command('rifitv:check-streams {sourceId?}', function (?int $sourceId = null) {
    CheckStreamHealthJob::dispatch($sourceId);
    $this->info('Stream health check queued.');
});

Artisan::command('rifitv:relay:start {sourceId}', function (HlsRelayManager $relay) {
    $source = StreamSource::query()->findOrFail((int) $this->argument('sourceId'));
    $ingest = $relay->ensure($source);

    $this->line(json_encode([
        'source_id' => $source->id,
        'status' => $ingest->status,
        'transport' => $ingest->transport,
        'session_key' => $ingest->session_key,
        'public_path' => $ingest->public_path,
        'segment_count' => $ingest->segment_count,
        'last_segment_at' => $ingest->last_segment_at?->toIso8601String(),
        'last_error' => $ingest->last_error,
        'provider_url_hidden' => true,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
});

Artisan::command('rifitv:relay:status {sourceId}', function (HlsRelayManager $relay) {
    $source = StreamSource::query()->findOrFail((int) $this->argument('sourceId'));
    $ingest = $relay->refreshHealth($relay->sessionFor($source));

    $this->line(json_encode([
        'source_id' => $source->id,
        'status' => $ingest->status,
        'pid' => $ingest->pid,
        'public_path' => $ingest->public_path,
        'segment_count' => $ingest->segment_count,
        'last_segment_at' => $ingest->last_segment_at?->toIso8601String(),
        'last_error' => $ingest->last_error,
        'provider_url_hidden' => true,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
});

Artisan::command('rifitv:relay:stop {sourceId}', function (HlsRelayManager $relay) {
    $source = StreamSource::query()->findOrFail((int) $this->argument('sourceId'));
    $ingest = $relay->stop($source);

    $this->line(json_encode([
        'source_id' => $source->id,
        'status' => $ingest->status,
        'provider_url_hidden' => true,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
});

Artisan::command('rifitv:relay:lifecycle', function (PlaybackIngestLifecycleService $lifecycle) {
    $this->line(json_encode($lifecycle->run(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
});

Artisan::command('rifitv:iptv:diagnose {playlistId?} {--url=} {--file=}', function (IptvDiagnosticService $diagnostics) {
    $url = $this->option('url');
    $file = $this->option('file');
    $playlistId = $this->argument('playlistId');

    try {
        $report = match (true) {
            filled($file) => $diagnostics->diagnosePlaylist(new Playlist(['name' => 'Private upload', 'type' => 'uploaded_m3u', 'file_path' => (string) $file])),
            filled($url) => $diagnostics->diagnoseUrl((string) $url),
            default => $diagnostics->diagnosePlaylist($playlistId ? Playlist::query()->findOrFail($playlistId) : Playlist::query()->latest()->firstOrFail()),
        };
    } catch (Throwable $exception) {
        $this->error('diagnosis_failed: '.class_basename($exception));

        return 1;
    }

    $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    return ($report['playlist']['valid_m3u'] ?? false) ? 0 : 1;
})->purpose('Diagnose an IPTV playlist and representative streams without exposing credentials');

Artisan::command('rifitv:iptv:reset {--dry-run} {--force}', function (IptvCatalogResetService $reset) {
    if ($this->option('dry-run')) {
        $this->line(json_encode($reset->dryRun(), JSON_PRETTY_PRINT));

        return 0;
    }

    if (! $this->option('force')) {
        $this->error('Use --force to reset the IPTV catalog after reviewing --dry-run.');

        return 1;
    }

    $this->line(json_encode($reset->reset(), JSON_PRETTY_PRINT));

    return 0;
})->purpose('Reset only IPTV playlist/channel/source data after creating a backup');

Artisan::command('rifitv:iptv:rebuild {playlistId} {--force}', function (IptvCatalogResetService $reset) {
    if (! $this->option('force')) {
        $this->error('Use --force after running rifitv:iptv:diagnose and rifitv:iptv:reset --dry-run.');

        return 1;
    }

    $playlist = Playlist::query()->findOrFail($this->argument('playlistId'));
    $this->line(json_encode($reset->rebuildFromPlaylist($playlist), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    return 0;
})->purpose('Backup, reset, and import a validated IPTV playlist in one controlled operation');

Artisan::command('rifitv:iptv:rebuild-upload {filePath} {--name=Sports Provider} {--force}', function (IptvCatalogResetService $reset) {
    if (! $this->option('force')) {
        $this->error('Use --force after running rifitv:iptv:diagnose against the uploaded playlist.');

        return 1;
    }

    $filePath = (string) $this->argument('filePath');
    if (! Storage::disk('local')->exists($filePath)) {
        $this->error('Private playlist file not found.');

        return 1;
    }

    $playlist = new Playlist([
        'name' => (string) $this->option('name'),
        'type' => 'uploaded_m3u',
        'file_path' => $filePath,
        'auto_sync' => true,
        'sync_interval_minutes' => 360,
    ]);

    $this->line(json_encode($reset->rebuildFromUnsavedPlaylist($playlist), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    return 0;
})->purpose('Backup, reset, and import a private uploaded M3U file in one controlled operation');

Artisan::command('rifitv:health', function () {
    DB::connection()->getPdo();
    $this->info('database: ok');

    try {
        Cache::put('rifitv:healthcheck', now()->toIso8601String(), 60);
        $this->info('cache: ok');
    } catch (Throwable $e) {
        $this->warn('cache: '.$e->getMessage());
    }

    $lastSeen = Cache::get('rifitv:scheduler:last_seen_at');
    $this->info('scheduler_last_seen_at: '.($lastSeen ?: 'never'));
    $this->info('football_provider: '.config('services.football.provider', 'mock'));
});

Artisan::command('rifitv:create-owner {--name=} {--email=} {--password=}', function () {
    $name = (string) ($this->option('name') ?: $this->ask('Owner name'));
    $email = (string) ($this->option('email') ?: $this->ask('Owner email'));
    $password = (string) ($this->option('password') ?: $this->secret('Owner password'));

    $validator = Validator::make(compact('name', 'email', 'password'), [
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email:rfc,dns', 'max:255'],
        'password' => ['required', 'string', 'min:12'],
    ]);

    if ($validator->fails()) {
        foreach ($validator->errors()->all() as $error) {
            $this->error($error);
        }

        return 1;
    }

    $role = Role::query()->updateOrCreate(['slug' => 'owner'], ['name' => 'Owner', 'permissions' => ['*']]);
    $user = User::query()->updateOrCreate(
        ['email' => $email],
        ['name' => $name, 'password' => Hash::make($password), 'is_admin' => true, 'active' => true]
    );
    $user->roles()->syncWithoutDetaching([$role->id]);

    $this->info('Owner account is ready: '.$email);

    return 0;
});

Artisan::command('rifitv:production-check', function (FootballProductionAuditService $footballAudit) {
    $football = $footballAudit->report('2026-27');
    $corsOrigins = collect(config('cors.allowed_origins', []))
        ->map(fn (string $origin): string => rtrim($origin, '/'))
        ->filter()
        ->values();
    $expectedCorsOrigins = collect(['https://rifitv.com', 'https://www.rifitv.com']);
    $footballProvider = config('services.football.provider');
    $checks = [
        'APP_ENV is production' => app()->environment('production'),
        'APP_DEBUG is false' => ! (bool) config('app.debug'),
        'APP_KEY is set' => filled(config('app.key')),
        'database reachable' => rescue(fn () => DB::connection()->getPdo() !== null, false, report: false),
        'cache writable' => rescue(fn () => Cache::put('rifitv:production-check', 'ok', 60), false, report: false) !== false,
        'queue is not sync' => config('queue.default') !== 'sync',
        'storage writable' => is_writable(storage_path()) && rescue(fn () => Storage::disk('local')->put('health/.probe', 'ok'), false, report: false) !== false,
        'frontend URL configured' => filled(config('app.frontend_url')),
        'CORS origins configured' => $expectedCorsOrigins->every(fn (string $origin): bool => $corsOrigins->contains($origin)),
        'football provider disabled or non-production mock' => blank($footballProvider) || (! app()->environment('production') && $footballProvider === 'mock'),
        'football production audit passes' => $football['ok'],
    ];

    $failed = 0;
    foreach ($checks as $label => $ok) {
        $ok ? $this->info('[ok] '.$label) : $this->error('[fail] '.$label);
        $failed += $ok ? 0 : 1;
    }

    if (! $football['ok']) {
        foreach ($football['failures'] as $failure) {
            $this->error('  football: '.$failure);
        }
    }

    return $failed === 0 ? 0 : 1;
});

Schedule::call(fn () => Cache::put('rifitv:scheduler:last_seen_at', now()->toIso8601String(), 3600))->everyMinute();
Schedule::job(new SyncFixturesJob)->everyFourHours()->when(fn () => (bool) config('rifitv.fixture_sync_enabled', true));
Schedule::job(new SyncResultsJob)->everyTwoMinutes()->when(fn () => (bool) config('rifitv.result_sync_enabled', true));
Schedule::job(new CheckStreamHealthJob)->everyFiveMinutes()->when(fn () => (bool) config('rifitv.stream_health_enabled', true));
Schedule::command('rifitv:relay:lifecycle')->everyMinute()->when(fn () => (bool) config('rifitv.stable_relay.enabled', true));
Schedule::call(function (): void {
    Playlist::query()
        ->where('active', true)
        ->where('auto_sync', true)
        ->where(fn ($query) => $query->whereNull('last_sync_at')->orWhere('last_sync_at', '<=', now()->subHours(6)))
        ->each(fn (Playlist $playlist) => ImportPlaylistJob::dispatch($playlist));
})->everyThirtyMinutes();
Schedule::job(new DetectOperationalIssuesJob)->everyFiveMinutes();
Schedule::job(new RefreshHomepageCacheJob)->everyFifteenMinutes();
Schedule::job(new CleanupOperationalDataJob)->daily();
