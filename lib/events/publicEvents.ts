import { formatInTimeZone } from "date-fns-tz";

import { buildNormalizedEventKey } from "@/lib/eventDedupe";
import { scoreToddlerRelevance } from "@/lib/events/ageSuitability";
import { normalizeEventEndDatetime, normalizeStoredEventDatetime } from "@/lib/events/parseEventDatetime";
import type { FamilyEvent } from "@/lib/validation";
const TZ = "America/Los_Angeles";

/** Statuses on Airtable Family Events that are safe to show on /discover. */
const PUBLIC_AIRTABLE_STATUSES = new Set<FamilyEvent["status"]>([
  "Confirmed",
  "Added to Calendar",
]);

export type PublicEvent = {
  id: string;
  eventName: string;
  description?: string;
  eventLink: string;
  city?: string;
  county?: string;
  venue?: string;
  address?: string;
  date: string;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  ageRange?: string;
  toddlerRelevance?: number;
  cost?: string;
  free?: boolean;
  category?: string;
  sourceName?: string;
  registrationRequired?: boolean;
  registrationUrl?: string;
  confidence?: number;
  status: string;
  kidFriendlyNotes?: string;
  airtableRecordId?: string;
  indoorOutdoor?: string;
  googleMapsLink?: string;
  /** Which store supplied this row (after dedupe). */
  dataSource: "postgres" | "airtable";
};

export type PostgresPublicEventRow = {
  id: string;
  title: string;
  description: string | null;
  sourceEventUrl: string | null;
  city: string | null;
  county: string | null;
  venueName: string | null;
  address: string | null;
  startDatetime: Date | null;
  endDatetime: Date | null;
  timezone: string | null;
  ageRange: string | null;
  priceText: string | null;
  registrationUrl: string | null;
  familyFriendlyScore: number | null;
  confidence: number | null;
  status: string;
  source: { name: string; category: string | null } | null;
};

export function getTodayPacificYmd(now = new Date()): string {
  return formatInTimeZone(now, TZ, "yyyy-MM-dd");
}

export function startOfTodayPacific(now = new Date()): Date {
  const ymd = getTodayPacificYmd(now);
  return new Date(`${ymd}T07:00:00.000Z`);
}

export function isAirtableStatusPublicApproved(
  status: FamilyEvent["status"],
): boolean {
  return PUBLIC_AIRTABLE_STATUSES.has(status);
}

/** Normalize event URLs so duplicates match across Postgres and Airtable. */
export function normalizeEventUrlForDedupe(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString().toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function publicEventDedupeKey(event: {
  eventLink?: string | null;
  eventName: string;
  date: string;
  venue?: string | null;
  city?: string | null;
  address?: string | null;
}): string {
  const url = normalizeEventUrlForDedupe(event.eventLink ?? "");
  if (url) return `url:${url}`;
  return `key:${buildNormalizedEventKey({
    eventName: event.eventName,
    date: event.date,
    venue: event.venue ?? undefined,
    city: event.city ?? undefined,
    address: event.address ?? undefined,
  })}`;
}

export function mapPostgresRowToPublicEvent(
  row: PostgresPublicEventRow,
): PublicEvent | null {
  const eventLink = row.sourceEventUrl?.trim();
  if (!eventLink) return null;

  const tz = row.timezone || TZ;
  const startDt = normalizeStoredEventDatetime(row.startDatetime, tz);
  const endDt = normalizeEventEndDatetime(startDt, row.endDatetime, tz);
  const date = startDt
    ? formatInTimeZone(startDt, tz, "yyyy-MM-dd")
    : "";
  if (!date) return null;

  const dayOfWeek = startDt
    ? formatInTimeZone(startDt, tz, "EEEE")
    : undefined;

  const toddlerRelevance = scoreToddlerRelevance({
    title: row.title,
    description: row.description,
    ageRange: row.ageRange,
    category: row.source?.category,
  });

  return {
    id: row.id,
    eventName: row.title,
    description: row.description ?? undefined,
    eventLink,
    city: row.city ?? undefined,
    county: row.county ?? undefined,
    venue: row.venueName ?? undefined,
    address: row.address ?? undefined,
    date,
    dayOfWeek,
    startTime: startDt
      ? startDt.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: tz,
        })
      : undefined,
    endTime: endDt
      ? endDt.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: tz,
        })
      : undefined,
    ageRange: row.ageRange ?? undefined,
    toddlerRelevance,
    cost: row.priceText ?? undefined,
    free: row.priceText ? /free|no cost|\$0/i.test(row.priceText) : undefined,
    category: row.source?.category ?? undefined,
    sourceName: row.source?.name ?? undefined,
    registrationRequired: Boolean(row.registrationUrl),
    registrationUrl: row.registrationUrl ?? undefined,
    confidence: row.confidence ?? undefined,
    status: row.status,
    dataSource: "postgres",
  };
}

export function mapFamilyEventToPublicEvent(
  event: FamilyEvent,
): PublicEvent | null {
  const eventLink = event.eventLink?.trim();
  if (!eventLink) return null;
  if (!isAirtableStatusPublicApproved(event.status)) return null;

  const toddlerRelevance = scoreToddlerRelevance({
    title: event.eventName,
    description: event.description,
    ageRange: event.ageRange,
    category: event.category,
  });

  return {
    id: event.airtableRecordId
      ? `airtable:${event.airtableRecordId}`
      : `airtable:${event.eventName}-${event.date}`,
    eventName: event.eventName,
    description: event.description,
    eventLink,
    city: event.city,
    venue: event.venue,
    address: event.address,
    date: event.date,
    dayOfWeek: event.dayOfWeek,
    startTime: event.startTime,
    endTime: event.endTime,
    ageRange: event.ageRange,
    toddlerRelevance,
    cost: event.cost,
    free: event.free,
    category: event.category,
    sourceName: event.sourceName,
    registrationRequired: event.registrationRequired,
    confidence: event.confidenceScore,
    status: event.status,
    kidFriendlyNotes: event.kidFriendlyNotes,
    airtableRecordId: event.airtableRecordId,
    indoorOutdoor: event.indoorOutdoor,
    googleMapsLink: event.googleMapsLink,
    dataSource: "airtable",
  };
}

/** Keep Postgres rows when the same event exists in both stores. */
export function mergePublicEvents(
  postgresEvents: PublicEvent[],
  airtableEvents: PublicEvent[],
): PublicEvent[] {
  const merged = new Map<string, PublicEvent>();

  for (const event of postgresEvents) {
    merged.set(publicEventDedupeKey(event), event);
  }

  for (const event of airtableEvents) {
    const key = publicEventDedupeKey(event);
    if (!merged.has(key)) {
      merged.set(key, event);
    }
  }

  return [...merged.values()].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return a.eventName.localeCompare(b.eventName);
  });
}

export function filterUpcomingPublicEvents(
  events: PublicEvent[],
  todayYmd: string,
): PublicEvent[] {
  return events.filter((ev) => ev.date >= todayYmd);
}
