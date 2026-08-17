import Link from "next/link";
import { AppShell } from "./AppShell";
import { MatchCard } from "./MatchCard";
import { groupMatchesByDate } from "@/lib/matches";
import type { Competition, Match } from "@/lib/types";

export function FootballScheduleView({
  title,
  description,
  matches,
  competitions,
  serverDate,
}: {
  title: string;
  description: string;
  matches: Match[];
  competitions: Competition[];
  serverDate?: string;
}) {
  const groups = groupMatchesByDate(matches, serverDate);

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
          </div>
          <Link href="/matches" className="inline-flex min-h-10 items-center rounded-md border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]">
            Full schedule
          </Link>
        </section>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link href="/football/today" className="inline-flex h-9 shrink-0 items-center rounded-md bg-[var(--brand-blue)] px-3 text-sm font-semibold text-white">Today</Link>
          <Link href="/matches?status=live" className="inline-flex h-9 shrink-0 items-center rounded-md border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)]">Live</Link>
          <Link href="/matches?status=scheduled" className="inline-flex h-9 shrink-0 items-center rounded-md border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)]">Upcoming</Link>
          <Link href="/matches?status=finished" className="inline-flex h-9 shrink-0 items-center rounded-md border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)]">Results</Link>
          {competitions.slice(0, 6).map((competition) => (
            <Link key={competition.id} href={`/matches?competition=${competition.slug}`} className="inline-flex h-9 shrink-0 items-center rounded-md border border-[var(--border)] px-3 text-sm font-semibold text-[var(--muted)]">
              {competition.short_name ?? competition.name}
            </Link>
          ))}
        </div>
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} className="space-y-4">
              <h2 className="border-b border-[var(--border)] pb-2 text-xl font-semibold text-[var(--foreground)]">{group.title}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.matches.map((match) => <MatchCard key={match.id} match={match} serverDate={serverDate} />)}
              </div>
            </section>
          ))}
          {groups.length === 0 ? <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">No matches scheduled for this date.</p> : null}
        </div>
      </div>
    </AppShell>
  );
}
