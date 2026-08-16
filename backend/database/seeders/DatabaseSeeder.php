<?php

namespace Database\Seeders;

use App\Enums\MatchStatus;
use App\Enums\StreamHealth;
use App\Enums\StreamProtocol;
use App\Models\Announcement;
use App\Models\Channel;
use App\Models\Competition;
use App\Models\CompetitionProviderMapping;
use App\Models\GameMatch;
use App\Models\HomepageSection;
use App\Models\Role;
use App\Models\SiteSetting;
use App\Models\StreamSource;
use App\Models\Team;
use App\Models\TeamProviderMapping;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $demoSeedAllowed = ! app()->environment('production') || (bool) env('RIFITV_SEED_DEMO_DATA', false);
        $roles = collect([
            ['Owner', 'owner', ['*']],
            ['Editor', 'editor', ['admin.search', 'matches.manage', 'scores.manage', 'teams.manage', 'competitions.manage']],
            ['Stream Manager', 'stream-manager', ['admin.search', 'streams.manage']],
            ['Content Manager', 'content-manager', ['admin.search', 'content.manage', 'settings.manage']],
            ['Operations Manager', 'operations-manager', ['admin.search', 'automation.manage', 'alerts.view', 'health.view', 'sync.view', 'streams.manage']],
        ])->mapWithKeys(fn (array $row) => [
            $row[1] => Role::query()->updateOrCreate(['slug' => $row[1]], [
                'name' => $row[0],
                'permissions' => $row[2],
            ]),
        ]);

        SiteSetting::query()->updateOrCreate(['key' => 'display_timezone'], ['value' => 'Africa/Casablanca']);
        SiteSetting::query()->updateOrCreate(['key' => 'site_name'], ['value' => 'RiFiTV']);
        SiteSetting::query()->updateOrCreate(['key' => 'tagline'], ['value' => 'Live football, event first']);
        SiteSetting::query()->updateOrCreate(['key' => 'fixture_sync_enabled'], ['value' => true]);
        SiteSetting::query()->updateOrCreate(['key' => 'result_sync_enabled'], ['value' => true]);
        SiteSetting::query()->updateOrCreate(['key' => 'stream_health_enabled'], ['value' => true]);
        SiteSetting::query()->updateOrCreate(['key' => 'match_activation_window_minutes'], ['value' => 60]);
        SiteSetting::query()->updateOrCreate(['key' => 'missing_broadcast_alert_minutes'], ['value' => 30]);

        if (! $demoSeedAllowed) {
            return;
        }

        $admin = User::query()->updateOrCreate([
            'email' => 'admin@rifitv.local',
        ], [
            'name' => 'RiFiTV Admin',
            'password' => Hash::make('password'),
            'is_admin' => true,
            'active' => true,
        ]);
        $admin->roles()->sync([$roles['owner']->id]);

        $competitions = collect([
            ['Premier League', 'PL', 'GB', 10, true, true],
            ['UEFA Champions League', 'UCL', null, 20, true, true],
            ['La Liga', 'LALIGA', 'ES', 30, true, true],
            ['Serie A', 'SA', 'IT', 40, false, false],
            ['Bundesliga', 'BUN', 'DE', 50, false, false],
            ['Ligue 1', 'L1', 'FR', 60, false, false],
            ['MLS', 'MLS', 'US', 70, false, false],
            ['Saudi Pro League', 'SPL', 'SA', 80, false, false],
        ])->mapWithKeys(fn (array $row) => [
            Str::slug($row[0]) => Competition::query()->updateOrCreate(
                ['slug' => Str::slug($row[0])],
                [
                    'name' => $row[0],
                    'short_name' => $row[1],
                    'country_code' => $row[2],
                    'logo_path' => null,
                    'active' => $row[4],
                    'featured' => $row[5],
                    'selection_mode' => 'featured_teams_only',
                    'sort_order' => $row[3],
                ]
            ),
        ]);

        $teams = collect([
            ['Arsenal', 'ARS', 'GB', '#ef0107'],
            ['Chelsea', 'CHE', 'GB', '#034694'],
            ['Liverpool', 'LIV', 'GB', '#c8102e'],
            ['Manchester City', 'MCI', 'GB', '#6cabdd'],
            ['Manchester United', 'MUN', 'GB', '#da291c'],
            ['Tottenham Hotspur', 'TOT', 'GB', '#132257'],
            ['Barcelona', 'BAR', 'ES', '#a50044'],
            ['Real Madrid', 'RMA', 'ES', '#ffffff'],
            ['Atletico Madrid', 'ATM', 'ES', '#cb3524'],
        ])->mapWithKeys(fn (array $row) => [
            Str::slug($row[0]) => Team::query()->updateOrCreate(
                ['slug' => Str::slug($row[0])],
                [
                    'name' => $row[0],
                    'short_name' => $row[1],
                    'country_code' => $row[2],
                    'primary_color' => $row[3],
                    'logo_path' => null,
                    'active' => true,
                    'featured' => true,
                ]
            ),
        ]);

        foreach (['premier-league', 'uefa-champions-league', 'la-liga'] as $competitionSlug) {
            $competitions[$competitionSlug]->rule()->updateOrCreate(['competition_id' => $competitions[$competitionSlug]->id], [
                'mode' => 'featured_teams_only',
                'active' => true,
            ]);
        }
        $competitions['premier-league']->featuredTeams()->sync($teams->only(['arsenal', 'chelsea', 'liverpool', 'manchester-city', 'manchester-united', 'tottenham-hotspur'])->pluck('id')->all());
        $competitions['uefa-champions-league']->featuredTeams()->sync($teams->only(['arsenal', 'chelsea', 'liverpool', 'manchester-city', 'manchester-united', 'tottenham-hotspur', 'barcelona', 'real-madrid', 'atletico-madrid'])->pluck('id')->all());
        $competitions['la-liga']->featuredTeams()->sync($teams->only(['barcelona', 'real-madrid', 'atletico-madrid'])->pluck('id')->all());

        foreach ([
            ['premier-league', 'pl', 'Premier League'],
            ['uefa-champions-league', 'ucl', 'UEFA Champions League'],
            ['la-liga', 'laliga', 'La Liga'],
        ] as [$slug, $externalId, $externalName]) {
            CompetitionProviderMapping::query()->updateOrCreate(
                ['provider' => 'mock', 'external_id' => $externalId],
                ['competition_id' => $competitions[$slug]->id, 'external_name' => $externalName, 'aliases' => []]
            );
        }

        foreach ([
            ['arsenal', 'ars', 'Arsenal'],
            ['chelsea', 'che', 'Chelsea'],
            ['liverpool', 'liv', 'Liverpool'],
            ['manchester-city', 'mci', 'Manchester City'],
            ['manchester-united', 'mun', 'Manchester United'],
            ['tottenham-hotspur', 'tot', 'Tottenham Hotspur'],
            ['barcelona', 'bar', 'Barcelona'],
            ['real-madrid', 'rma', 'Real Madrid'],
            ['atletico-madrid', 'atm', 'Atletico Madrid'],
        ] as [$slug, $externalId, $externalName]) {
            TeamProviderMapping::query()->updateOrCreate(
                ['provider' => 'mock', 'external_id' => $externalId],
                ['team_id' => $teams[$slug]->id, 'external_name' => $externalName, 'aliases' => []]
            );
        }

        $primaryChannel = Channel::query()->updateOrCreate(
            ['slug' => 'rifitv-live-1'],
            ['name' => 'RiFiTV Live 1', 'logo_path' => null, 'country_code' => 'MA', 'language' => 'Arabic', 'category' => 'Sports', 'active' => true, 'sort_order' => 10]
        );
        $backupChannel = Channel::query()->updateOrCreate(
            ['slug' => 'rifitv-backup'],
            ['name' => 'RiFiTV Backup', 'logo_path' => null, 'country_code' => 'MA', 'language' => 'Arabic', 'category' => 'Sports', 'active' => true, 'sort_order' => 20]
        );

        StreamSource::query()->updateOrCreate(
            ['channel_id' => $primaryChannel->id, 'name' => 'Main HLS'],
            [
                'protocol' => StreamProtocol::Hls,
                'url' => env('RIFITV_DEV_HLS_URL', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
                'priority' => 10,
                'enabled' => true,
                'is_backup' => false,
                'last_known_status' => StreamHealth::Healthy,
                'last_checked_at' => now(),
                'latency_ms' => 38,
                'last_success_at' => now(),
                'consecutive_failures' => 0,
                'consecutive_successes' => 4,
                'health_score' => 96,
            ]
        );

        StreamSource::query()->updateOrCreate(
            ['channel_id' => $primaryChannel->id, 'name' => 'Broken HLS Simulation'],
            [
                'protocol' => StreamProtocol::Hls,
                'url' => env('RIFITV_DEV_BROKEN_HLS_URL', 'http://localhost:65534/missing.m3u8'),
                'priority' => 20,
                'enabled' => true,
                'is_backup' => true,
                'last_known_status' => StreamHealth::Unknown,
                'last_checked_at' => null,
                'health_score' => 50,
            ]
        );

        StreamSource::query()->updateOrCreate(
            ['channel_id' => $backupChannel->id, 'name' => 'MPEG-TS Placeholder'],
            [
                'protocol' => StreamProtocol::MpegTs,
                'url' => env('RIFITV_DEV_MPEGTS_URL', 'http://localhost:8080/dev/live.ts'),
                'priority' => 30,
                'enabled' => true,
                'is_backup' => true,
                'last_known_status' => StreamHealth::Unknown,
                'last_checked_at' => null,
                'health_score' => 50,
            ]
        );

        $now = Carbon::now('UTC');
        $matches = [
            ['arsenal-vs-chelsea-live', 'premier-league', 'arsenal', 'chelsea', $now->copy()->subMinutes(40), MatchStatus::Live, 1, 1, 42, true],
            ['liverpool-vs-manchester-city', 'premier-league', 'liverpool', 'manchester-city', $now->copy()->addHours(3), MatchStatus::Scheduled, null, null, null, true],
            ['real-madrid-vs-barcelona', 'la-liga', 'real-madrid', 'barcelona', $now->copy()->addDay(), MatchStatus::Scheduled, null, null, null, true],
            ['manchester-united-vs-tottenham-hotspur', 'premier-league', 'manchester-united', 'tottenham-hotspur', $now->copy()->subDay(), MatchStatus::Finished, 2, 0, null, false],
            ['atletico-madrid-vs-real-madrid', 'la-liga', 'atletico-madrid', 'real-madrid', $now->copy()->subHours(2), MatchStatus::Halftime, 0, 0, 45, false],
            ['chelsea-vs-barcelona-ucl', 'uefa-champions-league', 'chelsea', 'barcelona', $now->copy()->addDays(2), MatchStatus::Scheduled, null, null, null, false],
        ];

        foreach ($matches as [$slug, $competition, $home, $away, $kickoff, $status, $homeScore, $awayScore, $minute, $featured]) {
            $match = GameMatch::query()->updateOrCreate(
                ['slug' => $slug],
                [
                    'competition_id' => $competitions[$competition]->id,
                    'provider' => 'mock',
                    'external_id' => 'seed-'.$slug,
                    'source_provider' => 'manual-demo-seed',
                    'source_external_id' => 'seed-'.$slug,
                    'source_reference' => 'local development seed',
                    'source_verified_at' => now(),
                    'source_hash' => hash('sha256', 'seed|'.$slug),
                    'verification_status' => 'manual_verified',
                    'last_synced_at' => now(),
                    'sync_status' => 'seeded',
                    'manual_overrides' => null,
                    'home_team_id' => $teams[$home]->id,
                    'away_team_id' => $teams[$away]->id,
                    'kickoff_at' => $kickoff,
                    'kickoff_status' => 'confirmed',
                    'status' => $status,
                    'home_score' => $homeScore,
                    'away_score' => $awayScore,
                    'minute' => $minute,
                    'featured' => $featured,
                    'published_at' => now(),
                    'visibility' => 'public',
                    'seo_title' => null,
                    'seo_description' => null,
                    'notes' => null,
                ]
            );

            $match->channels()->sync([
                $primaryChannel->id => ['sort_order' => 10],
                $backupChannel->id => ['sort_order' => 20],
            ]);
        }

        HomepageSection::query()->updateOrCreate(['key' => 'live_now'], ['title' => 'Live Now', 'type' => 'live_now', 'enabled' => true, 'sort_order' => 10, 'limit' => 8]);
        HomepageSection::query()->updateOrCreate(['key' => 'today'], ['title' => "Today's Matches", 'type' => 'today', 'enabled' => true, 'sort_order' => 20, 'limit' => 12]);
        HomepageSection::query()->updateOrCreate(['key' => 'premier_league'], ['title' => 'Premier League', 'type' => 'competition', 'enabled' => true, 'sort_order' => 30, 'limit' => 8, 'competition_id' => $competitions['premier-league']->id]);
        HomepageSection::query()->updateOrCreate(['key' => 'champions_league'], ['title' => 'Champions League', 'type' => 'competition', 'enabled' => true, 'sort_order' => 40, 'limit' => 8, 'competition_id' => $competitions['uefa-champions-league']->id]);
        HomepageSection::query()->updateOrCreate(['key' => 'la_liga'], ['title' => 'La Liga', 'type' => 'competition', 'enabled' => true, 'sort_order' => 50, 'limit' => 8, 'competition_id' => $competitions['la-liga']->id]);

        Announcement::query()->updateOrCreate(['title' => 'Development broadcast notice'], [
            'message' => 'Streams in this environment are placeholders for testing authorized playback only.',
            'type' => 'info',
            'active' => true,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addWeek(),
        ]);
    }
}
