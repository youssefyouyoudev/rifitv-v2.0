<?php

return [
    'fixture_sync_enabled' => env('FIXTURE_SYNC_ENABLED', true),
    'result_sync_enabled' => env('RESULT_SYNC_ENABLED', true),
    'stream_health_enabled' => env('STREAM_HEALTH_ENABLED', true),
    'fixture_sync_horizon_days' => (int) env('FIXTURE_SYNC_HORIZON_DAYS', 14),
    'admin_upcoming_days' => (int) env('ADMIN_UPCOMING_DAYS', 7),
    'missing_broadcast_alert_minutes' => (int) env('MISSING_BROADCAST_ALERT_MINUTES', 30),
    'display_timezone' => env('RIFITV_DISPLAY_TIMEZONE', 'Africa/Casablanca'),
    'playback_open_before_minutes' => (int) env('PLAYBACK_OPEN_BEFORE_MINUTES', 10),
    'playback_duration_minutes' => (int) env('PLAYBACK_DURATION_MINUTES', 120),
    'stream_health' => [
        'timeout' => (int) env('STREAM_HEALTH_TIMEOUT', 5),
        'failure_threshold' => (int) env('STREAM_HEALTH_FAILURE_THRESHOLD', 3),
        'recovery_threshold' => (int) env('STREAM_HEALTH_RECOVERY_THRESHOLD', 2),
        'history_retention_days' => (int) env('STREAM_HEALTH_HISTORY_RETENTION_DAYS', 7),
    ],
    'media_gateway' => [
        'enabled' => env('MEDIA_GATEWAY_ENABLED', true),
        'base_url' => env('MEDIA_GATEWAY_BASE_URL', env('APP_URL', 'http://127.0.0.1:8000').'/media'),
        'token_ttl_minutes' => (int) env('MEDIA_GATEWAY_TOKEN_TTL_MINUTES', 10),
        'internal_secret' => env('MEDIA_GATEWAY_INTERNAL_SECRET'),
    ],
    'stable_relay' => [
        'enabled' => env('STABLE_RELAY_ENABLED', true),
        'default_for_mpegts' => env('STABLE_RELAY_DEFAULT_FOR_MPEGTS', true),
        'ffmpeg_binary' => env('STABLE_RELAY_FFMPEG_BINARY', 'ffmpeg'),
        'storage_path' => env('STABLE_RELAY_STORAGE_PATH', storage_path('app/live-hls')),
        'public_base_path' => env('STABLE_RELAY_PUBLIC_BASE_PATH', '/media/hls'),
        'public_base_url' => env('STABLE_RELAY_PUBLIC_BASE_URL', env('APP_URL', 'http://127.0.0.1:8000').'/media/hls'),
        'segment_seconds' => (int) env('STABLE_RELAY_SEGMENT_SECONDS', 2),
        'list_size' => (int) env('STABLE_RELAY_LIST_SIZE', 10),
        'delete_threshold' => (int) env('STABLE_RELAY_DELETE_THRESHOLD', 4),
        'ready_segments' => (int) env('STABLE_RELAY_READY_SEGMENTS', 3),
        'stall_seconds' => (int) env('STABLE_RELAY_STALL_SECONDS', 8),
    ],
    'iptv' => [
        'initial_health_sample_limit' => (int) env('IPTV_INITIAL_HEALTH_SAMPLE_LIMIT', 50),
    ],
];
