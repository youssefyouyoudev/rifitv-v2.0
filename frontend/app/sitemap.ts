import type { MetadataRoute } from "next";
import { getAllMatchesForSitemap, getCompetitions } from "@/lib/api";
import { addDays, localTodayDate } from "@/lib/footballDate";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [matches, competitions] = await Promise.all([
    getAllMatchesForSitemap().catch(() => []),
    getCompetitions().catch(() => []),
  ]);
  const today = localTodayDate();
  const tomorrow = addDays(today, 1);
  const teams = new Map<string, { slug: string; updatedAt?: string | null }>();
  matches.forEach((match) => {
    teams.set(match.home_team.slug, { slug: match.home_team.slug, updatedAt: match.updated_at });
    teams.set(match.away_team.slug, { slug: match.away_team.slug, updatedAt: match.updated_at });
  });

  return [
    { url: absoluteUrl("/"), changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/matches"), changeFrequency: "hourly", priority: 0.8 },
    { url: absoluteUrl("/matches/today"), lastModified: new Date(`${today}T12:00:00Z`), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/matches/tomorrow"), lastModified: new Date(`${tomorrow}T12:00:00Z`), changeFrequency: "hourly", priority: 0.8 },
    { url: absoluteUrl("/competitions"), changeFrequency: "daily", priority: 0.7 },
    ...competitions.map((competition) => ({
      url: absoluteUrl(`/competition/${competition.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...matches.map((match) => ({
      url: absoluteUrl(`/match/${match.slug}`),
      lastModified: new Date(match.kickoff_at ?? `${match.scheduled_date ?? new Date().toISOString().slice(0, 10)}T12:00:00Z`),
      changeFrequency: match.status === "live" ? ("always" as const) : ("daily" as const),
      priority: match.status === "live" ? 0.9 : 0.6,
    })),
    ...Array.from(teams.values()).map((team) => ({
      url: absoluteUrl(`/team/${team.slug}`),
      lastModified: team.updatedAt ? new Date(team.updatedAt) : undefined,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
