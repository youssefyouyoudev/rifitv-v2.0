<?php

namespace App\Services;

use App\Enums\MatchStatus;
use App\Enums\MatchVisibility;
use App\Football\DTO\ProviderFixture;
use App\Models\FixtureImportLog;
use App\Models\GameMatch;
use App\Models\SyncRun;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class FixtureSyncService
{
    public function __construct(
        private readonly FootballProviderManager $providers,
        private readonly ProviderMappingService $mappings,
        private readonly CompetitionRuleService $rules,
        private readonly StatusNormalizer $statuses,
        private readonly PublicContentService $content,
        private readonly OperationalAlertService $alerts,
        private readonly MatchSlugService $slugs,
    ) {}

    public function sync(CarbonImmutable $from, CarbonImmutable $to): SyncRun
    {
        return Cache::lock('rifitv:fixture-sync', 300)->block(2, function () use ($from, $to): SyncRun {
            $provider = $this->providers->provider();
            $run = SyncRun::query()->create(['type' => 'fixtures', 'provider' => $provider->name(), 'started_at' => now(), 'status' => 'running']);

            try {
                foreach ($provider->getFixtures($from, $to) as $fixture) {
                    $this->syncFixture($fixture, $run);
                }

                $run->update(['status' => 'succeeded', 'finished_at' => now()]);
                $this->content->forgetHome();

                return $run->fresh();
            } catch (\Throwable $e) {
                $run->update(['status' => 'failed', 'finished_at' => now(), 'error_summary' => Str::limit($e->getMessage(), 500)]);
                $this->alerts->open('fixture_sync_failed', 'fixture-sync', 'warning', 'Fixture sync failed', 'The provider could not be synchronized.');
                throw $e;
            }
        });
    }

    public function syncFixture(ProviderFixture $fixture, SyncRun $run): ?GameMatch
    {
        $competition = $this->mappings->competitionFor($fixture);
        $home = $this->mappings->teamFor($fixture->provider, $fixture->homeExternalId);
        $away = $this->mappings->teamFor($fixture->provider, $fixture->awayExternalId);

        if (! $competition || ! $home || ! $away) {
            $run->increment('failed_count');
            $this->log($run, $fixture, 'needs_mapping', 'Competition or team mapping is missing.');
            $this->alerts->open('mapping_required', 'mapping-'.$fixture->provider.'-'.$fixture->externalId, 'warning', 'Fixture needs mapping', $fixture->homeName.' vs '.$fixture->awayName);

            return null;
        }

        $match = GameMatch::query()->firstOrNew(['provider' => $fixture->provider, 'external_id' => $fixture->externalId]);
        $wasNew = ! $match->exists;
        $match->fill([
            'competition_id' => $competition->id,
            'home_team_id' => $home->id,
            'away_team_id' => $away->id,
            'kickoff_at' => $match->hasManualOverride('kickoff_at') ? $match->kickoff_at : $fixture->kickoffAt,
            'status' => $match->hasManualOverride('status') ? $match->status : $this->statuses->normalize($fixture->statusCode),
            'home_score' => $match->hasManualOverride('score') ? $match->home_score : $fixture->homeScore,
            'away_score' => $match->hasManualOverride('score') ? $match->away_score : $fixture->awayScore,
            'minute' => $match->hasManualOverride('score') ? $match->minute : $fixture->minute,
            'slug' => $match->slug ?: $this->slugs->uniqueSlug($home->name, $away->name, $fixture->kickoffAt),
            'featured' => $match->hasManualOverride('featured') ? $match->featured : false,
            'published_at' => $match->published_at,
            'visibility' => $match->visibility ?? MatchVisibility::Public,
            'source_provider' => $match->source_provider ?: $fixture->provider,
            'source_external_id' => $match->source_external_id ?: $fixture->externalId,
            'verification_status' => $match->verification_status ?: 'pending_verification',
            'source_verified_at' => $match->source_verified_at,
            'last_synced_at' => now(),
            'sync_status' => 'synced',
        ]);

        if ($wasNew) {
            $match->published_at = null;
            $match->status = $match->status ?? MatchStatus::Scheduled;
        }

        $match->save();
        $this->slugs->assign($match);
        $match->load('competition');

        if (! $this->rules->qualifies($match) && ! $match->featured) {
            $run->increment('ignored_count');
            $this->log($run, $fixture, 'ignored', 'Ignored by competition featured-team rule.');

            return $match;
        }

        if (! $match->published_at && in_array($match->verification_status, ['verified', 'manual_verified'], true)) {
            $match->update(['published_at' => now()]);
        }

        $run->increment($wasNew ? 'created_count' : 'updated_count');
        $this->log($run, $fixture, $wasNew ? 'imported' : 'updated', 'Fixture synchronized.');

        return $match;
    }

    private function log(SyncRun $run, ProviderFixture $fixture, string $status, string $message): void
    {
        FixtureImportLog::query()->create([
            'sync_run_id' => $run->id,
            'provider' => $fixture->provider,
            'external_id' => $fixture->externalId,
            'home_name' => $fixture->homeName,
            'away_name' => $fixture->awayName,
            'competition_name' => $fixture->competitionName,
            'status' => $status,
            'message' => $message,
            'safe_payload' => ['status_code' => $fixture->statusCode],
        ]);
    }
}
