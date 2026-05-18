import {
  buildGoogleMapsUrlFromParts,
  computeDayOfWeekFromYmd,
  extractDisplayTimeFromDatetime,
} from "@/lib/eventLocation";
import type { DailyWebEvent } from "@/lib/events/dailyWebEventDiscoverySchema";

type CalendarReady = DailyWebEvent["calendar_ready"];

const TIMEZONE = "America/Los_Angeles";

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

/** Infer calendar_ready and missing_fields after OpenAI returns a candidate. */
export function inferCalendarReadyAndMissing(
  event: Pick<
    DailyWebEvent,
    | "start_time"
    | "end_time"
    | "start_datetime"
    | "end_datetime"
    | "location_name"
    | "street_address"
    | "city"
    | "event_url"
    | "source_url"
    | "event_description"
  >,
): { calendar_ready: CalendarReady; missing_fields: string[] } {
  const missing: string[] = [];
  if (!event.event_url?.trim()) missing.push("event_url");
  if (!event.source_url?.trim()) missing.push("source_url");
  if (!event.event_description?.trim()) missing.push("event_description");

  const hasStart =
    !!event.start_time?.trim() || !!event.start_datetime?.trim();
  const hasEnd = !!event.end_time?.trim() || !!event.end_datetime?.trim();
  if (!hasStart) missing.push("start_time");
  if (!hasEnd) missing.push("end_time");

  const hasLocation =
    !!event.location_name?.trim() ||
    !!event.street_address?.trim() ||
    !!event.city?.trim();
  if (!hasLocation) missing.push("location");

  const calendar_ready: CalendarReady = missing.some((f) =>
    ["start_time", "end_time", "location", "event_url", "source_url"].includes(f),
  )
    ? "needs_review"
    : "yes";

  return { calendar_ready, missing_fields: uniqueStrings(missing) };
}

/** Normalize and enrich a parsed daily web event before ranking/save. */
export function enrichDailyWebEvent(
  event: DailyWebEvent,
  timeZone = TIMEZONE,
): DailyWebEvent {
  const day_of_week =
    event.day_of_week?.trim() ||
    computeDayOfWeekFromYmd(event.event_date, timeZone);

  const start_time =
    event.start_time?.trim() ||
    extractDisplayTimeFromDatetime(event.start_datetime, timeZone);
  const end_time =
    event.end_time?.trim() ||
    extractDisplayTimeFromDatetime(event.end_datetime, timeZone);

  const google_maps_url =
    event.google_maps_url?.trim() ||
    buildGoogleMapsUrlFromParts({
      street_address: event.street_address,
      location_name: event.location_name,
      city: event.city,
      region: event.region,
    });

  const base = {
    ...event,
    day_of_week,
    start_time,
    end_time,
    google_maps_url,
    review_status: "Need Review" as const,
  };

  const inferred = inferCalendarReadyAndMissing(base);
  return {
    ...base,
    calendar_ready: inferred.calendar_ready,
    missing_fields: uniqueStrings([
      ...event.missing_fields,
      ...inferred.missing_fields,
    ]),
  };
}

export function enrichDailyWebEvents(events: DailyWebEvent[]): DailyWebEvent[] {
  return events.map((e) => enrichDailyWebEvent(e));
}
