import type { Match, MatchStatus } from "./types";

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  halftime: "Halftime",
  finished: "Finished",
  postponed: "Postponed",
  cancelled: "Cancelled",
};

const statusRank: Record<MatchStatus, number> = {
  live: 0,
  halftime: 1,
  scheduled: 2,
  finished: 3,
  postponed: 4,
  cancelled: 5,
};

const displayTimeZone = "Africa/Casablanca";
const headingFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: displayTimeZone,
});

export type MatchDateGroup = {
  key: string;
  title: string;
  matches: Match[];
  competitions: Array<{ key: string; title: string; matches: Match[] }>;
};

export function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const rank = (a.status_rank ?? statusRank[a.status]) - (b.status_rank ?? statusRank[b.status]);
    if (rank !== 0) return rank;

    const aTime = matchTimestamp(a);
    const bTime = matchTimestamp(b);
    if (a.status === "finished" && b.status === "finished") {
      return bTime - aTime;
    }

    return aTime - bTime;
  });
}

export function groupMatchesByDate(matches: Match[], serverDate?: string): MatchDateGroup[] {
  const groups = new Map<string, Match[]>();

  for (const match of sortMatches(matches)) {
    const key = matchDateKey(match);
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }

  return [...groups.entries()].map(([key, items]) => ({
    key,
    title: dateHeading(key, serverDate),
    matches: items,
    competitions: groupByCompetition(items),
  }));
}

export function matchDateKey(match: Pick<Match, "kickoff_at" | "scheduled_date">): string {
  if (match.kickoff_at) return localDateKey(new Date(match.kickoff_at));
  return match.scheduled_date ?? "tbc";
}

export function dateHeading(dateKey: string, serverDate?: string): string {
  if (dateKey === "tbc") return "Date TBC";
  if (serverDate && dateKey === serverDate) return `Today - ${headingFormatter.format(new Date(`${dateKey}T12:00:00Z`))}`;
  if (serverDate && dateKey === addLocalDays(serverDate, 1)) return `Tomorrow - ${headingFormatter.format(new Date(`${dateKey}T12:00:00Z`))}`;

  return headingFormatter.format(new Date(`${dateKey}T12:00:00Z`));
}

export function addLocalDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function groupByCompetition(matches: Match[]): MatchDateGroup["competitions"] {
  const groups = new Map<string, Match[]>();

  for (const match of matches) {
    const key = match.competition.slug;
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }

  return [...groups.entries()].map(([key, items]) => ({
    key,
    title: items[0]?.competition.name ?? key,
    matches: items,
  }));
}

function matchTimestamp(match: Match): number {
  const source = match.kickoff_at ?? (match.scheduled_date ? `${match.scheduled_date}T12:00:00Z` : null);
  return source ? new Date(source).getTime() : Number.MAX_SAFE_INTEGER;
}

function localDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: displayTimeZone,
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}
