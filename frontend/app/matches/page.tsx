import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { MatchSection } from "@/components/MatchSection";
import { getCompetitions, getMatches } from "@/lib/api";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Football Matches & Fixtures",
  description: "Browse RiFiTV football fixtures, upcoming matches, live match status and recent results for supported competitions.",
  alternates: { canonical: absoluteUrl("/matches") },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Football Matches & Fixtures",
    description: "Browse supported football fixtures, live match status and recent results.",
    url: absoluteUrl("/matches"),
  },
  twitter: { card: "summary_large_image", title: "Football Matches & Fixtures", description: "Browse supported football fixtures and live match status." },
};

const statusFilters = [
  { label: "All", value: undefined },
  { label: "Today", value: undefined },
  { label: "Upcoming", value: "scheduled" },
  { label: "Results", value: "finished" },
];

export default async function MatchesPage({ searchParams }: PageProps<"/matches">) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const competition = typeof params.competition === "string" ? params.competition : undefined;
  const [matches, competitions] = await Promise.all([getMatches(status, competition), getCompetitions()]);

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Matches</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Full RiFiTV fixture schedule</p>
          </div>
        </section>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => {
            const href = filter.value ? `/matches?status=${filter.value}${competition ? `&competition=${competition}` : ""}` : `/matches${competition ? `?competition=${competition}` : ""}`;
            const active = status === filter.value || (!status && !filter.value);

            return (
              <Link key={filter.label} href={href} className={`inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold ${active ? "bg-[var(--brand-blue)] text-white" : "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]"}`}>
                {filter.label}
              </Link>
            );
          })}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link href={status ? `/matches?status=${status}` : "/matches"} className={`inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-semibold ${!competition ? "bg-[var(--surface-muted)] text-[var(--foreground)]" : "border border-[var(--border)] text-[var(--muted)]"}`}>All competitions</Link>
          {competitions.map((item) => (
            <Link key={item.id} href={`/matches?${status ? `status=${status}&` : ""}competition=${item.slug}`} className={`inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-semibold ${competition === item.slug ? "bg-[var(--surface-muted)] text-[var(--foreground)]" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]"}`}>
              {item.short_name ?? item.name}
            </Link>
          ))}
        </div>
        <MatchSection title="Schedule" matches={matches} />
      </div>
    </AppShell>
  );
}
