import type { Metadata } from "next";
import { Fragment } from "react";
import { AdPlacement } from "@/components/AdPlacement";
import { AppShell } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { getCompetitions, getMatches } from "@/lib/api";
import { groupMatchesByDate } from "@/lib/matches";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps<"/matches">): Promise<Metadata> {
  const params = await searchParams;
  const filtered = Object.keys(params).length > 0;
  const title = "Football Matches & Fixtures";
  const description = "Browse RiFiTV football fixtures, upcoming matches, live match status and recent results for supported competitions.";

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl("/matches") },
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", siteName: SITE_NAME, title, description, url: absoluteUrl("/matches") },
    twitter: { card: "summary", title, description },
  };
}

const statusFilters = [
  { label: "All", value: undefined, href: undefined },
  { label: "Today", value: undefined, href: "/matches/today" },
  { label: "Upcoming", value: "scheduled", href: undefined },
  { label: "Results", value: "finished", href: undefined },
];

export default async function MatchesPage({ searchParams }: PageProps<"/matches">) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const competition = typeof params.competition === "string" ? params.competition : undefined;
  const date = typeof params.date === "string" ? params.date : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const territory = typeof params.territory === "string" ? params.territory : undefined;
  const [matches, competitions] = await Promise.all([getMatches(status, competition, date, search, territory), getCompetitions()]);
  const groups = groupMatchesByDate(matches);

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Matches</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Full RiFiTV fixture schedule by date, kickoff time and competition</p>
          </div>
        </section>
        <form className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-[180px_1fr_160px_auto]">
          <input type="date" name="date" defaultValue={date ?? ""} className="h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
          <input type="search" name="search" defaultValue={search ?? ""} placeholder="Search team, competition or slug" className="h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]" />
          <select name="territory" defaultValue={territory ?? ""} className="h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]">
            <option value="">All TV regions</option>
            <option value="MENA">MENA</option>
            <option value="EU">Europe</option>
            <option value="US">United States</option>
          </select>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {competition ? <input type="hidden" name="competition" value={competition} /> : null}
          <button className="h-10 rounded-md bg-[var(--brand-blue)] px-4 text-sm font-semibold text-white">Filter</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => {
            if (filter.href) {
              return (
                <Link key={filter.label} href={filter.href} className="inline-flex h-9 items-center rounded-md border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]">
                  {filter.label}
                </Link>
              );
            }

            const nextParams = new URLSearchParams();
            if (filter.value) nextParams.set("status", filter.value);
            if (competition) nextParams.set("competition", competition);
            if (date) nextParams.set("date", date);
            if (search) nextParams.set("search", search);
            if (territory) nextParams.set("territory", territory);
            const query = nextParams.toString();
            const href = `/matches${query ? `?${query}` : ""}`;
            const active = status === filter.value || (!status && !filter.value);

            return (
              <Link key={filter.label} href={href} className={`inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold ${active ? "bg-[var(--brand-blue)] text-white" : "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]"}`}>
                {filter.label}
              </Link>
            );
          })}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link href={matchesHref({ status, date, search, territory })} className={`inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-semibold ${!competition ? "bg-[var(--surface-muted)] text-[var(--foreground)]" : "border border-[var(--border)] text-[var(--muted)]"}`}>All competitions</Link>
          {competitions.map((item) => (
            <Link key={item.id} href={matchesHref({ status, date, search, territory, competition: item.slug })} className={`inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-semibold ${competition === item.slug ? "bg-[var(--surface-muted)] text-[var(--foreground)]" : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]"}`}>
              {item.short_name ?? item.name}
            </Link>
          ))}
        </div>
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} className="space-y-4">
              <h2 className="border-b border-[var(--border)] pb-2 text-xl font-semibold text-[var(--foreground)]">{group.title}</h2>
              <div className="space-y-5">
                {group.competitions.map((competitionGroup) => (
                  <div key={competitionGroup.key} className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase text-[var(--muted)]">{competitionGroup.title}</h3>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {competitionGroup.matches.map((match, index) => (
                        <Fragment key={match.id}>
                          <MatchCard match={match} />
                          {(index + 1) % 5 === 0 ? <div className="sm:col-span-2 xl:col-span-3"><AdPlacement name="matches_in_feed" /></div> : null}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {groups.length === 0 ? <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">No matches found for this view.</p> : null}
        </div>
      </div>
    </AppShell>
  );
}

function matchesHref(values: { status?: string; competition?: string; date?: string; search?: string; territory?: string }): string {
  const params = new URLSearchParams();
  if (values.status) params.set("status", values.status);
  if (values.competition) params.set("competition", values.competition);
  if (values.date) params.set("date", values.date);
  if (values.search) params.set("search", values.search);
  if (values.territory) params.set("territory", values.territory);
  const query = params.toString();

  return `/matches${query ? `?${query}` : ""}`;
}
