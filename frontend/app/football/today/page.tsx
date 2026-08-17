import type { Metadata } from "next";
import { FootballScheduleView } from "@/components/FootballScheduleView";
import { getHome } from "@/lib/api";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today's Football Matches",
  description: "Today's RiFiTV football matches with competition, teams, kickoff times and live status.",
  alternates: { canonical: absoluteUrl("/football/today") },
  openGraph: { type: "website", siteName: SITE_NAME, title: "Today's Football Matches", description: "Today's football matches on RiFiTV.", url: absoluteUrl("/football/today") },
  twitter: { card: "summary", title: "Today's Football Matches", description: "Today's football matches on RiFiTV." },
};

export default async function FootballTodayPage() {
  const home = await getHome();

  return <FootballScheduleView title="Today's matches" description={`${home.date_label} - Africa/Casablanca`} matches={home.matches} competitions={home.competitions} serverDate={home.date} />;
}
