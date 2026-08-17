import type { Metadata } from "next";
import { FootballScheduleView } from "@/components/FootballScheduleView";
import { getCompetitions, getHome, getMatches } from "@/lib/api";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today's Football Matches",
  description: "Today's RiFiTV football matches with competition, teams, Casablanca kickoff times and live status.",
  alternates: { canonical: absoluteUrl("/matches/today") },
  openGraph: { type: "website", siteName: SITE_NAME, title: "Today's Football Matches", description: "Today's football matches on RiFiTV.", url: absoluteUrl("/matches/today") },
  twitter: { card: "summary", title: "Today's Football Matches", description: "Today's football matches on RiFiTV." },
};

export default async function TodayMatchesPage() {
  const home = await getHome();
  const date = home.date;
  const [matches, competitions] = await Promise.all([getMatches(undefined, undefined, date), getCompetitions()]);

  return <FootballScheduleView title="Today's matches" description={`${date} - ${home.timezone}`} matches={matches} competitions={competitions} serverDate={date} canonicalPath="/matches/today" />;
}
