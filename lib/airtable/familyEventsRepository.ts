import { listAllRecords, type AirtableRecord } from "@/lib/airtable";
import { getFamilyEventsAirtableConfig } from "@/lib/airtable/client";
import type { DailyWebEvent } from "@/lib/events/dailyWebEventDiscoverySchema";
import { buildDuplicateKey, type DuplicateKeyInput } from "@/lib/events/eventDeduper";

const AIRTABLE_API = "https://api.airtable.com/v0";
export const AIRTABLE_BATCH_LIMIT = 10;

const AUTOMATION_NOTE =
  "Added by daily OpenAI web event discovery automation. Verify details before publishing or calendar export.";

export interface ExistingFamilyEventForDedupe {
  duplicateKey: string;
  eventName: string;
  date: string;
  city: string;
  eventUrl: string;
  sourceUrl: string;
}

export interface FamilyEventAirtableWriteFields {
  "Event Name": string;
  Date: string;
  "Day of Week"?: string;
  "Start Date / Time"?: string;
  "End Date / Time"?: string;
  "Start Time"?: string;
  "End Time"?: string;
  City?: string;
  Venue?: string;
  Address?: string;
  "Google Maps Link"?: string;
  "Source Name"?: string;
  "Source Link"?: string;
  "Event Link"?: string;
  "Event URL"?: string;
  "Age Range"?: string;
  Cost?: string;
  Category?: string;
  Description?: string;
  "Kid-Friendly Notes"?: string;
  Status: string;
  "Confidence Score"?: number;
  Notes?: string;
  "Normalized Event Key"?: string;
}

export const OPENAI_DISCOVERY_AUTOMATION_NOTE = AUTOMATION_NOTE;

function strField(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value) && value.length > 0) return strField(value[0]);
  return "";
}

function normalizeDate(input: string): string {
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s.slice(0, 10);
}

function recordToDedupeInput(
  record: AirtableRecord<Record<string, unknown>>,
): ExistingFamilyEventForDedupe | null {
  const f = record.fields;
  const eventName = strField(f["Event Name"]);
  const date = normalizeDate(
    strField(f.Date) || strField(f["Start Date"]) || strField(f["Start Date / Time"]),
  );
  if (!eventName || !date) return null;
  const city = strField(f.City);
  const eventUrl = strField(f["Event Link"]) || strField(f["Event URL"]);
  const sourceUrl = strField(f["Source Link"]) || strField(f["Source URL"]);
  const duplicateKey = buildDuplicateKey({
    event_title: eventName,
    event_date: date,
    city,
    source_url: sourceUrl || eventUrl,
  });
  return { duplicateKey, eventName, date, city, eventUrl, sourceUrl };
}

export async function getExistingFamilyEventsForWindow(
  startDate: string,
  endDate: string,
): Promise<
  | { ok: true; events: ExistingFamilyEventForDedupe[] }
  | { ok: false; message: string }
> {
  const cfg = getFamilyEventsAirtableConfig();
  if (!cfg) return { ok: false, message: "Airtable is not configured." };

  const records = await listAllRecords<Record<string, unknown>>(
    cfg.baseId,
    cfg.familyEventsTable,
    cfg.apiKey,
  );

  const events = records
    .map((r) => recordToDedupeInput(r))
    .filter((e): e is ExistingFamilyEventForDedupe => e !== null)
    .filter((e) => e.date >= startDate && e.date <= endDate);

  return { ok: true, events };
}

export function mapDailyWebEventToAirtableFields(
  event: DailyWebEvent,
): FamilyEventAirtableWriteFields {
  const notesParts = [
    event.notes?.trim(),
    event.citations.length
      ? `Citations: ${event.citations.map((c) => c.url).join(" | ")}`
      : "",
    event.missing_fields.length
      ? `Missing fields: ${event.missing_fields.join(", ")}`
      : "",
    `Calendar ready: ${event.calendar_ready}`,
    AUTOMATION_NOTE,
  ].filter(Boolean);

  const confidenceNormalized = event.confidence_score / 10;

  const fields: FamilyEventAirtableWriteFields = {
    "Event Name": event.event_title,
    Date: event.event_date,
    "Day of Week": event.day_of_week || undefined,
    "Start Date / Time": event.start_datetime?.trim() || undefined,
    "End Date / Time": event.end_datetime?.trim() || undefined,
    "Start Time": event.start_time?.trim() || undefined,
    "End Time": event.end_time?.trim() || undefined,
    City: event.city,
    Venue: event.location_name || undefined,
    Address: event.street_address || undefined,
    "Google Maps Link": event.google_maps_url?.trim() || undefined,
    "Source Name": event.source_name,
    "Source Link": event.source_url,
    "Event Link": event.event_url,
    "Event URL": event.event_url,
    "Age Range": event.family_age_range || undefined,
    Cost: event.cost || undefined,
    Category: event.event_category || undefined,
    Description: event.event_description || undefined,
    "Kid-Friendly Notes": event.why_family_friendly || undefined,
    Status: "Need Review",
    "Confidence Score": confidenceNormalized,
    Notes: notesParts.join("\n\n"),
    "Normalized Event Key": buildDuplicateKey(event),
  };
  return fields;
}

export async function listRecentDiscoveredFamilyEvents(input: {
  limit?: number;
  days?: number;
}): Promise<
  | {
      ok: true;
      events: Array<{
        id: string;
        eventName: string;
        date: string;
        eventUrl: string;
        sourceUrl: string;
        status: string;
        createdTime?: string;
      }>;
    }
  | { ok: false; message: string }
> {
  const cfg = getFamilyEventsAirtableConfig();
  if (!cfg) return { ok: false, message: "Airtable is not configured." };

  const days = input.days ?? 14;
  const limit = Math.min(50, input.limit ?? 20);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const formula = `AND(FIND("${AUTOMATION_NOTE}", {Notes}), IS_AFTER(CREATED_TIME(), '${sinceIso}'))`;
  const records = await listAllRecords<Record<string, unknown>>(
    cfg.baseId,
    cfg.familyEventsTable,
    cfg.apiKey,
    formula,
  );

  const events = records
    .map((r) => {
      const f = r.fields;
      return {
        id: r.id,
        eventName: strField(f["Event Name"]),
        date: normalizeDate(strField(f.Date)),
        eventUrl: strField(f["Event Link"]) || strField(f["Event URL"]),
        sourceUrl: strField(f["Source Link"]) || strField(f["Source URL"]),
        status: strField(f.Status) || "Need Review",
        createdTime: r.createdTime,
      };
    })
    .filter((e) => e.eventName && e.date)
    .sort((a, b) => (b.createdTime ?? "").localeCompare(a.createdTime ?? ""))
    .slice(0, limit);

  return { ok: true, events };
}

async function airtableBatchCreate(
  cfg: NonNullable<ReturnType<typeof getFamilyEventsAirtableConfig>>,
  fieldsList: FamilyEventAirtableWriteFields[],
): Promise<Array<{ id: string; fields: FamilyEventAirtableWriteFields }>> {
  const created: Array<{ id: string; fields: FamilyEventAirtableWriteFields }> = [];
  for (let i = 0; i < fieldsList.length; i += AIRTABLE_BATCH_LIMIT) {
    const chunk = fieldsList.slice(i, i + AIRTABLE_BATCH_LIMIT);
    const path = `/${encodeURIComponent(cfg.baseId)}/${encodeURIComponent(cfg.familyEventsTable)}`;
    const res = await fetch(`${AIRTABLE_API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: chunk.map((fields) => ({ fields })),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable ${res.status}: ${text.slice(0, 500)}`);
    }
    const body = (await res.json()) as {
      records: Array<{ id: string; fields: FamilyEventAirtableWriteFields }>;
    };
    created.push(...body.records);
  }
  return created;
}

export async function createFamilyEvents(
  events: DailyWebEvent[],
): Promise<
  | { ok: true; records: Array<{ id: string; event: DailyWebEvent }> }
  | { ok: false; message: string }
> {
  const cfg = getFamilyEventsAirtableConfig();
  if (!cfg) return { ok: false, message: "Airtable is not configured." };
  if (events.length === 0) return { ok: true, records: [] };

  const fieldsList = events.map((e) => mapDailyWebEventToAirtableFields(e));
  const created = await airtableBatchCreate(cfg, fieldsList);
  return {
    ok: true,
    records: created.map((r, idx) => ({
      id: r.id,
      event: events[idx]!,
    })),
  };
}

export { buildDuplicateKey, type DuplicateKeyInput };
