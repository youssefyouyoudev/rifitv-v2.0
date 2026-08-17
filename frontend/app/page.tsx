import Link from "next/link";
import type { Metadata } from "next";
import { AdPlacement } from "@/components/AdPlacement";
import { AppShell } from "@/components/AppShell";
import { CompetitionLogo } from "@/components/CompetitionLogo";
import { Countdown } from "@/components/Countdown";
import { MatchCard } from "@/components/MatchCard";
import { TeamMark } from "@/components/TeamMark";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getHome } from "@/lib/api";
import { formatClockTime, formatMatchDateLabel } from "@/lib/time";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today's Football Matches & TV Channels in Morocco",
  description: "See today's football matches, Morocco kickoff times, live scores and verified TV channel information for LaLiga, Premier League, Champions League and MENA fixtures.",
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Today's Football Matches & TV Channels in Morocco | RiFiTV",
    description: "Today's football fixtures, Morocco kickoff times, live status and verified TV channel information.",
    url: absoluteUrl("/"),
  },
  twitter: {
    card: "summary_large_image",
    title: "Today's Football Matches & TV Channels in Morocco | RiFiTV",
    description: "Today's football fixtures, Morocco kickoff times, live status and verified TV channel information.",
  },
};

export default async function Home() {
  const home = await getHome();
  const live = home.matches.filter((match) => match.status === "live" || match.status === "halftime");
  const scheduled = home.matches.filter((match) => match.status === "scheduled");
  const finished = home.matches.filter((match) => match.status === "finished");
  const other = home.matches.filter((match) => !["live", "halftime", "scheduled", "finished"].includes(match.status));
  const grouped = [...live, ...scheduled, ...finished, ...other];

  return (
    <AppShell>
      <div className="space-y-5">
        {home.announcements.map((announcement) => (
          <div key={announcement.id} className="rounded-lg border border-[var(--live)]/20 bg-[var(--live)]/10 p-3 text-sm text-[var(--foreground)]">
            <strong>{announcement.title}</strong>
            <span className="ml-2 text-[var(--muted)]">{announcement.message}</span>
          </div>
        ))}

        <section className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-normal text-[var(--foreground)] sm:text-3xl">Today</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{home.date_label}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold text-[var(--foreground)]">{home.today_count} {home.today_count === 1 ? "match" : "matches"}</span>
            <span className="inline-flex items-center gap-2 text-[var(--muted)]">
              <span className="h-2 w-2 rounded-full bg-[var(--live)]" />
              {home.live_count} live
            </span>
          </div>
        </section>

        <HomeSignal match={live[0] ?? scheduled[0] ?? home.next_match} live={live.length > 0} serverDate={home.date} />
        <AdPlacement name="homepage_between_sections" />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <span className="inline-flex h-9 shrink-0 items-center rounded-md bg-[var(--brand-blue)] px-3 text-sm font-semibold text-white">All</span>
          {home.competitions.map((competition) => (
            <Link key={competition.id} href={`/matches?competition=${competition.slug}`} className="inline-flex h-9 shrink-0 items-center rounded-md border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]">
              {competition.short_name ?? competition.name}
            </Link>
          ))}
        </div>

        {grouped.length > 0 ? (
          <section className="space-y-3">
            {live.length > 0 ? <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase text-[var(--live)]"><span className="h-2 w-2 rounded-full bg-[var(--live)]" />Live</p> : null}
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {grouped.map((match) => (
                <MatchCard key={match.id} match={match} serverDate={home.date} featured={match.featured} />
              ))}
            </div>
          </section>
        ) : (
          <NoMatchesToday nextMatch={home.next_match} serverDate={home.date} />
        )}
      </div>
    </AppShell>
  );
}

function HomeSignal({ match, live, serverDate }: { match: Match | null | undefined; live: boolean; serverDate: string }) {
  if (!match) {
    return <section className="border-y border-[var(--border)] py-6 text-sm text-[var(--muted)]">No upcoming broadcast is available yet. Browse the full schedule for the latest fixtures.</section>;
  }

  const countdown = match.playback_window.status === "locked" || match.playback_window.status === "opening_soon"
    ? match.playback_window.seconds_until_open
    : match.playback_window.seconds_until_kickoff;

  return (
    <section className="grid gap-5 border-y border-[var(--live)]/25 bg-[var(--surface)]/50 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" aria-labelledby="home-signal-title">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--muted)]">
          <CompetitionLogo competition={match.competition} />
          <span className="truncate">{match.competition.name}</span>
        </div>
        <p className={`mt-3 text-xs font-semibold uppercase ${live ? "text-[var(--live)]" : "text-[var(--brand-blue)]"}`}>{live ? "Live now" : "Next match"}</p>
        <div className="mt-3 grid max-w-2xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5">
          <SignalTeam team={match.home_team} />
          <div className="text-center">
            <span className="block text-xl font-black tabular-nums text-[var(--foreground)]">{live && match.home_score !== null ? `${match.home_score}-${match.away_score ?? 0}` : formatClockTime(match.kickoff_at)}</span>
            <span className="mt-1 block text-xs font-semibold uppercase text-[var(--muted)]">{live ? match.status_label ?? "Live" : "Morocco time"}</span>
          </div>
          <SignalTeam team={match.away_team} align="right" />
        </div>
      </div>
      <div className="flex min-w-52 flex-col items-start gap-3 lg:items-end">
        <div>
          <h2 id="home-signal-title" className="text-sm font-semibold text-[var(--foreground)]">{match.home_team.name} vs {match.away_team.name}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{formatMatchDateLabel(match, serverDate)}</p>
          {match.channels.length > 0 ? <p className="mt-1 max-w-xs truncate text-xs text-[var(--muted)]">TV: {match.channels.map((channel) => channel.name).join(", ")}</p> : null}
        </div>
        {!live && countdown !== null ? <Countdown seconds={countdown} label={match.playback_window.status === "locked" ? "Broadcast opens in" : "Starts in"} compact /> : null}
        <Link href={`/match/${match.slug}`} className="inline-flex min-h-11 items-center rounded-md bg-[var(--brand-blue)] px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">{live ? "Watch live" : "View match"}</Link>
      </div>
    </section>
  );
}

function SignalTeam({ team, align = "left" }: { team: Match["home_team"]; align?: "left" | "right" }) {
  return (
    <div className={`min-w-0 text-center ${align === "right" ? "sm:text-right" : "sm:text-left"}`}>
      <div className={`flex flex-col items-center gap-2 sm:flex-row ${align === "right" ? "sm:flex-row-reverse" : ""}`}>
        <TeamMark team={team} size="lg" />
        <span className="min-w-0 break-words text-xs font-bold leading-tight text-[var(--foreground)] sm:truncate sm:text-base">{team.name}</span>
      </div>
    </div>
  );
}

function NoMatchesToday({ nextMatch, serverDate }: { nextMatch: Match | null; serverDate: string }) {
  return (
    <section className="border-y border-[var(--border)] py-6">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">No matches today</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">No RiFiTV fixtures are scheduled for today.</p>
      {nextMatch ? (
        <div className="mt-5 max-w-xl">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">Next match</p>
          <MatchCard match={nextMatch} serverDate={serverDate} />
        </div>
      ) : null}
      <Link href="/matches" className="mt-5 inline-flex h-10 items-center rounded-md bg-[var(--brand-blue)] px-4 text-sm font-semibold text-white">
        View Matches
      </Link>
    </section>
  );
}
