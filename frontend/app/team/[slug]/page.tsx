import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { MatchSection } from "@/components/MatchSection";
import { JsonLd } from "@/components/JsonLd";
import { TeamMark } from "@/components/TeamMark";
import { getTeam } from "@/lib/api";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/team/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const payload = await getTeam(slug);
  const title = `${payload.team.name} Matches, Fixtures & Results`;
  const description = `Upcoming fixtures, live match status and recent results for ${payload.team.name} on RiFiTV.`;
  const url = absoluteUrl(`/team/${payload.team.slug}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: SITE_NAME, title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TeamPage({ params }: PageProps<"/team/[slug]">) {
  const { slug } = await params;
  const payload = await getTeam(slug);

  return (
    <AppShell>
      <JsonLd id={`team-breadcrumb-${payload.team.id}`} data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: payload.team.name, item: absoluteUrl(`/team/${payload.team.slug}`) },
        ],
      }} />
      <JsonLd id={`team-${payload.team.id}`} data={{ "@context": "https://schema.org", "@type": "SportsTeam", name: payload.team.name, url: absoluteUrl(`/team/${payload.team.slug}`) }} />
      <div className="space-y-6">
        <section className="flex items-center gap-4 rounded-lg border border-white/10 bg-neutral-900 p-5">
          <TeamMark team={payload.team} size="lg" />
          <div>
            <h1 className="text-2xl font-bold text-white">{payload.team.name}</h1>
            <p className="text-sm text-neutral-400">{payload.team.country_code ?? "Featured club"}</p>
          </div>
        </section>
        <MatchSection title="Live" matches={payload.live} />
        <MatchSection title="Upcoming" matches={payload.upcoming} />
        <MatchSection title="Recent Results" matches={payload.recent_results} />
      </div>
    </AppShell>
  );
}
