import type { Metadata } from "next";
import { FootballScheduleView } from "@/components/FootballScheduleView";
import { getCompetitions, getHome, getMatches } from "@/lib/api";
import { addDays } from "@/lib/footballDate";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tomorrow's Football Matches",
  description: "Tomorrow's RiFiTV football matches with competition, teams, Casablanca kickoff times and broadcast status.",
  alternates: { canonical: absoluteUrl("/matches/tomorrow") },
  openGraph: { type: "website", siteName: SITE_NAME, title: "Tomorrow's Football Matches", description: "Tomorrow's football matches on RiFiTV.", url: absoluteUrl("/matches/tomorrow") },
  twitter: { card: "summary", title: "Tomorrow's Football Matches", description: "Tomorrow's football matches on RiFiTV." },
};

export default async function TomorrowMatchesPage() {
  const home = await getHome();
  const date = addDays(home.date, 1);
  const [matches, competitions] = await Promise.all([getMatches(undefined, undefined, date), getCompetitions()]);

  return <FootballScheduleView title="Tomorrow's matches" description={`${date} - ${home.timezone}`} matches={matches} competitions={competitions} serverDate={date} activeDate="tomorrow" canonicalPath="/matches/tomorrow" />;
}
