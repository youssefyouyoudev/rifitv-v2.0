import { describe, expect, it } from "vitest";
import { selectLaterToday, selectNextBroadcast } from "./liveSchedule";
import type { HomePayload, Match } from "./types";

const baseMatch: Match = {
  id: 1,
  slug: "arsenal-vs-chelsea-2026-08-17",
  competition: { id: 1, name: "Premier League", slug: "premier-league", short_name: "PL", logo_path: null, country_code: "GB", active: true, sort_order: 1 },
  home_team: { id: 1, name: "Arsenal", slug: "arsenal", short_name: "ARS", logo_path: null, country_code: "GB", primary_color: "#ef0107" },
  away_team: { id: 2, name: "Chelsea", slug: "chelsea", short_name: "CHE", logo_path: null, country_code: "GB", primary_color: "#034694" },
  kickoff_at: "2026-08-17T18:00:00Z",
  actual_started_at: null,
  playback_open_override_at: null,
  playback_close_override_at: null,
  scheduled_date: "2026-08-17",
  kickoff_precision: "confirmed",
  source_timezone: "Europe/London",
  source_matchday: 1,
  source_round_label: "Matchday 1",
  status: "scheduled",
  home_score: null,
  away_score: null,
  minute: null,
  featured: false,
  channels: [],
  broadcasts: [],
  playback_window: {
    status: "locked",
    server_time: "2026-08-17T12:00:00Z",
    kickoff_at: "2026-08-17T18:00:00Z",
    actual_started_at: null,
    opens_at: "2026-08-17T17:50:00Z",
    closes_at: "2026-08-17T20:00:00Z",
    seconds_until_open: 21000,
    seconds_until_kickoff: 21600,
    seconds_until_close: 28800,
    open_before_minutes: 10,
    duration_minutes: 120,
  },
};

type MatchOverrides = Partial<Omit<Match, "playback_window">> & {
  playback_window?: Partial<Match["playback_window"]>;
};

function match(overrides: MatchOverrides): Match {
  return { ...baseMatch, ...overrides, playback_window: { ...baseMatch.playback_window, ...overrides.playback_window } };
}

function home(matches: Match[], nextMatch: Match | null = null): Pick<HomePayload, "matches" | "next_match"> {
  return { matches, next_match: nextMatch };
}

describe("live page schedule selection", () => {
  it("uses today's next scheduled match before the cross-day fallback", () => {
    const todayMatch = match({ id: 2, slug: "today-next" });
    const tomorrowMatch = match({ id: 3, slug: "tomorrow-next", scheduled_date: "2026-08-18" });

    expect(selectNextBroadcast(home([todayMatch], tomorrowMatch), [])?.slug).toBe("today-next");
  });

  it("keeps live and selected next matches out of the later-today list", () => {
    const live = match({ id: 4, slug: "live-match", status: "live", playback_window: { status: "open" } });
    const next = match({ id: 5, slug: "next-match" });
    const later = match({ id: 6, slug: "later-match" });
    const finished = match({ id: 7, slug: "finished-match", status: "finished", playback_window: { status: "ended" } });

    expect(selectLaterToday(home([live, next, later, finished]), [live], next).map((item) => item.slug)).toEqual(["later-match"]);
  });
});
