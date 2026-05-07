import {
  parseISO,
  startOfISOWeek,
  endOfISOWeek,
  format,
  parse,
  startOfMonth,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { FamilyEvent } from "@/lib/validation";

const DEFAULT_TZ =
  process.env.DEFAULT_TIMEZONE?.trim() || "America/Los_Angeles";

export type GroupMode = "day" | "week" | "month";

export interface DateRangeFilter {
  start: Date;
  end: Date;
}

export function parseLocalDay(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return toZonedTime(utcNoon, DEFAULT_TZ);
}

export function eventInRange(ev: FamilyEvent, range: DateRangeFilter): boolean {
  const day = parseLocalDay(ev.date);
  return day >= range.start && day <= range.end;
}

export function groupKeyForEvent(
  ev: FamilyEvent,
  mode: GroupMode,
): string {
  const day = parseLocalDay(ev.date);
  if (mode === "day") {
    return format(day, "yyyy-MM-dd");
  }
  if (mode === "week") {
    const ws = startOfISOWeek(day);
    const we = endOfISOWeek(day);
    return `${format(ws, "yyyy-MM-dd")}_${format(we, "yyyy-MM-dd")}`;
  }
  return format(startOfMonth(day), "yyyy-MM");
}

export function groupLabel(key: string, mode: GroupMode): string {
  if (mode === "day") {
    const d = parseLocalDay(key);
    return format(d, "EEEE, MMM d, yyyy");
  }
  if (mode === "week") {
    const [a, b] = key.split("_");
    return `Week of ${format(parseISO(a), "MMM d")} – ${format(parseISO(b), "MMM d, yyyy")}`;
  }
  const d = parse(key, "yyyy-MM", startOfMonth(new Date()));
  return format(d, "MMMM yyyy");
}

export function sortEventsByDateTime(a: FamilyEvent, b: FamilyEvent): number {
  const da = `${a.date} ${a.startTime ?? ""}`;
  const db = `${b.date} ${b.startTime ?? ""}`;
  return da.localeCompare(db);
}
