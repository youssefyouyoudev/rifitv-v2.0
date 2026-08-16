"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { TeamMark } from "@/components/TeamMark";
import { getMatch } from "@/lib/api";
import { formatMatchDateLabel } from "@/lib/time";
import type { Match } from "@/lib/types";

export function LiveMatchSummary({ initialMatch }: { initialMatch: Match }) {
  const [match, setMatch] = useState(initialMatch);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        setMatch(await getMatch(initialMatch.slug));
      } catch {
        // Keep the last known score if a polling request fails.
      }
    }, 10000);

    return () => window.clearInterval(timer);
  }, [initialMatch.slug]);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">{match.competition.name}</p>
          <h1 className="mt-1 text-xl font-bold text-[var(--foreground)]">{match.home_team.name} vs {match.away_team.name}</h1>
        </div>
        <StatusBadge status={match.status} />
      </div>

      <div className="mt-5 space-y-4">
        <TeamBlock team={match.home_team} score={match.home_score} showScore={match.status === "live" || match.status === "halftime" || match.status === "finished"} />
        <div className="flex items-center justify-between border-y border-[var(--border)] py-3 text-sm text-[var(--muted)]">
          <span>{match.minute ? `${match.minute}'` : formatMatchDateLabel(match)}</span>
          <span className="font-semibold uppercase">VS</span>
        </div>
        <TeamBlock team={match.away_team} score={match.away_score} showScore={match.status === "live" || match.status === "halftime" || match.status === "finished"} />
      </div>
    </div>
  );
}

function TeamBlock({ team, score, showScore }: { team: Match["home_team"]; score: number | null; showScore: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <TeamMark team={team} size="lg" />
      <span className="min-w-0 truncate font-semibold text-[var(--foreground)]">{team.name}</span>
      {showScore ? <span className="ml-auto text-2xl font-black tabular-nums text-[var(--foreground)]">{score ?? 0}</span> : null}
    </div>
  );
}
