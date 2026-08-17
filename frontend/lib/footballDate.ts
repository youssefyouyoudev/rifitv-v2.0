export const RI_FI_TV_TIMEZONE = "Africa/Casablanca";
export const FOOTBALL_DAY_START_HOUR = 6;

const dateTimePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  timeZone: RI_FI_TV_TIMEZONE,
});

export const adminDateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: RI_FI_TV_TIMEZONE,
});

export const adminTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: RI_FI_TV_TIMEZONE,
});

export const adminShortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: RI_FI_TV_TIMEZONE,
});

export function formatAdminDateChip(value: string): string {
  return adminShortDateFormatter.format(new Date(`${value}T12:00:00Z`)).toUpperCase();
}

export function localTodayDate(): string {
  return localDateKey(new Date());
}

export function localDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = dateTimePartsFormatter.formatToParts(date);
  const year = partValue(parts, "year");
  const month = partValue(parts, "month");
  const day = partValue(parts, "day");
  const hour = Number(partValue(parts, "hour"));
  const localDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));

  if (hour < FOOTBALL_DAY_START_HOUR) {
    localDate.setUTCDate(localDate.getUTCDate() - 1);
  }

  return localDate.toISOString().slice(0, 10);
}

export function addDays(date: string, amount: number): string {
  const parsed = new Date(`${date}T12:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return localTodayDate();
  }

  parsed.setUTCDate(parsed.getUTCDate() + amount);

  return parsed.toISOString().slice(0, 10);
}

export function localDateTimeInput(): string {
  const parts = dateTimePartsFormatter.formatToParts(new Date());
  const year = partValue(parts, "year");
  const month = partValue(parts, "month");
  const day = partValue(parts, "day");
  const hour = partValue(parts, "hour");
  const minute = new Intl.DateTimeFormat("en-GB", {
    minute: "2-digit",
    timeZone: RI_FI_TV_TIMEZONE,
  }).format(new Date());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "0";
}
