import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getHome } from "@/lib/api";
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

        <HomeSignal match={live[0] ?? scheduled[0] ?? home.next_match} live={live.length > 0} />

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

function HomeSignal({ match, live }: { match: Match | null | undefined; live: boolean }) {
  if (!match) {
    return <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">No upcoming broadcast is available yet. Browse the full schedule for the latest fixtures.</section>;
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--live)]/25 bg-[var(--surface)] p-5">
      <div>
        <p className={`text-xs font-semibold uppercase ${live ? "text-[var(--live)]" : "text-[var(--muted)]"}`}>{live ? "Live now" : "Next match"}</p>
        <h2 className="mt-1 text-xl font-bold text-[var(--foreground)]">{match.home_team.name} vs {match.away_team.name}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{match.competition.name} - {match.status_label ?? "Scheduled"}</p>
      </div>
      <Link href={`/match/${match.slug}`} className="inline-flex min-h-10 items-center rounded-md bg-[var(--brand-blue)] px-4 text-sm font-semibold text-white">{live ? "Watch live" : "View match"}</Link>
    </section>
  );
}

function NoMatchesToday({ nextMatch, serverDate }: { nextMatch: Match | null; serverDate: string }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
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
