import { AppShell } from "@/components/AppShell";
import { AdPlacement } from "@/components/AdPlacement";
import { MatchSection } from "@/components/MatchSection";
import { getHome, getMatches } from "@/lib/api";
import { selectLaterToday, selectNextBroadcast } from "@/lib/liveSchedule";
import { formatMatchKickoff } from "@/lib/time";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const [matches, home] = await Promise.all([getMatches("live"), getHome()]);
  const nextMatch = selectNextBroadcast(home, matches);
  const remaining = selectLaterToday(home, matches, nextMatch);

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div>
            <p className="text-sm font-semibold uppercase text-[var(--live)]">RiFiTV Live</p>
            <h1 className="mt-1 text-3xl font-black text-[var(--foreground)]">Watch football as it happens</h1>
          </div>
          <span className="text-sm text-[var(--muted)]">{home.date_label} - {home.timezone}</span>
        </section>

        {matches.length > 0 ? <MatchSection title="Live now" matches={matches} serverDate={home.date} /> : (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Nothing live right now</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">The next broadcast and today&apos;s schedule are ready below.</p>
            {nextMatch ? (
              <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase text-[var(--muted)]">Next broadcast</p>
                  <h3 className="mt-1 text-xl font-bold text-[var(--foreground)]">{nextMatch.home_team.name} vs {nextMatch.away_team.name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{nextMatch.competition.name} - {formatMatchKickoff(nextMatch)}</p>
                </div>
                <Link href={`/match/${nextMatch.slug}`} className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--brand-blue)] px-4 text-sm font-semibold text-white">View match</Link>
              </div>
            ) : null}
          </section>
        )}
        <AdPlacement name="live_between_sections" />
        {remaining.length > 0 ? <MatchSection title="Later today" matches={remaining} serverDate={home.date} /> : null}
      </div>
    </AppShell>
  );
}
