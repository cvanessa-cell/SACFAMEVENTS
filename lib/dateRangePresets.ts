import {
  addDays,
  endOfDay,
  startOfDay,
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  startOfMonth,
  endOfMonth,
} from "date-fns";

export type PeriodPreset =
  | "today"
  | "tomorrow"
  | "this_weekend"
  | "this_week"
  | "next_week"
  | "this_month"
  | "custom";

export interface LocalDateRange {
  start: Date;
  end: Date;
}

export function rangeForPreset(
  preset: PeriodPreset,
  now: Date,
  custom?: { start: Date; end: Date },
): LocalDateRange {
  if (preset === "custom" && custom) {
    return { start: startOfDay(custom.start), end: endOfDay(custom.end) };
  }
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "tomorrow": {
      const t = addDays(now, 1);
      return { start: startOfDay(t), end: endOfDay(t) };
    }
    case "this_weekend": {
      const dow = now.getDay(); // 0 Sun
      const saturday =
        dow === 6
          ? now
          : dow === 0
            ? addDays(now, -1)
            : addDays(now, 6 - dow);
      const sunday = addDays(saturday, 1);
      return { start: startOfDay(saturday), end: endOfDay(sunday) };
    }
    case "this_week":
      return {
        start: startOfDay(startOfISOWeek(now)),
        end: endOfDay(endOfISOWeek(now)),
      };
    case "next_week": {
      const start = startOfISOWeek(addWeeks(now, 1));
      return {
        start: startOfDay(start),
        end: endOfDay(endOfISOWeek(start)),
      };
    }
    case "this_month":
      return { start: startOfDay(startOfMonth(now)), end: endOfDay(endOfMonth(now)) };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}
