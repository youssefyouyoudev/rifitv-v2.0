import type { Metadata } from "next";
import { FootballScheduleView } from "@/components/FootballScheduleView";
import { getCompetitions, getMatches } from "@/lib/api";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Football Schedule & Fixtures",
  description: "Browse RiFiTV football fixtures, live match status, upcoming kickoffs and recent results.",
  alternates: { canonical: absoluteUrl("/football") },
  openGraph: { type: "website", siteName: SITE_NAME, title: "Football Schedule & Fixtures", description: "RiFiTV football fixtures and match status.", url: absoluteUrl("/football") },
  twitter: { card: "summary", title: "Football Schedule & Fixtures", description: "RiFiTV football fixtures and match status." },
};

export default async function FootballPage() {
  const [matches, competitions] = await Promise.all([getMatches(), getCompetitions()]);

  return <FootballScheduleView title="Football" description="Fixtures organized by football day, competition and kickoff time." matches={matches} competitions={competitions} />;
}
