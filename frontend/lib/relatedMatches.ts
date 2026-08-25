import type { Match } from "./types";
import { localDateKey, addDays } from "./footballDate";

/**
 * Find related matches based on various factors:
 * 1. Same competition (highest priority)
 * 2. Same teams (home or away)
 * 3. Same date proximity
 * 4. Featured/prominent matches
 */
export function findRelatedMatches(
  currentMatch: Match,
  allMatches: Match[],
  limit = 4
): Match[] {
  // Filter out the current match
  const otherMatches = allMatches.filter(
    match => match.id !== currentMatch.id
  );

  // Score each match based on relatedness factors
  const scoredMatches = otherMatches.map(match => {
    let score = 0;

    // Same competition (highest weight)
    if (match.competition.id === currentMatch.competition.id) {
      score += 100;
    }

    // Same teams (home or away)
    if (
      match.home_team.id === currentMatch.home_team.id ||
      match.home_team.id === currentMatch.away_team.id ||
      match.away_team.id === currentMatch.home_team.id ||
      match.away_team.id === currentMatch.away_team.id
    ) {
      score += 50;
    }

    // Same date proximity (within 2 days)
    const currentDateKey = localDateKey(
      currentMatch.kickoff_at ?
        new Date(currentMatch.kickoff_at) :
        new Date(currentMatch.scheduled_date ?? '')
    );
    const matchDateKey = localDateKey(
      match.kickoff_at ?
        new Date(match.kickoff_at) :
        new Date(match.scheduled_date ?? '')
    );

    if (currentDateKey === matchDateKey) {
      score += 25; // Same day
    } else {
      const currentDate = new Date(currentDateKey);
      const matchDate = new Date(matchDateKey);
      const diffDays = Math.abs(
        (currentDate.getTime() - matchDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays <= 2) {
        score += 15; // Within 2 days
      }
    }

    // Featured matches get a boost
    if (match.featured) {
      score += 10;
    }

    // Recent/live matches get a boost
    if (match.status === "live" || match.status === "halftime") {
      score += 20;
    } else if (match.status === "scheduled") {
      score += 5;
    }

    return { match, score };
  });

  // Sort by score (descending) and return top matches
  return scoredMatches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.match);
}