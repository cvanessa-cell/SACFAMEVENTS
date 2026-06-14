import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DEFAULT_EVENT_TIMEZONE = "America/Los_Angeles";

const EXPLICIT_OFFSET_RE = /[+-]\d{2}:\d{2}$/;
const UTC_SUFFIX_RE = /[zZ]$/;

/**
 * Reinterpret UTC date components as a local wall-clock time in `timeZone`.
 * Fixes AI output like `2026-06-13T11:00:00Z` when 11:00 meant Pacific local.
 */
export function reinterpretUtcComponentsAsLocal(
  date: Date,
  timeZone = DEFAULT_EVENT_TIMEZONE,
): Date {
  const ymd = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  const hms = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
  return fromZonedTime(`${ymd}T${hms}`, timeZone);
}

/** Heuristic: stored instant shows early AM Pacific but UTC hour looks like event local time. */
export function isLikelyWallClockStoredAsUtc(
  date: Date,
  timeZone = DEFAULT_EVENT_TIMEZONE,
): boolean {
  const pacificHour = Number(formatInTimeZone(date, timeZone, "H"));
  const utcHour = date.getUTCHours();
  return pacificHour < 7 && utcHour >= 8 && utcHour <= 22;
}

/** Fix end times that still look mislabeled when end is before start in local time. */
export function normalizeEventEndDatetime(
  start: Date | null | undefined,
  end: Date | null | undefined,
  timeZone = DEFAULT_EVENT_TIMEZONE,
): Date | null {
  if (!end || Number.isNaN(end.getTime())) return null;
  const normalizedEnd = normalizeStoredEventDatetime(end, timeZone);
  if (!start || !normalizedEnd) return normalizedEnd;
  if (normalizedEnd > start) return normalizedEnd;
  const utcHour = end.getUTCHours();
  if (utcHour >= 12 && utcHour <= 22) {
    return reinterpretUtcComponentsAsLocal(end, timeZone);
  }
  return normalizedEnd;
}

/**
 * Parse an OpenAI / source extraction datetime into a UTC instant for Postgres.
 * - `-07:00` / `+00:00` offsets are trusted as-is
 * - Bare `Z` suffix is treated as mislabeled local wall clock (common model mistake)
 * - Naive `YYYY-MM-DDTHH:mm:ss` is interpreted in `timeZone`
 */
export function parseEventDatetime(
  value: string | null | undefined,
  timeZone = DEFAULT_EVENT_TIMEZONE,
): Date | null {
  if (!value?.trim()) return null;
  const s = value.trim();

  if (EXPLICIT_OFFSET_RE.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (UTC_SUFFIX_RE.test(s)) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return reinterpretUtcComponentsAsLocal(d, timeZone);
  }

  const naive = s.length === 10 ? `${s}T00:00:00` : s;
  try {
    const d = fromZonedTime(naive, timeZone);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** Normalize a stored Date that may have been saved with wall-clock-as-UTC mistake. */
export function normalizeStoredEventDatetime(
  date: Date | null | undefined,
  timeZone = DEFAULT_EVENT_TIMEZONE,
): Date | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  if (!isLikelyWallClockStoredAsUtc(date, timeZone)) return date;
  return reinterpretUtcComponentsAsLocal(date, timeZone);
}

export function startOfTodayInTimeZone(timeZone = DEFAULT_EVENT_TIMEZONE): Date {
  const ymd = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
  return fromZonedTime(`${ymd}T00:00:00`, timeZone);
}
