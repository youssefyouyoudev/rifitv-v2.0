import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { CompetitionLogo } from "@/components/CompetitionLogo";
import { getCompetitions, getHome, getMatches } from "@/lib/api";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { formatClockTime } from "@/lib/time";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Football Competitions",
  description: "Explore the supported football competitions tracked by RiFiTV with fixtures and match information.",
  alternates: { canonical: absoluteUrl("/competitions") },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Football Competitions",
    description: "Supported football competitions with fixtures and match information.",
    url: absoluteUrl("/competitions"),
  },
  twitter: { card: "summary_large_image", title: "Football Competitions", description: "Supported football competitions on RiFiTV." },
};

export default async function CompetitionsPage() {
  const [competitions, home] = await Promise.all([getCompetitions(), getHome()]);
  const [todayMatches, upcomingMatches] = await Promise.all([
    getMatches(undefined, undefined, home.date),
    getMatches("scheduled"),
  ]);

  return (
    <AppShell>
      <section className="space-y-5">
        <div className="border-b border-[var(--border)] pb-5">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Competitions</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Today&apos;s fixtures and the next scheduled match in each competition.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competitions.map((competition) => {
            const matches = todayMatches.filter((match) => match.competition.id === competition.id);
            const next = matches.find((match) => match.status === "scheduled")
              ?? upcomingMatches.find((match) => match.competition.id === competition.id);

            return (
              <Link
                key={competition.id}
                href={`/competition/${competition.slug}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 outline-none transition hover:border-[var(--brand-cyan)] hover:bg-[var(--surface-elevated)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <span className="flex items-center gap-3">
                  <CompetitionLogo competition={competition} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-semibold text-[var(--foreground)]">{competition.name}</span>
                    <span className="block text-sm text-[var(--muted)]">{competition.country_code ?? competition.short_name ?? "International"}</span>
                  </span>
                </span>
                <span className="mt-5 flex items-end justify-between gap-3 border-t border-[var(--border)] pt-3">
                  <span className="text-sm text-[var(--muted)]">{matches.length} {matches.length === 1 ? "match" : "matches"} today</span>
                  <span className="text-right text-sm font-semibold text-[var(--foreground)]">{next ? `Next ${formatClockTime(next.kickoff_at)}` : "View fixtures"}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
