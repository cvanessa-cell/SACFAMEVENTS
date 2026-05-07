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

/** Map Airtable "Family Events" row to canonical FamilyEvent (Zod-checked). */
export function mapAirtableEventRecord(
  record: AirtableRecord,
): FamilyEvent | null {
  const f = record.fields as Record<string, unknown>;
  const eventName = strField(f["Event Name"]);
  const dateRaw = strField(f["Date"]);
  if (!eventName || !dateRaw) return null;

  const statusRaw = strField(f["Status"]) || "Need Review";
  const statusParse = familyEventSchema.shape.status.safeParse(statusRaw);

  const event: FamilyEvent = {
    airtableRecordId: record.id,
    eventName,
    date: normalizeAirtableDate(dateRaw),
    startTime: strField(f["Start Time"]),
    endTime: strField(f["End Time"]),
    city: strField(f["City"]),
    venue: strField(f["Venue"]),
    address: strField(f["Address"]),
    sourceName: strField(f["Source Name"]),
    sourceType: strField(f["Source Type"]),
    sourceLink: strField(f["Source Link"]),
    eventLink: strField(f["Event Link"]),
    ageRange: strField(f["Age Range"]),
    cost: strField(f["Cost"]),
    free: boolField(f["Free?"]),
    category: strField(f["Category"]),
    categoryPrefix: strField((f["Category Prefix"] ?? f["Calendar Prefix"]) as unknown),
    indoorOutdoor: strField(f["Indoor/Outdoor"]),
    recurring: boolField(f["Recurring?"]),
    registrationRequired: boolField(f["Registration Required?"]),
    kidFriendlyNotes: strField(f["Kid-Friendly Notes"]),
    description: strField(f["Description"]),
    screenshotUrl:
      strField(f["Screenshot URL"]) || strField(f["Screenshot Attachment"]),
    googleMapsLink: strField(f["Google Maps Link"]),
    lastCheckedDate: strField(f["Last Checked Date"]),
    status: statusParse.success ? statusParse.data : "Need Review",
    addedToGoogleCalendar: boolField(f["Added to Google Calendar?"]),
    googleCalendarEventId: strField(f["Google Calendar Event ID"]),
    addedDate: strField(f["Added Date"]),
    confidenceScore: numField(f["Confidence Score"]),
    duplicateGroupId: strField(f["Duplicate Group ID"]),
    normalizedEventKey: strField(f["Normalized Event Key"]),
    extractedRawText: strField(f["Extracted Raw Text"]),
    sourceReliabilityScore: numField(f["Source Reliability Score"]),
    zapierWebhookStatus: strField(f["Zapier Webhook Status"]),
    zapierLastSentAt: strField(f["Zapier Last Sent At"]),
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
