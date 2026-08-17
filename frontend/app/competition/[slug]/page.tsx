import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { getCompetition } from "@/lib/api";
import { groupMatchesByDate, sortMatches } from "@/lib/matches";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/competition/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  const title = `${competition.name} Matches & Fixtures`;
  const description = `Supported ${competition.name} fixtures, match status and results on RiFiTV.`;
  const url = absoluteUrl(`/competition/${competition.slug}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: SITE_NAME, title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CompetitionPage({ params }: PageProps<"/competition/[slug]">) {
  const { slug } = await params;
  const competition = await getCompetition(slug);
  const matches = competition.matches ?? [];
  const upcomingGroups = groupMatchesByDate(sortMatches(matches.filter((match) => match.status !== "finished")));
  const resultGroups = groupMatchesByDate(sortMatches(matches.filter((match) => match.status === "finished")));

  return (
    <AppShell>
      <div className="space-y-8">
        <section className="border-b border-[var(--border)] pb-5">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{competition.name}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Fixtures and results organized by match date.</p>
        </section>
        <CompetitionSchedule title="Upcoming" groups={upcomingGroups} />
        <CompetitionSchedule title="Results" groups={resultGroups} />
      </div>
    </AppShell>
  );
}

function CompetitionSchedule({ title, groups }: { title: string; groups: ReturnType<typeof groupMatchesByDate> }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
      {groups.map((group) => (
        <div key={group.key} className="space-y-3">
          <h3 className="border-b border-[var(--border)] pb-2 text-sm font-semibold uppercase text-[var(--muted)]">{group.title}</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.matches.map((match) => <MatchCard key={match.id} match={match} />)}
          </div>
        </div>
      ))}
      {groups.length === 0 ? <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">No matches in this section.</p> : null}
    </section>
  );
}
