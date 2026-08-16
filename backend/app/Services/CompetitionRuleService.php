<?php

namespace App\Services;

use App\Enums\CompetitionSelectionMode;
use App\Models\Competition;
use App\Models\GameMatch;

class CompetitionRuleService
{
    public function qualifies(GameMatch $match): bool
    {
        $competition = $match->competition;
        $mode = $competition->rule?->mode ?? $competition->selection_mode ?? CompetitionSelectionMode::FeaturedTeamsOnly;

        return match ($mode) {
            CompetitionSelectionMode::AllMatches => true,
            CompetitionSelectionMode::ManualOnly => $match->featured,
            CompetitionSelectionMode::FeaturedTeamsOnly => $this->hasFeaturedTeam($competition, $match),
        };
    }

    private function hasFeaturedTeam(Competition $competition, GameMatch $match): bool
    {
        $featuredTeamIds = $competition->featuredTeams()->pluck('teams.id');

        return $featuredTeamIds->contains($match->home_team_id) || $featuredTeamIds->contains($match->away_team_id);
    }
}
