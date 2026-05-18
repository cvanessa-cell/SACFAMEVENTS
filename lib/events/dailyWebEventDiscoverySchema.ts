import { z } from "zod";

export const registrationRequiredSchema = z.enum(["yes", "no", "unknown"]);
export const calendarReadySchema = z.enum(["yes", "no", "needs_review"]);

export const dailyWebEventCitationSchema = z.object({
  title: z.string(),
  /** Plain string for OpenAI structured output (no `uri` format). */
  url: z.string(),
});

export const dailyWebEventSchema = z.object({
  event_title: z.string().min(1),
  event_url: z.string().min(1),
  source_name: z.string().min(1),
  source_url: z.string().min(1),
  event_description: z.string().min(1),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day_of_week: z.string(),
  start_datetime: z.string(),
  end_datetime: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  location_name: z.string(),
  street_address: z.string(),
  city: z.string().min(1),
  region: z.string(),
  google_maps_url: z.string(),
  event_category: z.string(),
  family_age_range: z.string(),
  cost: z.string(),
  registration_required: registrationRequiredSchema,
  why_family_friendly: z.string(),
  confidence_score: z.number().int().min(1).max(10),
  calendar_ready: calendarReadySchema,
  missing_fields: z.array(z.string()),
  review_status: z.literal("Need Review"),
  citations: z.array(dailyWebEventCitationSchema),
  notes: z.string(),
});

export const dailyWebEventDiscoverySchema = z.object({
  events: z.array(dailyWebEventSchema),
});

export type DailyWebEvent = z.infer<typeof dailyWebEventSchema>;
export type DailyWebEventDiscoveryResult = z.infer<typeof dailyWebEventDiscoverySchema>;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname;
    const hasDomain = host.includes(".") || host === "localhost";
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") && hasDomain
    );
  } catch {
    return false;
  }
}

export function parseEventDateYmd(value: string): Date | null {
  if (!ISO_DATE_RE.test(value.trim())) return null;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function isEventWithinDateWindow(
  eventDate: string,
  startDate: string,
  endDate: string,
): boolean {
  const event = parseEventDateYmd(eventDate);
  const start = parseEventDateYmd(startDate);
  const end = parseEventDateYmd(endDate);
  if (!event || !start || !end) return false;
  return event >= start && event <= end;
}

export function filterEventsInDateWindow(
  events: DailyWebEvent[],
  startDate: string,
  endDate: string,
): { valid: DailyWebEvent[]; rejected: Array<{ event: DailyWebEvent; reason: string }> } {
  const valid: DailyWebEvent[] = [];
  const rejected: Array<{ event: DailyWebEvent; reason: string }> = [];
  for (const event of events) {
    if (!event.source_url?.trim() || !isValidHttpUrl(event.source_url)) {
      rejected.push({ event, reason: "missing_source_url" });
      continue;
    }
    if (!event.event_url?.trim() || !isValidHttpUrl(event.event_url)) {
      rejected.push({ event, reason: "missing_event_url" });
      continue;
    }
    if (!isEventWithinDateWindow(event.event_date, startDate, endDate)) {
      rejected.push({ event, reason: "outside_date_window" });
      continue;
    }
    valid.push(event);
  }
  return { valid, rejected };
}

export function parseDailyWebEventDiscoveryJson(
  raw: string,
): ReturnType<typeof dailyWebEventDiscoverySchema.safeParse> {
  try {
    const json = JSON.parse(raw) as unknown;
    return dailyWebEventDiscoverySchema.safeParse(json);
  } catch {
    return dailyWebEventDiscoverySchema.safeParse({});
  }
}
