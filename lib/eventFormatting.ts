import {
  STRUCTURED_BLOCK_END,
  STRUCTURED_BLOCK_START,
} from "@/lib/constants";
import { mapsLinkFromEventParts } from "@/lib/googleMaps";
import type { FamilyEventZapierPayload } from "@/lib/zapier";
import type { FamilyEvent } from "@/lib/validation";

export function calendarTitleForEvent(ev: FamilyEvent): string {
  const raw = (
    ev.categoryPrefix ||
    derivePrefixFromCategory(ev.category) ||
    "EVENT"
  ).trim();
  const bracketed = raw.startsWith("[") ? raw : `[${raw}]`;
  const cityPart = ev.city?.trim();
  const base = ev.eventName.trim();
  const title =
    cityPart && cityPart.length > 0
      ? `${bracketed} ${base} - ${cityPart}`
      : `${bracketed} ${base}`;
  return title.replace(/\s+/g, " ").trim();
}

function derivePrefixFromCategory(category?: string): string {
  if (!category) return "";
  const c = category.toLowerCase();
  if (c.includes("story")) return "STORY TIME";
  if (c.includes("farmers")) return "MARKET";
  if (c.includes("festival")) return "FESTIVAL";
  if (c.includes("free")) return "FREE";
  return category.slice(0, 12).toUpperCase();
}

export interface StructuredCalendarBlockPayload {
  event: FamilyEvent;
  mapsLink: string;
  summaryLine?: string;
}

export function formatCalendarDescriptionStructured(
  p: StructuredCalendarBlockPayload,
): string {
  const ev = p.event;
  const summary =
    p.summaryLine ||
    summarizeEvent(ev);

  const block = [
    STRUCTURED_BLOCK_START,
    `Event Name: ${ev.eventName}`,
    `Category: ${ev.category ?? ""}`,
    `Age Range: ${ev.ageRange ?? ""}`,
    `Cost: ${ev.cost ?? ""}`,
    `Free: ${ev.free === true ? "Yes" : ev.free === false ? "No" : ""}`,
    `Registration Required: ${formatYesNo(ev.registrationRequired)}`,
    `Indoor/Outdoor: ${ev.indoorOutdoor ?? ""}`,
    `Kid-Friendly Notes: ${ev.kidFriendlyNotes ?? ""}`,
    `Source Name: ${ev.sourceName ?? ""}`,
    `Source Type: ${ev.sourceType ?? ""}`,
    `Event Link: ${ev.eventLink ?? ""}`,
    `Source Link: ${ev.sourceLink ?? ""}`,
    `Screenshot: ${ev.screenshotUrl ?? ""}`,
    `Google Maps: ${p.mapsLink}`,
    `Airtable Event ID: ${ev.airtableRecordId ?? ""}`,
    `Last Checked: ${ev.lastCheckedDate ?? ""}`,
    `Status: ${ev.status}`,
    STRUCTURED_BLOCK_END,
  ].join("\n");

  return `${summary}\n\n${block}`;
}

function summarizeEvent(ev: FamilyEvent): string {
  const bits = [
    ev.category ? `Family event: ${ev.category}` : "Family-friendly event",
    ev.venue ? ` at ${ev.venue}` : "",
    ev.city ? ` in ${ev.city}` : "",
  ];
  const main = `${bits.join("")}.`.trim();
  const extras = [];
  if (ev.registrationRequired) extras.push("Registration required.");
  if (ev.kidFriendlyNotes) extras.push(ev.kidFriendlyNotes);
  return [main, ...extras].filter(Boolean).join(" ");
}

function formatYesNo(v: boolean | undefined): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "";
}

export function ensureMapsLink(ev: FamilyEvent): string {
  if (ev.googleMapsLink?.trim()) return ev.googleMapsLink;
  return mapsLinkFromEventParts({
    address: ev.address,
    venue: ev.venue,
    city: ev.city,
  });
}

export function formatReminderPreferenceForZapier(
  pref: FamilyEvent["reminderPreference"],
): string | undefined {
  if (!pref) return undefined;
  if (pref.kind === "none") return "none";
  if (pref.kind === "minutes") return `${pref.minutes} minutes before`;
  return `${pref.minutesBefore.join(", ")} minutes before`;
}

/** Builds the JSON payload sent to Zapier Catch Hook URLs. */
export function familyEventToZapierPayload(
  ev: FamilyEvent,
  localEventId?: string,
): FamilyEventZapierPayload {
  const maps = ensureMapsLink(ev);
  return {
    airtableEventId: ev.airtableRecordId,
    localEventId: localEventId ?? ev.airtableRecordId ?? ev.eventName,
    eventName: ev.eventName,
    date: ev.date,
    startTime: ev.startTime,
    endTime: ev.endTime,
    city: ev.city,
    venue: ev.venue,
    address: ev.address,
    category: ev.category,
    ageRange: ev.ageRange,
    cost: ev.cost,
    free: ev.free,
    registrationRequired: ev.registrationRequired,
    indoorOutdoor: ev.indoorOutdoor,
    recurring: ev.recurring,
    kidFriendlyNotes: ev.kidFriendlyNotes,
    description: ev.description,
    eventLink: ev.eventLink,
    sourceName: ev.sourceName,
    sourceType: ev.sourceType,
    sourceLink: ev.sourceLink,
    screenshotUrl: ev.screenshotUrl,
    googleMapsLink: maps,
    reminderPreference: formatReminderPreferenceForZapier(ev.reminderPreference),
    status: ev.status,
    confidenceScore: ev.confidenceScore,
    lastCheckedDate: ev.lastCheckedDate,
  };
}
