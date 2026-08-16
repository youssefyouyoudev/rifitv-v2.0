<?php

use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\V1\AdminAnnouncementController;
use App\Http\Controllers\Api\V1\AdminAuditLogController;
use App\Http\Controllers\Api\V1\AdminChannelController;
use App\Http\Controllers\Api\V1\AdminCompetitionController;
use App\Http\Controllers\Api\V1\AdminDashboardController;
use App\Http\Controllers\Api\V1\AdminHomepageController;
use App\Http\Controllers\Api\V1\AdminMatchControlController;
use App\Http\Controllers\Api\V1\AdminMatchController;
use App\Http\Controllers\Api\V1\AdminOperationsController;
use App\Http\Controllers\Api\V1\AdminPlaylistController;
use App\Http\Controllers\Api\V1\AdminSearchController;
use App\Http\Controllers\Api\V1\AdminSettingController;
use App\Http\Controllers\Api\V1\AdminStreamSourceController;
use App\Http\Controllers\Api\V1\AdminTeamController;
use App\Http\Controllers\Api\V1\AdminUploadController;
use App\Http\Controllers\Api\V1\AdminUserController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CompetitionController;
use App\Http\Controllers\Api\V1\HomeController;
use App\Http\Controllers\Api\V1\MatchController;
use App\Http\Controllers\Api\V1\PlaybackController;
use App\Http\Controllers\Api\V1\PlaybackEventController;
use App\Http\Controllers\Api\V1\SearchController;
use App\Http\Controllers\Api\V1\TeamController;
use App\Http\Controllers\MediaGatewayController;
use Illuminate\Support\Facades\Route;

Route::get('health', [HealthController::class, 'public'])->middleware('throttle:public-api');
Route::get('media/tokens/{token}', [MediaGatewayController::class, 'resolve']);

Route::prefix('v1')->group(function (): void {
    Route::middleware('throttle:public-api')->group(function (): void {
        Route::get('home', HomeController::class);
        Route::get('matches', [MatchController::class, 'index']);
        Route::get('matches/{slug}', [MatchController::class, 'show']);
        Route::get('competitions', [CompetitionController::class, 'index']);
        Route::get('competitions/{slug}', [CompetitionController::class, 'show']);
        Route::get('teams/{slug}', [TeamController::class, 'show']);
    });
    Route::get('search', SearchController::class)->middleware('throttle:search');
    Route::get('matches/{slug}/playback', PlaybackController::class)->middleware('throttle:playback');
    Route::post('playback/events', PlaybackEventController::class)->middleware('throttle:playback-events');

    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware(['auth:sanctum', 'throttle:admin-api'])->group(function (): void {
        Route::get('auth/user', [AuthController::class, 'me']);
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::middleware('admin')->prefix('admin')->group(function (): void {
            Route::get('health', [HealthController::class, 'detailed']);
            Route::get('dashboard', AdminDashboardController::class);
            Route::get('search', AdminSearchController::class);
            Route::get('today', [AdminOperationsController::class, 'today']);
            Route::get('stream-health', [AdminOperationsController::class, 'streamHealth']);
            Route::get('alerts', [AdminOperationsController::class, 'alerts']);
            Route::get('sync-runs', [AdminOperationsController::class, 'syncRuns']);
            Route::get('imports/fixtures', [AdminOperationsController::class, 'fixtureImports']);
            Route::get('queue-health', [AdminOperationsController::class, 'queueHealth']);
            Route::post('operations/run', [AdminOperationsController::class, 'run']);

            Route::post('matches/bulk', [AdminMatchController::class, 'bulk']);
            Route::post('matches/{match}/duplicate', [AdminMatchController::class, 'duplicate']);
            Route::patch('matches/{match}/live-control', [AdminMatchController::class, 'liveControl']);
            Route::get('matches/{match}/control', [AdminMatchControlController::class, 'show']);
            Route::post('matches/{match}/control/channels', [AdminMatchControlController::class, 'assignChannels']);
            Route::delete('matches/{match}/control/channels/{channel}', [AdminMatchControlController::class, 'removeChannel']);
            Route::post('matches/{match}/control/channels/{channel}/promote', [AdminMatchControlController::class, 'promoteChannel']);
            Route::post('matches/{match}/control/playback', [AdminMatchControlController::class, 'playback']);
            Route::patch('matches/{match}/control/score', [AdminMatchControlController::class, 'score']);
            Route::patch('matches/{match}/control/status', [AdminMatchControlController::class, 'status']);
            Route::patch('matches/{match}/control/feature', [AdminMatchControlController::class, 'feature']);
            Route::apiResource('matches', AdminMatchController::class);

            Route::apiResource('teams', AdminTeamController::class);
            Route::apiResource('competitions', AdminCompetitionController::class);
            Route::apiResource('channels', AdminChannelController::class);

            Route::post('stream-sources/reorder', [AdminStreamSourceController::class, 'reorder']);
            Route::post('stream-sources/{streamSource}/test', [AdminStreamSourceController::class, 'test']);
            Route::post('stream-sources/{streamSource}/pipeline-test', [AdminStreamSourceController::class, 'pipelineTest']);
            Route::apiResource('stream-sources', AdminStreamSourceController::class);
            Route::get('playlist-channels', [AdminPlaylistController::class, 'channels']);
            Route::post('playlists/test', [AdminPlaylistController::class, 'test']);
            Route::post('playlists/{playlist}/sync', [AdminPlaylistController::class, 'sync']);
            Route::post('playlists/{playlist}/import-now', [AdminPlaylistController::class, 'importNow']);
            Route::apiResource('playlists', AdminPlaylistController::class);

            Route::get('homepage', [AdminHomepageController::class, 'show']);
            Route::put('homepage', [AdminHomepageController::class, 'update']);
            Route::apiResource('announcements', AdminAnnouncementController::class)->except(['show']);
            Route::get('settings', [AdminSettingController::class, 'index']);
            Route::put('settings', [AdminSettingController::class, 'update']);
            Route::get('roles', [AdminUserController::class, 'roles']);
            Route::post('uploads/logo', [AdminUploadController::class, 'logo']);
            Route::post('users/{user}/revoke-sessions', [AdminUserController::class, 'revokeSessions']);
            Route::apiResource('users', AdminUserController::class)->except(['show', 'destroy']);
            Route::get('audit-logs', [AdminAuditLogController::class, 'index']);
        });
    });
});
