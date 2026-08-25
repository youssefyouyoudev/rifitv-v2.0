<?php

namespace App\Football\Providers;

use App\Football\Contracts\FootballDataProviderInterface;
use App\Football\DTO\ProviderFixture;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Exception\BadRequestException;

class ApiFootballProvider implements FootballDataProviderInterface
{
    protected string $baseUrl;
    protected string $apiKey;

    public function __construct()
    {
        $this->baseUrl = config('services.api-football.base_url', 'https://v3.football.api-sports.io');
        $this->apiKey = (string) config('services.api-football.key', '');
    }

    public function name(): string
    {
        return 'api-football';
    }

    /**
     * Get fixtures for a date range.
     */
    public function getFixtures(CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        // Check if API key is configured
        if (empty($this->apiKey)) {
            Log::warning('API-Football: API key not configured');
            return collect();
        }

        Log::info('API-Football: getFixtures called with apiKey: [' . $this->apiKey . ']');

        $fromDate = $from->format('Y-m-d');
        $toDate = $to->format('Y-m-d');

        try {
            $response = Http::withHeaders([
                'x-rapidapi-key' => $this->apiKey,
                'x-rapidapi-host' => 'v3.football.api-sports.io',
            ])->get($this->baseUrl . '/fixtures', [
                'from' => $fromDate,
                'to' => $toDate,
            ]);

            Log::info('API-Football: getFixtures response status: ' . $response->status());

            if ($response->failed()) {
                Log::error('API-Football: Request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return collect();
            }

            $data = $response->json();

            Log::info('API-Football: getFixtures data: ' . json_encode($data));

            if (!isset($data['response']) || !is_array($data['response'])) {
                return collect();
            }

            $fixtures = collect();

            foreach ($data['response'] as $fixtureData) {
                $fixture = $this->convertFixture($fixtureData);
                if ($fixture) {
                    $fixtures->push($fixture);
                }
            }

            return $fixtures;
        } catch (\Throwable $e) {
            Log::error('API-Football: Unexpected error in getFixtures', ['error' => $e->getMessage()]);
            return collect();
        }
    }

    /**
     * Get live fixtures.
     */
    public function getLiveFixtures(): Collection
    {
        if (empty($this->apiKey)) {
            Log::warning('API-Football: API key not configured');
            return collect();
        }

        try {
            $response = Http::withHeaders([
                'x-rapidapi-key' => $this->apiKey,
                'x-rapidapi-host' => 'v3.football.api-sports.io',
            ])->get($this->baseUrl . '/fixtures', [
                'live' => 'all',
            ]);

            if ($response->failed()) {
                Log::error('API-Football: Live request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return collect();
            }

            $data = $response->json();

            if (!isset($data['response']) || !is_array($data['response'])) {
                return collect();
            }

            $fixtures = collect();

            foreach ($data['response'] as $fixtureData) {
                $fixture = $this->convertFixture($fixtureData);
                if ($fixture) {
                    $fixtures->push($fixture);
                }
            }

            return $fixtures;
        } catch (\Throwable $e) {
            Log::error('API-Football: Unexpected error in getLiveFixtures', ['error' => $e->getMessage()]);
            return collect();
        }
    }

    /**
     * Get results for a date range.
     */
    public function getResults(CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        if (empty($this->apiKey)) {
            Log::warning('API-Football: API key not configured');
            return collect();
        }

        $fromDate = $from->format('Y-m-d');
        $toDate = $to->format('Y-m-d');

        try {
            $response = Http::withHeaders([
                'x-rapidapi-key' => $this->apiKey,
                'x-rapidapi-host' => 'v3.football.api-sports.io',
            ])->get($this->baseUrl . '/fixtures', [
                'from' => $fromDate,
                'to' => $toDate,
                'status' => 'FT',
            ]);

            if ($response->failed()) {
                Log::error('API-Football: Results request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return collect();
            }

            $data = $response->json();

            if (!isset($data['response']) || !is_array($data['response'])) {
                return collect();
            }

            $fixtures = collect();

            foreach ($data['response'] as $fixtureData) {
                $fixture = $this->convertFixture($fixtureData);
                if ($fixture) {
                    $fixtures->push($fixture);
                }
            }

            return $fixtures;
        } catch (\Throwable $e) {
            Log::error('API-Football: Unexpected error in getResults', ['error' => $e->getMessage()]);
            return collect();
        }
    }

    /**
     * Convert API-Football fixture to ProviderFixture.
     */
    protected function convertFixture(array $data): ?ProviderFixture
    {
        try {
            $fixture = $data['fixture'] ?? [];
            $league = $data['league'] ?? [];
            $teams = $data['teams'] ?? [];
            $goals = $data['goals'] ?? [];

            $fixtureId = $fixture['id'] ?? null;
            if (!$fixtureId) {
                return null;
            }

            $leagueId = $league['id'] ?? null;
            $leagueName = $league['name'] ?? null;
            // Note: We don't have a direct way to get the provider-specific league slug from API-Football.
            // We might need to map it or use the league name. For now, we'll use the league name as slug.
            // This is a simplification and might need adjustment.
            $leagueSlug = strtolower(str_replace(' ', '-', $leagueName ?? ''));

            $homeTeam = $teams['home'] ?? [];
            $awayTeam = $teams['away'] ?? [];

            $homeTeamId = $homeTeam['id'] ?? null;
            $homeTeamName = $homeTeam['name'] ?? null;
            // We don't have a team slug from API-Football in the free tier? We'll use the name for now.
            $homeTeamSlug = strtolower(str_replace(' ', '-', $homeTeamName ?? ''));

            $awayTeamId = $awayTeam['id'] ?? null;
            $awayTeamName = $awayTeam['name'] ?? null;
            $awayTeamSlug = strtolower(str_replace(' ', '-', $awayTeamName ?? ''));

            $kickoffAt = $fixture['timestamp'] ? CarbonImmutable::createFromTimestamp($fixture['timestamp']) : null;
            $statusElapsed = $fixture['status']['elapsed'] ?? null;
            $statusShort = $fixture['status']['short'] ?? null; // e.g., 1H, HT, FT, etc.

            // Normalize the status code to match our internal representation.
            // We'll rely on the StatusNormalizer service later, but we can do a basic mapping here.
            $statusCode = $this->mapStatus($statusShort, $statusElapsed);

            $homeGoals = $goals['home'] ?? null;
            $awayGoals = $goals['away'] ?? null;

            return new ProviderFixture(
                'api-football',
                (string) $fixtureId,
                (string) $leagueId,
                $leagueName,
                $leagueSlug,
                (string) $homeTeamId,
                $homeTeamName,
                $homeTeamSlug,
                (string) $awayTeamId,
                $awayTeamName,
                $awayTeamSlug,
                $kickoffAt,
                $statusCode,
                $homeGoals,
                $awayGoals,
                $statusElapsed
            );
        } catch (\Throwable $e) {
            // Log the error and skip this fixture
            Log::error('API-Football: Error converting fixture', [
                'error' => $e->getMessage(),
                'data' => $fixtureData,
            ]);
            return null;
        }
    }

    /**
     * Map API-Football status short to our internal status code.
     * This is a basic mapping and might need adjustment.
     */
    protected function mapStatus(string $statusShort, ?int $elapsed): string
    {
        // API-Football status short: NS (Not Started), 1H (First Half), HT (Halftime), 2H (Second Half), FT (Full Time), ET (Extra Time), P (Penalty), etc.
        // We map to our internal status codes: scheduled, live, halftime, finished, postponed, cancelled.
        // Note: We don't have postponed or cancelled from API-Football in the fixture endpoint? They might be in the league or fixture status.
        // For simplicity, we map:
        // NS -> scheduled
        // 1H, HT, 2H -> live (we'll break down by elapsed later in the service)
        // FT, ET, P -> finished
        // We'll leave postponed and cancelled to be handled by the service if needed.

        if ($statusShort === 'NS') {
            return 'scheduled';
        }

        if (in_array($statusShort, ['1H', 'HT', '2H'], true)) {
            return 'live';
        }

        if (in_array($statusShort, ['FT', 'ET', 'P'], true)) {
            return 'finished';
        }

        // Default to scheduled if unknown
        return 'scheduled';
    }
}