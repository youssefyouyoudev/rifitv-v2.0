import type { HomePayload, Match } from "./types";

type LiveScheduleInput = Pick<HomePayload, "matches" | "next_match">;

export function selectNextBroadcast(
  home: LiveScheduleInput,
  liveMatches: Pick<Match, "id">[],
): Match | null {
  const liveIds = new Set(liveMatches.map((match) => match.id));

  return home.matches.find((match) => !liveIds.has(match.id) && isUpcomingBroadcast(match))
    ?? home.next_match
    ?? null;
}

export function selectLaterToday(
  home: LiveScheduleInput,
  liveMatches: Pick<Match, "id">[],
  nextBroadcast: Pick<Match, "id"> | null,
): Match[] {
  const liveIds = new Set(liveMatches.map((match) => match.id));

  return home.matches.filter((match) => {
    if (liveIds.has(match.id) || match.id === nextBroadcast?.id) {
      return false;
    }

    return match.status !== "finished" && match.playback_window.status !== "ended";
  });
}

function isUpcomingBroadcast(match: Match): boolean {
  return match.status === "scheduled" && !["ended", "unavailable"].includes(match.playback_window.status);
}
