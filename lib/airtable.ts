import { computeDayOfWeekForFamilyEvent } from "@/lib/eventLocation";
import { familyEventSchema, type FamilyEvent } from "@/lib/validation";
import { mapsLinkFromEventParts } from "@/lib/googleMaps";

const AIRTABLE_API = "https://api.airtable.com/v0";

export function getAirtableConfig(): {
  apiKey: string;
  baseId: string;
  eventsTable: string;
  sourcesTable: string;
  venuesTable: string;
  categoriesTable: string;
} | null {
  const apiKey = process.env.AIRTABLE_API_KEY?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!apiKey || !baseId) return null;
  return {
    apiKey,
    baseId,
    eventsTable:
      process.env.AIRTABLE_EVENTS_TABLE?.trim() || "Family Events",
    sourcesTable:
      process.env.AIRTABLE_SOURCES_TABLE?.trim() || "Family Event Sources",
    venuesTable:
      process.env.AIRTABLE_VENUES_TABLE?.trim() || "Family Event Venues",
    categoriesTable:
      process.env.AIRTABLE_CATEGORIES_TABLE?.trim() || "Family Event Categories",
  };
}

export function isAirtableConfigured(): boolean {
  return getAirtableConfig() !== null;
}

export interface AirtableRecord<T = Record<string, unknown>> {
  id: string;
  fields: T;
  createdTime?: string;
}

async function airtableFetch<T>(
  path: string,
  init?: RequestInit & { apiKey: string },
): Promise<T> {
  const res = await fetch(`${AIRTABLE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${init?.apiKey ?? ""}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

/** Best-effort patch for Zapier columns on the events table (ignored if fields are missing). */
export async function patchAirtableEventZapierStatus(
  airtableRecordId: string | undefined,
  update: { status: string; detail?: string },
): Promise<void> {
  const cfg = getAirtableConfig();
  if (!cfg || !airtableRecordId?.trim()) return;
  if (airtableRecordId.startsWith("mock_")) return;

  const summary = update.detail?.trim()?.length
    ? `${update.status} — ${update.detail}`.slice(0, 500)
    : update.status;

  const path = `/${encodeURIComponent(cfg.baseId)}/${encodeURIComponent(cfg.eventsTable)}/${encodeURIComponent(airtableRecordId)}`;

  try {
    await airtableFetch(path, {
      method: "PATCH",
      apiKey: cfg.apiKey,
      body: JSON.stringify({
        fields: {
          "Zapier Webhook Status": summary,
          "Zapier Last Sent At": new Date().toISOString(),
        },
      }),
    });
  } catch {
    /* Columns may not exist yet; Prisma log still records delivery. */
  }
}

export async function listAllRecords<TFields>(
  baseId: string,
  tableName: string,
  apiKey: string,
  filterByFormula?: string,
): Promise<AirtableRecord<TFields>[]> {
  const rows: AirtableRecord<TFields>[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    if (filterByFormula) params.set("filterByFormula", filterByFormula);
    if (offset) params.set("offset", offset);
    const q = params.toString();
    const path = `/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}${q ? `?${q}` : ""}`;
    const body = await airtableFetch<{
      records: AirtableRecord<TFields>[];
      offset?: string;
    }>(path, { apiKey });
    rows.push(...body.records);
    offset = body.offset;
  } while (offset);
  return rows;
}

function strField(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v) && v.length > 0) return strField(v[0]);
  return "";
}

function boolField(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  const s = strField(v).toLowerCase();
  if (s === "yes" || s === "true") return true;
  if (s === "no" || s === "false") return false;
  return undefined;
}

function numField(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(strField(v));
  return Number.isFinite(n) ? n : undefined;
}

function fieldFirst(f: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = strField(f[key]);
    if (v) return v;
  }
  return "";
}

function categoryField(f: Record<string, unknown>): string {
  const raw = f["Category Text"] ?? f.Category ?? f["Category"];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "name" in item) {
          return strField((item as { name?: unknown }).name);
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  return strField(raw);
}

function normalizeEventStatus(raw: string): FamilyEvent["status"] {
  const trimmed = raw.trim();
  if (trimmed === "Added to Google Calendar") return "Added to Calendar";
  if (trimmed === "Approved") return "Confirmed";
  const statusParse = familyEventSchema.shape.status.safeParse(trimmed);
  return statusParse.success ? statusParse.data : "Need Review";
}

function dateFromRecord(f: Record<string, unknown>): string {
  const explicit = fieldFirst(f, ["Date", "Start Date"]);
  if (explicit) return normalizeAirtableDate(explicit);

  const startDateTime = fieldFirst(f, ["Start Date / Time"]);
  if (startDateTime) return normalizeAirtableDate(startDateTime);

  return "";
}

function timeFromDateTime(isoLike: string): string | undefined {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

/** Map Airtable "Family Events" row to canonical FamilyEvent (Zod-checked). */
export function mapAirtableEventRecord(
  record: AirtableRecord,
): FamilyEvent | null {
  const f = record.fields as Record<string, unknown>;
  const eventName = fieldFirst(f, ["Event Name"]);
  const dateRaw = dateFromRecord(f);
  if (!eventName || !dateRaw) return null;

  const startDateTime = fieldFirst(f, ["Start Date / Time"]);
  const endDateTime = fieldFirst(f, ["End Date / Time"]);
  const statusRaw = fieldFirst(f, ["Status"]) || "Need Review";

  const event: FamilyEvent = {
    airtableRecordId: record.id,
    eventName,
    date: dateRaw,
    dayOfWeek:
      fieldFirst(f, ["Day of Week"]) ||
      computeDayOfWeekForFamilyEvent(dateRaw),
    startTime:
      fieldFirst(f, ["Start Time", "Start Time Only"]) ||
      (startDateTime ? timeFromDateTime(startDateTime) : ""),
    endTime:
      fieldFirst(f, ["End Time"]) ||
      (endDateTime ? timeFromDateTime(endDateTime) : ""),
    city: fieldFirst(f, ["City", "City / Area"]),
    venue: fieldFirst(f, ["Venue", "Location Name", "Location / Venue Text"]),
    address: fieldFirst(f, ["Address", "Street Address"]),
    sourceName: fieldFirst(f, ["Source Name", "Source Name Text"]),
    sourceType: fieldFirst(f, ["Source Type"]),
    sourceLink: fieldFirst(f, ["Source Link", "Source URL"]),
    eventLink: fieldFirst(f, ["Event Link", "Event URL"]),
    ageRange: fieldFirst(f, ["Age Range"]),
    cost: fieldFirst(f, ["Cost"]),
    free: boolField(f["Free?"]),
    category: categoryField(f),
    categoryPrefix: fieldFirst(f, [
      "Category Prefix",
      "Calendar Prefix",
      "Google Calendar Title",
    ]),
    indoorOutdoor: fieldFirst(f, ["Indoor/Outdoor", "Indoor / Outdoor"]),
    recurring: boolField(f["Recurring?"]),
    registrationRequired: boolField(f["Registration Required?"]),
    kidFriendlyNotes: fieldFirst(f, ["Kid-Friendly Notes"]),
    description: fieldFirst(f, ["Description"]),
    screenshotUrl:
      fieldFirst(f, ["Screenshot URL", "Screenshot Attachment"]),
    googleMapsLink: fieldFirst(f, ["Google Maps Link", "Google Maps URL"]),
    lastCheckedDate: fieldFirst(f, ["Last Checked Date", "Last Checked"]),
    status: normalizeEventStatus(statusRaw),
    addedToGoogleCalendar:
      boolField(f["Added to Google Calendar?"]) ||
      statusRaw === "Added to Google Calendar",
    googleCalendarEventId: fieldFirst(f, [
      "Google Calendar Event ID",
    ]),
    addedDate: fieldFirst(f, ["Added Date"]),
    confidenceScore: numField(f["Confidence Score"]),
    duplicateGroupId: fieldFirst(f, ["Duplicate Group ID"]),
    normalizedEventKey: fieldFirst(f, ["Normalized Event Key"]),
    extractedRawText: fieldFirst(f, ["Extracted Raw Text"]),
    sourceReliabilityScore: numField(f["Source Reliability Score"]),
    zapierWebhookStatus: fieldFirst(f, ["Zapier Webhook Status"]),
    zapierLastSentAt: fieldFirst(f, ["Zapier Last Sent At"]),
  };

  const parsed = familyEventSchema.safeParse(event);
  if (!parsed.success) return null;
  const inferredMaps = mapsLinkFromEventParts({
    address: parsed.data.address,
    venue: parsed.data.venue,
    city: parsed.data.city,
  });
  return {
    ...parsed.data,
    googleMapsLink: parsed.data.googleMapsLink?.trim()
      ? parsed.data.googleMapsLink
      : inferredMaps,
  };
}

function normalizeAirtableDate(input: string): string {
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

export interface AirtableEventFields {
  "Event Name": string;
  Date: string;
  "Start Time"?: string;
  "End Time"?: string;
  City?: string;
  Venue?: string;
  Address?: string;
  "Source Name"?: string;
  "Source Link"?: string;
  "Event Link"?: string;
  "Age Range"?: string;
  Cost?: string;
  "Free?"?: boolean;
  Category?: string;
  Description?: string;
  Status: string;
  "Confidence Score"?: number;
}

/**
 * Create a new record in the Airtable events table for an approved event.
 * Returns the Airtable record ID on success, null if Airtable is not configured.
 */
export async function createAirtableEventRecord(
  fields: AirtableEventFields,
): Promise<string | null> {
  const cfg = getAirtableConfig();
  if (!cfg) return null;

  const path = `/${encodeURIComponent(cfg.baseId)}/${encodeURIComponent(cfg.eventsTable)}`;
  const result = await airtableFetch<{ id: string }>(path, {
    method: "POST",
    apiKey: cfg.apiKey,
    body: JSON.stringify({ fields }),
  });

  return result.id;
}

/**
 * Syncs a Prisma FamilyEvent to Airtable on approval. Converts the DB
 * record fields to the Airtable column names used by the events table.
 */
export async function syncApprovedEventToAirtable(event: {
  title: string;
  description?: string | null;
  city?: string | null;
  venueName?: string | null;
  address?: string | null;
  startDatetime?: Date | null;
  endDatetime?: Date | null;
  ageRange?: string | null;
  priceText?: string | null;
  sourceEventUrl?: string | null;
  confidence?: number | null;
  source?: { name: string; sourceUrl: string } | null;
}): Promise<string | null> {
  const startDate = event.startDatetime
    ? event.startDatetime.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const startTime = event.startDatetime
    ? event.startDatetime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Los_Angeles",
      })
    : undefined;
  const endTime = event.endDatetime
    ? event.endDatetime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Los_Angeles",
      })
    : undefined;

  const isFree =
    event.priceText?.toLowerCase().includes("free") ||
    event.priceText === "$0" ||
    event.priceText === "0";

  return createAirtableEventRecord({
    "Event Name": event.title,
    Date: startDate,
    "Start Time": startTime,
    "End Time": endTime,
    City: event.city ?? undefined,
    Venue: event.venueName ?? undefined,
    Address: event.address ?? undefined,
    "Source Name": event.source?.name,
    "Source Link": event.source?.sourceUrl,
    "Event Link": event.sourceEventUrl ?? undefined,
    "Age Range": event.ageRange ?? undefined,
    Cost: event.priceText ?? undefined,
    "Free?": isFree,
    Description: event.description ?? undefined,
    Status: "Approved",
    "Confidence Score": event.confidence ?? undefined,
  });
}

export async function fetchFamilyEventsFromAirtable(): Promise<FamilyEvent[]> {
  const cfg = getAirtableConfig();
  if (!cfg) return [];
  const records = await listAllRecords<Record<string, unknown>>(
    cfg.baseId,
    cfg.eventsTable,
    cfg.apiKey,
  );
  const mapped = records
    .map((r) => mapAirtableEventRecord(r))
    .filter((e): e is FamilyEvent => e !== null);
  return mapped;
}
