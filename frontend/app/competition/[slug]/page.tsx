import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { MatchSection } from "@/components/MatchSection";
import { getCompetition } from "@/lib/api";
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

  return (
    <AppShell>
      <MatchSection title={competition.name} matches={competition.matches ?? []} />
    </AppShell>
  );
}
