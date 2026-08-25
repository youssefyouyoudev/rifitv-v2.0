import type { Match } from "@/lib/types";
import { formatClockTime, formatMatchDateLabel, isLiveStatus } from "@/lib/time";
import { CompetitionLogo } from "./CompetitionLogo";
import { Countdown } from "./Countdown";
import { StatusBadge } from "./StatusBadge";
import { TeamMark } from "./TeamMark";
import { TrackedLink } from "./TrackedLink";

export function MatchCard({ match, serverDate, featured = false }: { match: Match; serverDate?: string; featured?: boolean }) {
  // Use state from API if available, otherwise fall back to direct match properties
  const state = match.state as {
    isLive: boolean;
    isFinished: boolean;
    isPostponed: boolean;
    isCancelled: boolean;
    playbackStatus: string;
    isWatchable: boolean;
    displayStatus: string;
    title: string;
    subtitle: string;
    eventStatus: string;
    countdownSeconds: number | null;
    countdownLabel: string;
  } | null;

  const live = state?.isLive ?? isLiveStatus(match.status);
  const finished = state?.isFinished ?? match.status === "finished";
  const postponed = state?.isPostponed ?? match.status === "postponed";
  const cancelled = state?.isCancelled ?? match.status === "cancelled";
  const playbackStatus = state?.playbackStatus ?? match.playback_window.status;
  const watchable = state?.isWatchable ?? (playbackStatus === "open" && match.channels.length > 0);
  const cta = watchable ? (live ? "Watch Live" : "Watch") : "Details";

  // Determine countdown seconds and label (use state if available)
  let countdownSeconds: number | null = state?.countdownSeconds ?? null;
  let countdownLabel: string = state?.countdownLabel ?? "";
  if (countdownSeconds === null && (playbackStatus === "locked" || playbackStatus === "opening_soon")) {
    countdownSeconds = match.playback_window.seconds_until_open;
    countdownLabel = "Stream opens in";
  } else if (countdownSeconds === null) {
    countdownSeconds = match.playback_window.seconds_until_kickoff;
    countdownLabel = "Starts in";
  }

  // Determine status content
  let statusContent: React.ReactNode = null;
  if (state) {
    // Use state-derived content
    if (state.isLive) {
      statusContent = (
        <span className="inline-flex items-center gap-2 font-semibold text-[var(--live)]">
          <span className="h-2 w-2 rounded-full bg-[var(--live)]" />Live now
        </span>
      );
    } else if (state.isFinished) {
      statusContent = <span>Final</span>;
    } else if (state.isPostponed) {
      statusContent = <span>Postponed</span>;
    } else if (state.isCancelled) {
      statusContent = <span>Cancelled</span>;
    } else if (state.playbackStatus === "tbc") {
      statusContent = <span>Kickoff time will be announced</span>;
    } else if (state.playbackStatus === "ended") {
      statusContent = <span>Broadcast ended</span>;
    } else if (state.countdownSeconds !== null) {
      statusContent = (
        <Countdown seconds={state.countdownSeconds} label={state.countdownLabel} compact />
      );
    } else {
      statusContent = <span className="mt-0.5 block truncate text-xs">{formatMatchDateLabel(match, serverDate)}</span>;
    }
  } else {
    // Fallback to original logic (already handles postponed/cancelled)
    if (live) {
      statusContent = (
        <span className="inline-flex items-center gap-2 font-semibold text-[var(--live)]">
          <span className="h-2 w-2 rounded-full bg-[var(--live)]" />Live now
        </span>
      );
    } else if (finished) {
      statusContent = <span>Final</span>;
    } else if (postponed) {
      statusContent = <span>Postponed</span>;
    } else if (cancelled) {
      statusContent = <span>Cancelled</span>;
    } else if (playbackStatus === "tbc") {
      statusContent = <span>Kickoff time will be announced</span>;
    } else if (playbackStatus === "ended") {
      statusContent = <span>Broadcast ended</span>;
    } else if (countdownSeconds !== null) {
      statusContent = (
        <Countdown seconds={countdownSeconds} label={countdownLabel} compact />
      );
    } else {
      statusContent = <span className="mt-0.5 block truncate text-xs">{formatMatchDateLabel(match, serverDate)}</span>;
    }
  }

  return (
    <article className="h-full">
      <TrackedLink
        href={`/match/${match.slug}`}
        eventName={watchable ? "watch_clicked" : "match_opened"}
        eventPayload={{ match_slug: match.slug, status: match.status, competition: match.competition.slug, playback_status: playbackStatus }}
        className={`match-card-link rounded-lg border bg-[var(--surface)] p-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${live ? "border-[var(--live)]/35 shadow-sm shadow-red-950/10" : "border-[var(--border)]"}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-normal text-[var(--muted)]">
            <CompetitionLogo competition={match.competition} />
            <span className="truncate">{match.competition.name}</span>
            {featured ? <span className="rounded-sm bg-[var(--brand-cyan)]/15 px-1.5 py-0.5 text-[10px] text-[var(--brand-blue)]">Featured</span> : null}
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]">
            {live ? `${match.minute ?? "Live"}'` : formatClockTime(match.kickoff_at)}
          </span>
          <StatusBadge status={match.status} />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamColumn team={match.home_team} score={match.home_score} showScore={live || finished} />
          <div className="grid min-w-12 place-items-center text-center">
            <span className="text-xs font-semibold uppercase text-[var(--muted)]">{live || finished ? "-" : "VS"}</span>
          </div>
          <TeamColumn team={match.away_team} score={match.away_score} showScore={live || finished} align="right" />
        </div>

        <div className="mt-4 flex min-h-12 items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
          <div className="min-w-0 text-sm text-[var(--muted)]">
            {statusContent}
            {match.channels.length > 0 ? <span className="mt-0.5 block truncate text-xs">TV: {match.channels.map((channel) => channel.name).join(", ")}</span> : null}
          </div>
          <span className={`inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-semibold ${watchable ? "bg-[var(--brand-blue)] text-white" : "border border-[var(--border)] text-[var(--foreground)]"}`}>
            {cta}
          </span>
        </div>
      </TrackedLink>
    </article>
  );
}

function TeamColumn({
  team,
  score,
  showScore,
  align = "left",
}: {
  team: Match["home_team"];
  score: number | null;
  showScore: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={`min-w-0 space-y-2 ${align === "right" ? "text-right" : ""}`}>
      <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <TeamMark team={team} size="sm" />
        <span className="min-w-0 truncate text-base font-semibold text-[var(--foreground)]">{team.name}</span>
      </div>
      {showScore ? <div className="text-2xl font-black tabular-nums text-[var(--foreground)]">{score ?? 0}</div> : null}
    </div>
  );
}