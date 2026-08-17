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
    let disposed = false;
    let timer: number | null = null;
    let controller: AbortController | null = null;
    let latest = initialMatch;

    const schedule = (): void => {
      if (disposed || isTerminal(latest.status)) {
        return;
      }

      const delay = document.visibilityState === "hidden" ? 60000 : isLive(latest.status) ? 10000 : 30000;
      timer = window.setTimeout(() => void refresh(), delay);
    };

    const refresh = async (): Promise<void> => {
      controller?.abort();
      controller = new AbortController();
      try {
        const next = await getMatch(initialMatch.slug, controller.signal);
        if (!disposed) {
          latest = next;
          setMatch(next);
        }
      } catch {
        // Keep the last known score if a polling request fails.
      } finally {
        schedule();
      }
    };

    const handleVisibility = (): void => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }

      if (document.visibilityState === "visible") {
        void refresh();
      } else {
        schedule();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    schedule();

    return () => {
      disposed = true;
      controller?.abort();
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [initialMatch]);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">{match.competition.name}</p>
          <h2 className="mt-1 text-xl font-bold text-[var(--foreground)]">{match.home_team.name} vs {match.away_team.name}</h2>
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

function isLive(status: Match["status"]): boolean {
  return status === "live" || status === "halftime";
}

function isTerminal(status: Match["status"]): boolean {
  return status === "finished" || status === "cancelled";
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
