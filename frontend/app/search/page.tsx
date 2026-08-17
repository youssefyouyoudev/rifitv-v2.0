import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { MatchSection } from "@/components/MatchSection";
import { SearchForm } from "@/components/SearchForm";
import { searchPublic } from "@/lib/api";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  description: "Search RiFiTV teams, matches and competitions.",
  alternates: { canonical: absoluteUrl("/search") },
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const results = query.length >= 2 ? await searchPublic(query) : null;

  return (
    <AppShell>
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Search RiFiTV</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Find teams, matches and supported competitions.</p>
        </div>
        <SearchForm query={query} />
        {query.length > 0 && query.length < 2 ? <p className="text-sm text-[var(--muted)]">Type at least two characters.</p> : null}
        {results ? (
          <div className="space-y-8">
            <ResultGroup title="Teams">
              {results.teams.map((team) => (
                <Link key={team.id} href={`/team/${team.slug}`} className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)] outline-none hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                  {team.name}
                </Link>
              ))}
            </ResultGroup>
            <MatchSection title="Matches" matches={results.matches} />
            <ResultGroup title="Competitions">
              {results.competitions.map((competition) => (
                <Link key={competition.id} href={`/competition/${competition.slug}`} className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)] outline-none hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                  {competition.name}
                </Link>
              ))}
            </ResultGroup>
            {results.teams.length + results.matches.length + results.competitions.length === 0 ? <p className="text-sm text-[var(--muted)]">No public results found.</p> : null}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

function ResultGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
