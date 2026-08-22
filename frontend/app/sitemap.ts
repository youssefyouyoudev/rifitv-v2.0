import type { MetadataRoute } from "next";
import { getAllMatchesForSitemap, getCompetitions } from "@/lib/api";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [matches, competitions] = await Promise.all([
    getAllMatchesForSitemap(500).catch(() => []),
    getCompetitions().catch(() => []),
  ]);
  const generatedAt = new Date();
  const teams = new Map<string, { slug: string; updatedAt?: string | null }>();
  matches.filter((match) => match.slug).forEach((match) => {
    teams.set(match.home_team.slug, { slug: match.home_team.slug, updatedAt: match.updated_at });
    teams.set(match.away_team.slug, { slug: match.away_team.slug, updatedAt: match.updated_at });
  });

  return [
    { url: absoluteUrl("/"), changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/matches"), changeFrequency: "hourly", priority: 0.8 },
    { url: absoluteUrl("/matches/today"), lastModified: generatedAt, changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/matches/tomorrow"), lastModified: generatedAt, changeFrequency: "hourly", priority: 0.8 },
    { url: absoluteUrl("/competitions"), changeFrequency: "daily", priority: 0.7 },
    ...competitions.map((competition) => ({
      url: absoluteUrl(`/competition/${competition.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...matches.filter((match) => match.slug).map((match) => ({
      url: absoluteUrl(`/match/${match.slug}`),
      lastModified: sitemapLastModified(match.updated_at ?? match.kickoff_at ?? match.scheduled_date, generatedAt),
      changeFrequency: match.status === "live" ? ("always" as const) : ("daily" as const),
      priority: match.status === "live" ? 0.9 : 0.6,
    })),
    ...Array.from(teams.values()).map((team) => ({
      url: absoluteUrl(`/team/${team.slug}`),
      lastModified: sitemapLastModified(team.updatedAt, generatedAt),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}

export function sitemapLastModified(value: string | null | undefined, now = new Date()): Date {
  if (! value) {
    return now;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime()) || parsed > now) {
    return now;
  }

  return parsed;
}
