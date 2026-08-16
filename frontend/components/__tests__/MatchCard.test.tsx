import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchCard } from "../MatchCard";
import type { Match } from "@/lib/types";

const baseMatch: Match = {
  id: 1,
  slug: "arsenal-vs-chelsea-live",
  competition: { id: 1, name: "Premier League", slug: "premier-league", short_name: "PL", logo_path: null, country_code: "GB", active: true, sort_order: 1 },
  home_team: { id: 1, name: "Arsenal", slug: "arsenal", short_name: "ARS", logo_path: null, country_code: "GB", primary_color: "#ef0107" },
  away_team: { id: 2, name: "Chelsea", slug: "chelsea", short_name: "CHE", logo_path: null, country_code: "GB", primary_color: "#034694" },
  kickoff_at: "2026-08-14T18:00:00Z",
  actual_started_at: null,
  playback_open_override_at: null,
  playback_close_override_at: null,
  scheduled_date: "2026-08-14",
  kickoff_precision: "confirmed",
  source_timezone: "Europe/London",
  source_matchday: 1,
  source_round_label: "Matchday 1",
  status: "live",
  home_score: 1,
  away_score: 1,
  minute: 42,
  featured: true,
  channels: [],
  broadcasts: [],
  playback_window: {
    status: "open",
    server_time: "2026-08-14T17:55:00Z",
    kickoff_at: "2026-08-14T18:00:00Z",
    actual_started_at: null,
    opens_at: "2026-08-14T17:50:00Z",
    closes_at: "2026-08-14T20:00:00Z",
    seconds_until_open: 0,
    seconds_until_kickoff: 300,
    seconds_until_close: 7500,
    open_before_minutes: 10,
    duration_minutes: 120,
  },
};

describe("MatchCard", () => {
  it("renders a live state with score and watch CTA", () => {
    render(<MatchCard match={baseMatch} />);

    expect(screen.getByText("Live now")).toBeInTheDocument();
    expect(screen.getByText("Watch Live")).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(2);
  });

  it("renders scheduled matches without inferred live state", () => {
    render(<MatchCard match={{ ...baseMatch, status: "scheduled", home_score: null, away_score: null, playback_window: { ...baseMatch.playback_window, status: "locked", seconds_until_open: 1800 } }} />);

    expect(screen.getByText("Stream opens in")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("renders finished matches with final score", () => {
    render(<MatchCard match={{ ...baseMatch, status: "finished", home_score: 2, away_score: 0, playback_window: { ...baseMatch.playback_window, status: "ended", seconds_until_kickoff: 0, seconds_until_close: 0 } }} />);

    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
