import { addDays, localDateKey } from "./footballDate";

const displayLocale = "en-GB";
const displayTimeZone = "Africa/Casablanca";

const displayFormatter = new Intl.DateTimeFormat(displayLocale, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: displayTimeZone,
});

const timeFormatter = new Intl.DateTimeFormat(displayLocale, {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: displayTimeZone,
});

const dateFormatter = new Intl.DateTimeFormat(displayLocale, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: displayTimeZone,
});

type MatchTime = {
  kickoff_at: string | null;
  scheduled_date: string | null;
  kickoff_precision?: "confirmed" | "date_only" | "provisional" | "tbc";
};

export function formatKickoff(value: string): string {
  return displayFormatter.format(new Date(value));
}

export function formatMatchKickoff(match: MatchTime): string {
  if (match.kickoff_at && match.kickoff_precision === "confirmed") {
    return formatKickoff(match.kickoff_at);
  }

  if (match.scheduled_date) {
    const date = dateFormatter.format(new Date(`${match.scheduled_date}T12:00:00Z`));
    return `${date} - Time TBC`;
  }

  return "Date TBC";
}

export function formatMatchDateLabel(match: MatchTime, serverDate?: string): string {
  const time = match.kickoff_at ? timeFormatter.format(new Date(match.kickoff_at)) : "Time TBC";
  const source = match.kickoff_at ?? (match.scheduled_date ? `${match.scheduled_date}T12:00:00Z` : null);

  if (!source) {
    return "Date TBC";
  }

  const matchDate = dateKey(new Date(source));
  const today = serverDate ?? dateKey(new Date());
  const tomorrow = addDays(today, 1);
  const prefix = matchDate === today ? "Today" : matchDate === tomorrow ? "Tomorrow" : shortDateFormatter.format(new Date(source));

  return `${prefix} - ${time}`;
}

export function formatClockTime(value: string | null): string {
  return value ? timeFormatter.format(new Date(value)) : "Time TBC";
}

export function formatCountdown(totalSeconds: number | null): string {
  if (totalSeconds === null) {
    return "Time TBC";
  }

  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
  }

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function isLiveStatus(status: string): boolean {
  return status === "live" || status === "halftime";
}

const shortDateFormatter = new Intl.DateTimeFormat(displayLocale, {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: displayTimeZone,
});

function dateKey(date: Date): string { return localDateKey(date); }
